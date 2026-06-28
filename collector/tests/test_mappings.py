"""순수 매핑/파싱 헬퍼 테스트 (외부 의존 없음)."""
from datetime import date

from jipbyul_collector.adapters.applyhome import (
    _gu_from_addr,
    _map_mdl_unit,
    _map_supply,
    _pblpvtrent_fields,
    _price_cap,
)
from jipbyul_collector.adapters.lh import _map_supply as lh_map_supply
from jipbyul_collector.normalize.announcement import _make_hash, _parse_date


def test_gu_from_addr_extracts_seoul_district():
    assert _gu_from_addr("서울특별시 마포구 합정동 123") == "마포구"
    assert _gu_from_addr("서울특별시 강동구 천호동") == "강동구"


def test_gu_from_addr_returns_none_for_non_seoul():
    assert _gu_from_addr("경기도 구리시 갈매동") is None
    assert _gu_from_addr("") is None


def test_applyhome_supply_mapping():
    assert _map_supply("APT") == "PRIVATE_SALE"
    assert _map_supply("오피스텔") == "OFFICETEL"
    assert _map_supply("무순위") == "UNRANKED"
    assert _map_supply("공공분양") == "PUBLIC_SALE"
    assert _map_supply(None) == "PRIVATE_SALE"


def test_lh_supply_mapping():
    assert lh_map_supply({"AIS_TP_CD_NM": "행복주택"}) == "HAPPY_HOUSE"
    assert lh_map_supply({"AIS_TP_CD_NM": "매입임대"}) == "PURCHASE_RENTAL"
    assert lh_map_supply({"AIS_TP_CD_NM": "전세임대"}) == "JEONSE_RENTAL"
    assert lh_map_supply({"UPP_AIS_TP_CD": "05"}) == "PUBLIC_SALE"
    assert lh_map_supply({}) == "HAPPY_HOUSE"


def test_parse_date_formats():
    assert _parse_date("2026-05-07") == date(2026, 5, 7)
    assert _parse_date("20260507") == date(2026, 5, 7)
    assert _parse_date("2026.05.07") == date(2026, 5, 7)
    assert _parse_date(None) is None
    assert _parse_date("not-a-date") is None


def test_map_mdl_unit_extracts_fields_manwon():
    # area_m2는 SUPLY_AR(공급면적)이 아니라 HOUSE_TY에서 전용면적을 파싱한다.
    row = {
        "PBLANC_NO": "2025000585",
        "HOUSE_TY": "059.9500A",
        "SUPLY_AR": "89.94",  # 공급면적 — 무시됨
        "SUPLY_HSHLDCO": "120",
        "LTTOT_TOP_AMOUNT": "65000",  # 분양최고금액, 만원 단위 그대로
    }
    assert _map_mdl_unit(row) == {
        "house_type": "059.9500A",
        "area_m2": 59.95,
        "supply_count": 120,
        "supply_amount_manwon": 65000,
    }


def test_map_mdl_unit_handles_missing_and_commas():
    out = _map_mdl_unit({"HOUSE_TY": "084.9941B", "LTTOT_TOP_AMOUNT": "1,250,000"})
    assert out["house_type"] == "084.9941B"
    assert out["supply_amount_manwon"] == 1250000
    assert out["area_m2"] == 84.9941
    assert out["supply_count"] is None
    # 주택형 없으면 전용 파싱 불가 → None
    assert _map_mdl_unit({})["area_m2"] is None


def test_pblpvtrent_fields_maps_youth_safe_house():
    item = {
        "PBLANC_NO": "2025850026",
        "HOUSE_NM": "서울은평뉴타운 디에트르 더 퍼스트(3-14BL)",
        "HSSPLY_ADRES": "서울특별시 은평구 진관동 144",
        "SUBSCRPT_RCEPT_BGNDE": "20250916",
        "SUBSCRPT_RCEPT_ENDDE": "20250917",
        "PRZWNER_PRESNATN_DE": "20250922",
        "RCRIT_PBLANC_DE": "20250911",
        "TOT_SUPLY_HSHLDCO": "4",
        "PBLANC_URL": "https://www.applyhome.co.kr/x",
    }
    out = _pblpvtrent_fields(item)
    assert out["supply_type"] == "YOUTH_SAFE_HOUSE"  # 공공지원민간임대 → 청년안심주택
    assert out["gu_name"] == "은평구"
    assert out["dong_name"] == "진관동"
    assert out["source_ref_id"] == "2025850026"
    assert out["apply_start"] == "20250916"
    assert out["apply_end"] == "20250917"
    assert out["winner_date"] == "20250922"
    assert out["source_url"] == "https://www.applyhome.co.kr/x"


def test_price_cap_accepts_english_and_korean_keys():
    assert _price_cap({"PARCPRC_ULS_AT": "Y"}) is True
    assert _price_cap({"PARCPRC_ULS_AT": "N"}) is False
    assert _price_cap({"분양가상한제": "Y"}) is True
    assert _price_cap({}) is None


def test_make_hash_is_deterministic_64hex():
    h1 = _make_hash("A", "B", 1)
    h2 = _make_hash("A", "B", 1)
    assert h1 == h2
    assert len(h1) == 64
    assert _make_hash("A", "B", 2) != h1
