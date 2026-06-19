"""국토부 실거래가 어댑터 — 아파트/연립다세대/오피스텔 × 매매/전월세."""
import logging
import xml.etree.ElementTree as ET
from datetime import date
from itertools import product

import httpx

from ..common.db import get_conn
from ..common.settings import SERVICE_KEY
from ..normalize.transaction import upsert_transaction
from .base import BaseAdapter

logger = logging.getLogger(__name__)

# 서울 25개 구 시군구코드 (LAWD_CD 5자리)
SEOUL_GU = {
    "11110": "종로구", "11140": "중구",     "11170": "용산구",  "11200": "성동구",
    "11215": "광진구", "11230": "동대문구", "11260": "중랑구",  "11290": "성북구",
    "11305": "강북구", "11320": "도봉구",   "11350": "노원구",  "11380": "은평구",
    "11410": "서대문구","11440": "마포구",  "11470": "양천구",  "11500": "강서구",
    "11530": "구로구", "11545": "금천구",   "11560": "영등포구","11590": "동작구",
    "11620": "관악구", "11650": "서초구",   "11680": "강남구",  "11710": "송파구",
    "11740": "강동구",
}

# 주택유형 → (source_code_suffix, URL, trade_type, XML 단지명 태그)
_APIS = {
    "APT_SALE":     ("RTMSDataSvcAptTradeDev",      "getRTMSDataSvcAptTradeDev",  "SALE",    "aptNm",     "11680"),
    "APT_RENT":     ("RTMSDataSvcAptRent",           "getRTMSDataSvcAptRent",      "JEONSE",  "aptNm",     None),
    "VILLA_SALE":   ("RTMSDataSvcRHTrade",           "getRTMSDataSvcRHTrade",      "SALE",    "연립다세대", None),
    "VILLA_RENT":   ("RTMSDataSvcSHRent",            "getRTMSDataSvcSHRent",       "JEONSE",  "연립다세대", None),
    "OFFICETEL_SALE":("RTMSDataSvcOffiTrade",        "getRTMSDataSvcOffiTrade",    "SALE",    "단지",      None),
    "OFFICETEL_RENT":("RTMSDataSvcOffiRent",         "getRTMSDataSvcOffiRent",     "JEONSE",  "단지",      None),
}

_BASE = "https://apis.data.go.kr/1613000"


def _recent_months(n: int = 3) -> list[str]:
    today = date.today()
    months = []
    y, m = today.year, today.month
    for _ in range(n):
        months.append(f"{y}{m:02d}")
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return months


def _xml_items(text: str) -> list[dict]:
    root = ET.fromstring(text)
    return [{c.tag: c.text for c in item} for item in root.findall(".//item")]


def _bjd_code_for_gu(lawd_cd: str) -> str:
    """5자리 시군구코드 → 10자리 법정동코드(구 레벨)."""
    return lawd_cd + "00000"


