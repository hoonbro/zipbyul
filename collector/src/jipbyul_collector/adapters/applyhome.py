"""청약홈 APT 분양정보 + 무순위·잔여세대 어댑터 (실시간 ApplyhomeInfoDetailSvc).

서비스: 한국부동산원_청약홈 분양정보 조회 서비스 (data.go.kr 15098547).
정적 uddi 파일(15101046/15128105)은 업로드 시점 스냅샷이라 신규 공고가
갱신되지 않아, 실제 청약홈 DB와 연동된 실시간 REST 엔드포인트로 전환.
"""
import logging

import httpx

from ..common.db import get_conn
from ..common.settings import SERVICE_KEY
from ..normalize.announcement import upsert_announcement
from .base import BaseAdapter

logger = logging.getLogger(__name__)

# supply_type 매핑 (주택구분명/상세구분명 → contracts/enums.yaml supply_type)
_SUPPLY_TYPE_MAP = {
    "APT":          "PRIVATE_SALE",
    "민영":         "PRIVATE_SALE",
    "공공분양":     "PUBLIC_SALE",
    "공공":         "PUBLIC_SALE",
    "오피스텔":     "OFFICETEL",
    "도시형":       "OFFICETEL",
    "신혼희망타운": "PUBLIC_SALE",
    "국민임대":     "NATIONAL_RENTAL",
    "행복주택":     "HAPPY_HOUSE",
    "무순위":       "UNRANKED",
    "잔여세대":     "UNRANKED",
    "불법행위":     "UNRANKED",
}

# 실시간 ApplyhomeInfoDetailSvc 엔드포인트
_BASE         = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1"
_APT_URL      = f"{_BASE}/getAPTLttotPblancDetail"
_UNRANKED_URL = f"{_BASE}/getRemndrLttotPblancDetail"


def _is_seoul(item: dict) -> bool:
    """공급지역명에 '서울' 포함 여부 (다지역 공고 '경기,서울,인천' 포함)."""
    return "서울" in (item.get("SUBSCRPT_AREA_CODE_NM") or "")


def _map_supply(raw_name: str | None) -> str:
    if not raw_name:
        return "PRIVATE_SALE"
    for k, v in _SUPPLY_TYPE_MAP.items():
        if k in raw_name:
            return v
    return "PRIVATE_SALE"


def _fetch_all_pages(client: httpx.Client, url: str, extra: dict) -> tuple[list[dict], list[dict]]:
    items, raw_pages, page, per_page = [], [], 1, 1000
    while True:
        r = client.get(url, params={
            "serviceKey": SERVICE_KEY,
            "page":       page,
            "perPage":    per_page,
            "returnType": "json",
            **extra,
        }, timeout=30)
        r.raise_for_status()
        d = r.json()
        raw_pages.append(d)
        batch = d.get("data", [])
        items.extend(batch)
        if len(batch) < per_page:
            break
        page += 1
    return items, raw_pages


class ApplyhomeAptAdapter(BaseAdapter):
    source_code = "APPLYHOME_APT"

    def run(self) -> int:
        items, raw_pages = _fetch_all_pages(self.client, _APT_URL, {})
        with get_conn() as conn:
            for payload in raw_pages:
                self.save_raw(conn, payload)
        seoul_items = [i for i in items if _is_seoul(i)]
        count = 0
        for item in seoul_items:
            is_new = upsert_announcement(
                source_code   = self.source_code,
                source_ref_id = item["PBLANC_NO"],
                pblanc_no     = item.get("PBLANC_NO"),
                title         = item.get("HOUSE_NM", ""),
                supply_type   = _map_supply(item.get("HOUSE_DTL_SECD_NM")
                                            or item.get("HOUSE_SECD_NM")),
                gu_name       = _gu_from_addr(item.get("HSSPLY_ADRES", "")),
                bjd_code      = None,
                apply_start   = item.get("RCEPT_BGNDE"),
                apply_end     = item.get("RCEPT_ENDDE"),
                winner_date   = item.get("PRZWNER_PRESNATN_DE"),
                contract_date = item.get("CNTRCT_CNCLS_BGNDE"),
                source_url    = item.get("PBLANC_URL"),
                summary_json  = {
                    "공급규모":  item.get("TOT_SUPLY_HSHLDCO"),
                    "입주예정월": item.get("MVN_PREARNGE_YM"),
                    "사업주체":  item.get("BSNS_MBY_NM"),
                    "시공사":    item.get("CNSTRCT_ENTRPS_NM"),
                },
                emitter       = self.emit_event,
            )
            if is_new:
                count += 1
        logger.info("[%s] 서울 %d/%d건 upsert (신규 %d)",
                    self.source_code, len(seoul_items), len(items), count)
        return count


class ApplyhomeUnrankedAdapter(BaseAdapter):
    source_code = "APPLYHOME_UNRANKED"

    def run(self) -> int:
        items, raw_pages = _fetch_all_pages(self.client, _UNRANKED_URL, {})
        with get_conn() as conn:
            for payload in raw_pages:
                self.save_raw(conn, payload)
        seoul_items = [i for i in items if _is_seoul(i)]
        count = 0
        for item in seoul_items:
            is_new = upsert_announcement(
                source_code   = self.source_code,
                source_ref_id = item["PBLANC_NO"],
                pblanc_no     = item.get("PBLANC_NO"),
                title         = item.get("HOUSE_NM", ""),
                supply_type   = _map_supply(item.get("HOUSE_SECD_NM")),
                gu_name       = _gu_from_addr(item.get("HSSPLY_ADRES", "")),
                bjd_code      = None,
                apply_start   = item.get("SUBSCRPT_RCEPT_BGNDE") or item.get("GNRL_RCEPT_BGNDE"),
                apply_end     = item.get("SUBSCRPT_RCEPT_ENDDE") or item.get("GNRL_RCEPT_ENDDE"),
                winner_date   = item.get("PRZWNER_PRESNATN_DE"),
                contract_date = item.get("CNTRCT_CNCLS_BGNDE"),
                source_url    = item.get("PBLANC_URL"),
                summary_json  = {
                    "공급위치":   item.get("HSSPLY_ADRES"),
                    "총공급세대수": item.get("TOT_SUPLY_HSHLDCO"),
                },
                emitter       = self.emit_event,
            )
            if is_new:
                count += 1
        logger.info("[%s] 서울 %d/%d건 (신규 %d)",
                    self.source_code, len(seoul_items), len(items), count)
        return count


# ── helpers ───────────────────────────────────────────────────────────────────
_GU_NAMES = [
    "종로구","중구","용산구","성동구","광진구","동대문구","중랑구","성북구",
    "강북구","도봉구","노원구","은평구","서대문구","마포구","양천구","강서구",
    "구로구","금천구","영등포구","동작구","관악구","서초구","강남구","송파구","강동구",
]

def _gu_from_addr(addr: str) -> str | None:
    for gu in _GU_NAMES:
        if gu in addr:
            return gu
    return None
