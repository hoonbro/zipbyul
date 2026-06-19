"""순수 매핑/파싱 헬퍼 테스트 (외부 의존 없음)."""
from datetime import date

from jipbyul_collector.adapters.applyhome import _gu_from_addr, _map_supply
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


def test_make_hash_is_deterministic_64hex():
    h1 = _make_hash("A", "B", 1)
    h2 = _make_hash("A", "B", 1)
    assert h1 == h2
    assert len(h1) == 64
    assert _make_hash("A", "B", 2) != h1
