"""calendar_items 동기화 로직 테스트 (가짜 커넥션으로 SQL 호출 검증)."""
from datetime import date

from jipbyul_collector.normalize.calendar import sync_announcement_calendar


class FakeConn:
    def __init__(self):
        self.calls = []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        return self


def test_sync_deletes_then_inserts_present_dates():
    conn = FakeConn()
    sync_announcement_calendar(
        conn, ann_id=1, gu_name="마포구",
        apply_start=date(2026, 5, 1), apply_end=date(2026, 5, 10),
        winner_date=None, contract_date=date(2026, 6, 1),
    )
    assert "DELETE FROM calendar_items" in conn.calls[0][0]
    inserts = [c for c in conn.calls[1:] if "INSERT INTO calendar_items" in c[0]]
    event_types = {c[1][1] for c in inserts}  # params = (ann_id, event_type, gu_name, event_date)
    assert event_types == {"APPLICATION_START", "APPLICATION_DEADLINE", "CONTRACT"}
    assert "WINNER_ANNOUNCEMENT" not in event_types  # winner_date=None → skip


def test_sync_skips_all_when_no_dates():
    conn = FakeConn()
    sync_announcement_calendar(conn, 1, None, None, None, None, None)
    assert "DELETE FROM calendar_items" in conn.calls[0][0]
    assert all("INSERT" not in sql for sql, _ in conn.calls[1:])
