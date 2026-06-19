"""청약홈 APT 분양정보 + 무순위·잔여세대 어댑터 (odcloud)."""
import logging

import httpx

from ..common.settings import SERVICE_KEY
from ..normalize.announcement import upsert_announcement
from .base import BaseAdapter

logger = logging.getLogger(__name__)

# supply_type 매핑 (주택구분코드명 → contracts/enums.yaml supply_type)
_SUPPLY_TYPE_MAP = {
    "APT":          "PRIVATE_SALE",
    "오피스텔":     "OFFICETEL",
    "도시형":       "OFFICETEL",
    "공공분양":     "PUBLIC_SALE",
    "신혼희망타운": "PUBLIC_SALE",
    "국민임대":     "NATIONAL_RENTAL",
    "행복주택":     "HAPPY_HOUSE",
    "무순위":       "UNRANKED",
    "잔여세대":     "UNRANKED",
    "불법행위":     "UNRANKED",
}

_SEOUL_REGION_CODE = "100"

# odcloud 엔드포인트
_APT_URL     = ("https://api.odcloud.kr/api/15101046/v1"
                "/uddi:14a46595-03dd-47d3-a418-d64e52820598")
_UNRANKED_URL = ("https://api.odcloud.kr/api/15128105/v1"
                 "/uddi:d084bc01-f419-45ac-8555-bcd270c4b656")


def _map_supply(raw_name: str | None) -> str:
    if not raw_name:
        return "PRIVATE_SALE"
    for k, v in _SUPPLY_TYPE_MAP.items():
        if k in raw_name:
            return v
    return "PRIVATE_SALE"


def _fetch_all_pages(client: httpx.Client, url: str, extra: dict) -> list[dict]:
    items, page, per_page = [], 1, 100
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
        batch = d.get("data", [])
        items.extend(batch)
        if len(batch) < per_page:
            break
        page += 1
    return items


class ApplyhomeAptAdapter(BaseAdapter):
    source_code = "APPLYHOME_APT"

    def run(self) -> int:
        # 서울만 (공급지역코드=100)
        items = _fetch_all_pages(self.client, _APT_URL,
                                 {"cond[공급지역코드::EQ]": _SEOUL_REGION_CODE})
        count = 0
        for item in items:
            is_new = upsert_announcement(
                source_code   = self.source_code,
                source_ref_id = item["공고번호"],
                pblanc_no     = item.get("공고번호"),
                title         = item.get("주택명", ""),
                supply_type   = _map_supply(item.get("주택구분코드명")),
                gu_name       = _gu_from_addr(item.get("공급위치", "")),
                bjd_code      = None,
                apply_start   = item.get("청약접수시작일"),
                apply_end     = item.get("청약접수종료일"),
                winner_date   = item.get("당첨자발표일"),
                contract_date = item.get("계약시작일"),
                source_url    = item.get("모집공고홈페이지주소"),
                summary_json  = {
                    "공급규모":  item.get("공급규모"),
                    "입주예정월": item.get("입주예정월"),
                    "사업주체":  item.get("사업주체명_시행사"),
                },
                emitter       = self.emit_event,
            )
            if is_new:
                count += 1
        logger.info("[%s] %d건 upsert (신규 %d)", self.source_code, len(items), count)
        return count


class ApplyhomeUnrankedAdapter(BaseAdapter):
    source_code = "APPLYHOME_UNRANKED"

    def run(self) -> int:
        items = _fetch_all_pages(self.client, _UNRANKED_URL, {})
        # 무순위는 공급지역코드 없음 → 공급위치 텍스트로 서울 필터
        seoul_items = [i for i in items if "서울" in (i.get("공급위치") or "")]
        count = 0
        for item in seoul_items:
            is_new = upsert_announcement(
                source_code   = self.source_code,
                source_ref_id = item["공고번호"],
                pblanc_no     = item.get("공고번호"),
                title         = item.get("주택명", ""),
                supply_type   = _map_supply(item.get("주택구분코드명")),
                gu_name       = _gu_from_addr(item.get("공급위치", "")),
                bjd_code      = None,
                apply_start   = item.get("일반공급접수시작일") or item.get("청약접수시작일"),
                apply_end     = item.get("일반공급접수종료일") or item.get("청약접수종료일"),
                winner_date   = item.get("당첨자발표일"),
                contract_date = item.get("계약시작일"),
                source_url    = item.get("모집공고홈페이지주소"),
                summary_json  = {"공급위치": item.get("공급위치")},
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
