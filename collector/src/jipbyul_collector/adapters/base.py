"""공통 어댑터 인터페이스 + 잡 로그 래퍼."""
import hashlib
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

import httpx

from ..common.db import get_conn

logger = logging.getLogger(__name__)


class BaseAdapter(ABC):
    source_code: str  # source_registry.source_code

    def __init__(self, client: httpx.Client) -> None:
        self.client = client

    # ── 서브클래스가 구현 ──────────────────────────────────
    @abstractmethod
    def run(self) -> int:
        """수집·정규화·적재 실행. 반환값 = upsert 된 행 수."""

    # ── 잡 로그 ───────────────────────────────────────────
    def run_logged(self) -> None:
        started = datetime.now(timezone.utc)
        count, reason = 0, None
        try:
            count = self.run()
            status = "SUCCESS"
        except Exception as exc:
            status = "FAIL"
            reason = str(exc)[:300]
            logger.exception("[%s] 수집 실패", self.source_code)
        finally:
            self._write_job_log(started, status, count, reason)
            if status == "SUCCESS":
                self._mark_source_health(True)
            else:
                self._mark_source_health(False, reason)

    def _write_job_log(
        self, started: datetime, status: str, count: int, reason: str | None
    ) -> None:
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO collect_job_log
                    (source_code, status, fetched_count, failure_reason, started_at, finished_at)
                VALUES (%s, %s, %s, %s, %s, now())
                """,
                (self.source_code, status, count, reason, started),
            )

    def _mark_source_health(self, ok: bool, reason: str | None = None) -> None:
        with get_conn() as conn:
            if ok:
                conn.execute(
                    """
                    INSERT INTO source_health_status (source_code, last_success_at, display_available)
                    VALUES (%s, now(), true)
                    ON CONFLICT (source_code) DO UPDATE
                        SET last_success_at = now(), display_available = true
                    """,
                    (self.source_code,),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO source_health_status
                        (source_code, last_failure_at, last_failure_reason, display_available)
                    VALUES (%s, now(), %s, false)
                    ON CONFLICT (source_code) DO UPDATE
                        SET last_failure_at = now(),
                            last_failure_reason = EXCLUDED.last_failure_reason,
                            display_available = false
                    """,
                    (self.source_code, reason),
                )

    # ── 공통 유틸 ─────────────────────────────────────────
    def emit_event(
        self,
        conn,
        event_type: str,
        ref_type: str,
        ref_id: int,
        gu_name: str | None,
        bjd_code: str | None,
        base_score: int,
        dedup_hash: str,
        scheduled_at: str | None = None,
    ) -> None:
        """domain_event 발행 (중복 무시). dedup_hash는 64자로 해싱."""
        dedup_hash = hashlib.sha256(dedup_hash.encode()).hexdigest()
        conn.execute(
            """
            INSERT INTO domain_event
                (event_type, ref_type, ref_id, gu_name, bjd_code,
                 base_score, dedup_hash, scheduled_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, COALESCE(%s::timestamptz, now()))
            ON CONFLICT DO NOTHING
            """,
            (
                event_type, ref_type, ref_id, gu_name, bjd_code,
                base_score, dedup_hash,
                scheduled_at,
            ),
        )

    def save_raw(self, conn, payload: dict) -> None:
        conn.execute(
            "INSERT INTO raw_payload (source_code, payload) VALUES (%s, %s)",
            (self.source_code, psycopg_json(payload)),
        )


def psycopg_json(obj):
    import json as _json
    from psycopg.types.json import Jsonb
    return Jsonb(obj)