class MolitAdapter(BaseAdapter):
    """아파트 매매·전월세 실거래가 수집."""
    source_code = "MOLIT_APT_TRADE"   # 잡로그·헬스 대표 코드

    def run(self) -> int:
        months = _recent_months(3)
        total_new = 0

        for (src, svc_name, operation, base_trade_type), (lawd_cd, gu_name) in product(
            [
                ("MOLIT_APT_TRADE",   "RTMSDataSvcAptTradeDev", "getRTMSDataSvcAptTradeDev", "SALE"),
                ("MOLIT_APT_RENT",    "RTMSDataSvcAptRent",     "getRTMSDataSvcAptRent",     "JEONSE"),
                ("MOLIT_VILLA_TRADE", "RTMSDataSvcRHTrade",     "getRTMSDataSvcRHTrade",     "SALE"),
                ("MOLIT_VILLA_RENT",  "RTMSDataSvcSHRent",      "getRTMSDataSvcSHRent",      "JEONSE"),
                ("MOLIT_OFFI_TRADE",  "RTMSDataSvcOffiTrade",   "getRTMSDataSvcOffiTrade",   "SALE"),
                ("MOLIT_OFFI_RENT",   "RTMSDataSvcOffiRent",    "getRTMSDataSvcOffiRent",    "JEONSE"),
            ],
            SEOUL_GU.items(),
        ):
            for ym in months:
                try:
                    new = self._collect_one(src, svc_name, operation, lawd_cd, gu_name, ym, base_trade_type)
                    total_new += new
                except Exception as e:
                    logger.warning("[%s] %s/%s 실패: %s", src, lawd_cd, ym, e)

        logger.info("[MOLIT] 완료 신규 %d건", total_new)
        return total_new

    def _collect_one(
        self, source_code: str, svc_name: str, operation: str,
        lawd_cd: str, gu_name: str, deal_ymd: str, trade_type: str,
    ) -> int:
        url = f"{_BASE}/{svc_name}/{operation}"
        items, page = [], 1
        while True:
            r = self.client.get(url, params={
                "serviceKey": SERVICE_KEY,
                "LAWD_CD":   lawd_cd,
                "DEAL_YMD":  deal_ymd,
                "pageNo":    page,
                "numOfRows": 1000,
            }, timeout=30)
            r.raise_for_status()
            batch = _xml_items(r.text)
            items.extend(batch)
            # 국토부 API는 totalCount가 XML에 포함됨
            root = ET.fromstring(r.text)
            total = int(root.findtext(".//totalCount") or 0)
            if page * 1000 >= total:
                break
            page += 1

        bjd_code = _bjd_code_for_gu(lawd_cd)
        new_count = 0

        with get_conn() as conn:
            for item in items:
                try:
                    # 공통 필드 추출 (APT/연립/오피스텔 태그명 혼용)
                    complex_name = (item.get("aptNm") or item.get("연립다세대")
                                    or item.get("단지") or item.get("offiNm"))
                    dong_name    = item.get("umdNm") or item.get("법정동")
                    area_raw     = item.get("excluUseAr") or item.get("전용면적")
                    area_m2      = float(area_raw) if area_raw else None
                    floor_raw    = item.get("floor") or item.get("층")
                    floor        = int(floor_raw) if floor_raw else None
                    price_raw    = item.get("dealAmount") or item.get("거래금액")
                    price        = _parse_price(price_raw)
                    year         = int(item.get("dealYear") or item.get("년") or 0)
                    month        = int(item.get("dealMonth") or item.get("월") or 0)
                    day          = int(item.get("dealDay") or item.get("일") or 1)
                    rgst_date    = item.get("rgstDate") or item.get("등록일")

                    # 전월세는 거래금액 대신 보증금/월세 합산
                    if trade_type == "JEONSE" and price is None:
                        deposit  = _parse_price(item.get("deposit") or item.get("보증금액"))
                        monthly  = _parse_price(item.get("monthlyRent") or item.get("월세금액"))
                        price    = deposit  # 보증금을 가격으로 저장
                        actual_trade_type = "MONTHLY" if monthly and monthly > 0 else "JEONSE"
                    else:
                        actual_trade_type = trade_type

                    if not (year and month):
                        continue

                    with conn.transaction():
                        is_new = upsert_transaction(
                            conn          = conn,
                            source_code   = source_code,
                            bjd_code      = bjd_code,
                            gu_name       = gu_name,
                            dong_name     = dong_name,
                            complex_name  = complex_name,
                            trade_type    = actual_trade_type,
                            area_m2       = area_m2,
                            floor         = floor,
                            price_manwon  = price,
                            contract_year = year,
                            contract_month= month,
                            contract_day  = day,
                            rgst_date_str = rgst_date,
                            emitter       = self.emit_event,
                        )
                    if is_new:
                        new_count += 1
                except Exception as e:
                    logger.debug("행 스킵: %s — %s", e, item)

        return new_count


def _parse_price(val: str | None) -> int | None:
    if not val:
        return None
    cleaned = val.replace(",", "").strip()
    return int(cleaned) if cleaned.lstrip("-").isdigit() else None
