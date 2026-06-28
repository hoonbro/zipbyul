"""청약홈 APT 분양정보 + 무순위·잔여세대 어댑터 (실시간 ApplyhomeInfoDetailSvc).

서비스: 한국부동산원_청약홈 분양정보 조회 서비스 (data.go.kr 15098547).
정적 uddi 파일(15101046/15128105)은 업로드 시점 스냅샷이라 신규 공고가
갱신되지 않아, 실제 청약홈 DB와 연동된 실시간 REST 엔드포인트로 전환.
"""
import logging
import re

import httpx

from ..common.db import get_conn
from ..common.settings import SERVICE_KEY
from ..normalize.announcement import upsert_announcement
from ..normalize.announcement_unit import upsert_units
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
_BASE             = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1"
_APT_URL          = f"{_BASE}/getAPTLttotPblancDetail"
_UNRANKED_URL     = f"{_BASE}/getRemndrLttotPblancDetail"
# 공공지원민간임대(청년안심주택 포함) — 같은 서비스(15098547)·같은 서비스키
_PBLPVTRENT_URL   = f"{_BASE}/getPblPvtRentLttotPblancDetail"
# 주택형별 분양가(안전마진 §2-2). 헤더와 같은 서비스(15098547), 같은 서비스키.
_APT_MDL_URL      = f"{_BASE}/getAPTLttotPblancMdl"
_UNRANKED_MDL_URL = f"{_BASE}/getRemndrLttotPblancMdl"

# 청약홈 ApplyhomeInfoDetailSvc 주택형별(Mdl) 표준 필드. 안전마진 §3·§8.
# 분양가 LTTOT_TOP_AMOUNT(분양최고금액)는 이 API에서 만원 단위 → 그대로 적재.
# 첫 라이브 실행 때 키만 sanity-check(틀려도 NULL→'산출 불가'로 비활성).
_MDL_FIELDS = {
    "pblanc_no":            "PBLANC_NO",
    "house_type":           "HOUSE_TY",         # 주택형 (예: 059.9500A) — 전용면적 내장
    "supply_count":         "SUPLY_HSHLDCO",     # 공급세대수
    "supply_amount_manwon": "LTTOT_TOP_AMOUNT",  # 분양최고금액(만원)
}
# 주의: SUPLY_AR은 전용이 아니라 '공급면적'이라 매칭에 부적합 → area_m2는 HOUSE_TY에서 전용 파싱.


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
                dong_name     = _dong_from_addr(item.get("HSSPLY_ADRES")),
                complex_norm  = _complex_norm(item.get("HOUSE_NM")),
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
                price_cap_yn  = _price_cap(item),
            )
            if is_new:
                count += 1

        seoul_pnos = {str(i["PBLANC_NO"]) for i in seoul_items}
        unit_count = _collect_units(self.client, _APT_MDL_URL, self.source_code, seoul_pnos)
        logger.info("[%s] 서울 %d/%d건 upsert (신규 %d), 주택형 %d건",
                    self.source_code, len(seoul_items), len(items), count, unit_count)
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
                dong_name     = _dong_from_addr(item.get("HSSPLY_ADRES")),
                complex_norm  = _complex_norm(item.get("HOUSE_NM")),
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
                price_cap_yn  = _price_cap(item),
            )
            if is_new:
                count += 1

        seoul_pnos = {str(i["PBLANC_NO"]) for i in seoul_items}
        unit_count = _collect_units(self.client, _UNRANKED_MDL_URL, self.source_code, seoul_pnos)
        logger.info("[%s] 서울 %d/%d건 (신규 %d), 주택형 %d건",
                    self.source_code, len(seoul_items), len(items), count, unit_count)
        return count


def _pblpvtrent_fields(item: dict) -> dict:
    """공공지원민간임대 한 행 → upsert_announcement 인자(dict). 순수 함수(테스트용).

    HOUSE_SECD_NM은 전부 '공공지원민간임대'. 청년안심주택은 그 부분집합이라
    가장 근접한 관심유형인 YOUTH_SAFE_HOUSE로 묶는다(부록 A 매핑 규칙).
    임대라 분양가상한제·주택형(Mdl)은 적재하지 않는다.
    """
    return {
        "source_ref_id": item["PBLANC_NO"],
        "pblanc_no":     item.get("PBLANC_NO"),
        "title":         item.get("HOUSE_NM", ""),
        "supply_type":   "YOUTH_SAFE_HOUSE",
        "gu_name":       _gu_from_addr(item.get("HSSPLY_ADRES", "")),
        "dong_name":     _dong_from_addr(item.get("HSSPLY_ADRES")),
        "complex_norm":  _complex_norm(item.get("HOUSE_NM")),
        "apply_start":   item.get("SUBSCRPT_RCEPT_BGNDE"),
        "apply_end":     item.get("SUBSCRPT_RCEPT_ENDDE"),
        "winner_date":   item.get("PRZWNER_PRESNATN_DE"),
        "contract_date": item.get("CNTRCT_CNCLS_BGNDE"),
        "source_url":    item.get("PBLANC_URL"),
        "summary_json":  {
            "공급규모":   item.get("TOT_SUPLY_HSHLDCO"),
            "모집공고일": item.get("RCRIT_PBLANC_DE"),
            "사업주체":   item.get("BSNS_MBY_NM"),
        },
    }


