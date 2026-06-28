"""LH 분양임대공고 어댑터."""
import json
import logging

from ..common.db import get_conn
from ..common.settings import SERVICE_KEY
from ..normalize.announcement import upsert_announcement
from .base import BaseAdapter

logger = logging.getLogger(__name__)

_LIST_URL = ("https://apis.data.go.kr/B552555"
             "/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1")

# UPP_AIS_TP_CD → supply_type
_UPP_MAP = {
    "06": "HAPPY_HOUSE",    # 임대주택 (행복주택·국민임대·매입임대 포함)
    "05": "PUBLIC_SALE",    # 분양주택
}
# AIS_TP_CD_NM 세부 오버라이드
_DETAIL_MAP = {
    "행복주택":   "HAPPY_HOUSE",
    "국민임대":   "NATIONAL_RENTAL",
    "매입임대":   "PURCHASE_RENTAL",
    "전세임대":   "JEONSE_RENTAL",
    "공공분양":   "PUBLIC_SALE",
}

_GU_NAMES = [
    "종로구","중구","용산구","성동구","광진구","동대문구","중랑구","성북구",
    "강북구","도봉구","노원구","은평구","서대문구","마포구","양천구","강서구",
    "구로구","금천구","영등포구","동작구","관악구","서초구","강남구","송파구","강동구",
]


def _gu_from_name(cnp_cd_nm: str | None) -> str | None:
    """CNP_CD_NM(e.g. '서울특별시')는 자치구가 없어 별도 매핑 불필요 — None 반환."""
    return None


def _map_supply(item: dict) -> str:
    detail = item.get("AIS_TP_CD_NM", "")
    for k, v in _DETAIL_MAP.items():
        if k in detail:
            return v
    return _UPP_MAP.get(item.get("UPP_AIS_TP_CD", ""), "HAPPY_HOUSE")


class LhNoticeAdapter(BaseAdapter):
    source_code = "LH_NOTICE"

    def run(self) -> int:
        items, raw_pages = self._fetch_seoul()
        with get_conn() as conn:
            for payload in raw_pages:
                self.save_raw(conn, payload)
        count = 0
        for item in items:
            is_new = upsert_announcement(
                source_code   = self.source_code,
                source_ref_id = item["PAN_ID"],
                pblanc_no     = item.get("PAN_ID"),
                title         = item.get("PAN_NM", ""),
                supply_type   = _map_supply(item),
                gu_name       = None,   # LH 공고는 구 단위 미제공 (CNP_CD_NM=시도)
                bjd_code      = None,
                apply_start   = item.get("PAN_NT_ST_DT"),
                apply_end     = item.get("CLSG_DT"),
                winner_date   = None,
                contract_date = None,
                source_url    = item.get("DTL_URL"),
                summary_json  = {
                    "지역":  item.get("CNP_CD_NM"),
                    "유형":  item.get("AIS_TP_CD_NM"),
                    "상태":  item.get("PAN_SS"),
                    "공고일": item.get("PAN_DT"),
                },
                emitter       = self.emit_event,
            )
            if is_new:
                count += 1
        logger.info("[%s] 서울 %d건 (신규 %d)", self.source_code, len(items), count)
        return count

    def _fetch_seoul(self) -> tuple[list[dict], list[dict]]:
        """서울 공고만 필터링 (CNP_CD_NM 텍스트 기준). 전체 페이지 순회."""
        seoul, raw_pages, page, pg_sz = [], [], 1, 100
        while True:
            r = self.client.get(_LIST_URL, params={
                "serviceKey": SERVICE_KEY,
                "PG_SZ": pg_sz,
                "PAGE":  page,
            }, timeout=30)
            r.raise_for_status()
            # LH는 본문이 CP949인데 UTF-8로 선언될 때가 있어 폴백 디코딩.
            try:
                data = json.loads(r.content.decode("utf-8"))
            except UnicodeDecodeError:
                data = json.loads(r.content.decode("cp949"))
            raw_pages.append(data)
            batch = data[1].get("dsList", []) if isinstance(data, list) and len(data) > 1 else []
            total = int(batch[0].get("ALL_CNT", 0)) if batch else 0

            seoul.extend(i for i in batch if "서울" in (i.get("CNP_CD_NM") or ""))

            if page * pg_sz >= total:
                break
            page += 1
        return seoul, raw_pages
