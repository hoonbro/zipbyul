"""운영자 수동 SH 공고 큐 드레인 테스트 (DB·정규화 함수는 가짜로 대체).

drain_manual_announcements는 큐를 1건 클레임해 기존 upsert_announcement 경로로
적재하고 PENDING→RUNNING→DONE(또는 실패 시 FAILED)으로 전이시킨다.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))  # collect.py 임포트용

import collect  # noqa: E402


class FakeConn:
    """get_conn() 컨텍스트매니저 + execute/fetchone/commit 흉내. 호출 SQL을 기록한다."""

    def __init__(self, pending_row):
        self._pending = pending_row
        self.executed = []
        self._last_sql = ""

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        self._last_sql = sql
        return self

    def fetchone(self):
        if "manual_announcement_queue" in self._last_sql and "PENDING" in self._last_sql:
            return self._pending
        if "housing_announcements" in self._last_sql and "dedup_hash" in self._last_sql:
            return {"id": 99}
        return None

    def commit(self):
        pass


def _patch_normalize(monkeypatch, conn, upsert_announcement):
    monkeypatch.setattr("jipbyul_collector.common.db.get_conn", lambda: conn)
    monkeypatch.setattr(
        "jipbyul_collector.normalize.announcement.upsert_announcement", upsert_announcement
    )
    monkeypatch.setattr("jipbyul_collector.normalize.announcement._make_hash", lambda *a: "h")
    monkeypatch.setattr(
        "jipbyul_collector.normalize.announcement_unit.upsert_units", lambda *a: None
    )


def _sql_text(conn):
    return " ".join(s for s, _ in conn.executed)


def test_drain_done_path(monkeypatch):
    payload = {
        "title": "역삼 청년안심주택",
        "supplyType": "YOUTH_SAFE_HOUSE",
        "guName": "강남구",
        "units": [{"houseType": "29A", "areaM2": 29.5, "supplyCount": 10, "supplyAmountManwon": 30000}],
    }
    conn = FakeConn({"id": 7, "payload": payload})
    captured = {}
    _patch_normalize(monkeypatch, conn, lambda **kw: captured.update(kw))

    collect.drain_manual_announcements()

    sqls = _sql_text(conn)
    assert "RUNNING" in sqls
    assert "DONE" in sqls
    assert "FAILED" not in sqls
    assert captured["source_code"] == "ADMIN_MANUAL"
    assert captured["supply_type"] == "YOUTH_SAFE_HOUSE"
    assert captured["source_ref_id"] == "MANUAL-7"


def test_drain_failed_path_records_reason(monkeypatch):
    def boom(**kw):
        raise RuntimeError("적재 실패")

    conn = FakeConn({"id": 8, "payload": {"supplyType": "LONG_TERM_JEONSE"}})
    _patch_normalize(monkeypatch, conn, boom)

    collect.drain_manual_announcements()  # 예외를 삼키고 FAILED로 기록

    sqls = _sql_text(conn)
    assert "RUNNING" in sqls
    assert "FAILED" in sqls
    assert "DONE" not in sqls
    failed = [p for s, p in conn.executed if "FAILED" in s]
    assert "적재 실패" in failed[0][0]  # 실패 사유가 message로 저장


def test_drain_noop_when_queue_empty(monkeypatch):
    conn = FakeConn(None)
    _patch_normalize(monkeypatch, conn, lambda **kw: None)

    collect.drain_manual_announcements()

    sqls = _sql_text(conn)
    assert "RUNNING" not in sqls
    assert "DONE" not in sqls
    assert len(conn.executed) == 1  # SELECT만 수행