class ApplyhomePblPvtRentAdapter(BaseAdapter):
    """청약홈 공공지원민간임대(청년안심주택 포함) — getPblPvtRentLttotPblancDetail.

    장기전세는 청약홈에 없어(SH 자체 시스템) 수기 큐로만 입력된다.
    """
    source_code = "APPLYHOME_PBLPVTRENT"

    def run(self) -> int:
        items, raw_pages = _fetch_all_pages(self.client, _PBLPVTRENT_URL, {})
        with get_conn() as conn:
            for payload in raw_pages:
                self.save_raw(conn, payload)
        seoul_items = [i for i in items if _is_seoul(i)]
        count = 0
        for item in seoul_items:
            is_new = upsert_announcement(
                source_code = self.source_code,
                bjd_code    = None,
                emitter     = self.emit_event,
                **_pblpvtrent_fields(item),
            )
            if is_new:
                count += 1
        logger.info("[%s] 서울 %d/%d건 upsert (신규 %d)",
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


def _dong_from_addr(addr: str | None) -> str | None:
    """주소에서 법정동명 파싱 (실거래 dong_name과 동일 텍스트로 매칭). 첫 'OO동'."""
    if not addr:
        return None
    m = re.search(r"([가-힣]+동)", addr)
    return m.group(1) if m else None


def _complex_norm(name: str | None) -> str | None:
    """단지명 정규화 — 공백·괄호·숫자·'차' 제거. V10 함수형 인덱스 규칙과 동일."""
    if not name:
        return None
    norm = re.sub(r"[\s()0-9차]", "", name)
    return norm or None


def _price_cap(item: dict) -> bool | None:
    """헤더 분양가상한제 적용여부 → bool. 영문 PARCPRC_ULS_AT / 한글 '분양가상한제' 둘 다 허용."""
    for key in ("PARCPRC_ULS_AT", "분양가상한제"):
        v = item.get(key)
        if v is not None:
            return str(v).strip().upper().startswith("Y")
    return None


def _to_num(v) -> float | None:
    if v in (None, ""):
        return None
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return None


def _to_int(v) -> int | None:
    n = _to_num(v)
    return int(n) if n is not None else None


def _area_from_house_type(house_type: str | None) -> float | None:
    """주택형 코드(예: 059.9500A)에서 전용면적 파싱. SUPLY_AR은 공급면적이라 매칭에 부적합."""
    if not house_type:
        return None
    m = re.match(r"\d+\.?\d*", house_type.strip())
    return float(m.group()) if m else None


def _map_mdl_unit(row: dict) -> dict:
    """청약홈 Mdl 한 행 → announcement_unit 내부 dict. 키는 _MDL_FIELDS로 격리."""
    f = _MDL_FIELDS
    return {
        "house_type":           row.get(f["house_type"]),
        "area_m2":              _area_from_house_type(row.get(f["house_type"])),
        "supply_count":         _to_int(row.get(f["supply_count"])),
        "supply_amount_manwon": _to_int(row.get(f["supply_amount_manwon"])),
    }


def _collect_units(client: httpx.Client, mdl_url: str, source_code: str,
                   valid_pblanc_nos: set[str]) -> int:
    """Mdl 응답을 공고번호로 묶어 announcement_unit upsert. 서울 공고만 적재."""
    rows, _ = _fetch_all_pages(client, mdl_url, {})
    by_pblanc: dict[str, list[dict]] = {}
    for r in rows:
        pno = r.get(_MDL_FIELDS["pblanc_no"])
        if pno is None:
            continue
        by_pblanc.setdefault(str(pno), []).append(r)

    total = 0
    for pno, raws in by_pblanc.items():
        if pno not in valid_pblanc_nos:
            continue
        total += upsert_units(source_code, pno, [_map_mdl_unit(r) for r in raws])
    return total
