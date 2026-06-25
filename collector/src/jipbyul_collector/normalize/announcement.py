"""housing_announcements 정규화 + upsert + domain_event 발행."""
import hashlib
import logging
from datetime import date, datetime

from ..common.db import get_conn
from .calendar import sync_announcement_calendar

logger = logging.getLogger(__name__)

# base_score (기획안 6-1)
_SCORE = {
    "ANNOUNCEMENT_NEW":     2,
    "APPLICATION_START":    2,
    "APPLICATION_DEADLINE": 3,
    "WINNER_ANNOUNCEMENT":  1,
    "CONTRACT":             1,
    "DOCUMENT_SUBMIT":      1,
}


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _make_hash(*parts) -> str:
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()


def upsert_announcement(
    source_code: str,
    source_ref_id: str,
    pblanc_no: str | None,
    title: str,
    supply_type: str,
    gu_name: str | None,
    bjd_code: str | None,
    apply_start: str | None,
    apply_end: str | None,
    winner_date: str | None,
    contract_date: str | None,
    source_url: str | None,
    summary_json: dict,
    emitter,  # BaseAdapter.emit_event
    price_cap_yn: bool | None = None,  # 분양가상한제 (로또 단서). 안전마진 §2-1
) -> bool:
    """
    Returns True if this was a new INSERT (→ ANNOUNCEMENT_NEW 이벤트 발행).
    """
    dedup_hash = _make_hash(source_code, source_ref_id)

    apply_start_d  = _parse_date(apply_start)
    apply_end_d    = _parse_date(apply_end)
    winner_d       = _parse_date(winner_date)
    contract_d     = _parse_date(contract_date)

    from psycopg.types.json import Jsonb

    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO housing_announcements
                (source_code, source_ref_id, pblanc_no, title, supply_type,
                 gu_name, bjd_code, apply_start, apply_end,
                 winner_announce_date, contract_date,
                 source_url, summary_json, price_cap_yn, dedup_hash)
            VALUES
                (%s, %s, %s, %s, %s,
                 %s, %s, %s, %s,
                 %s, %s,
                 %s, %s, %s, %s)
            ON CONFLICT (dedup_hash) DO UPDATE
                SET title        = EXCLUDED.title,
                    apply_start  = EXCLUDED.apply_start,
                    apply_end    = EXCLUDED.apply_end,
                    price_cap_yn = EXCLUDED.price_cap_yn,
                    updated_at   = now()
            RETURNING id, (xmax = 0) AS is_insert
            """,
            (
                source_code, source_ref_id, pblanc_no, title, supply_type,
                gu_name, bjd_code, apply_start_d, apply_end_d,
                winner_d, contract_d,
                source_url, Jsonb(summary_json), price_cap_yn, dedup_hash,
            ),
        ).fetchone()

        ann_id    = row["id"]
        is_insert = row["is_insert"]

        today = date.today()

        if is_insert:
            # 신규 공고
            emitter(conn, "ANNOUNCEMENT_NEW", "ANNOUNCEMENT", ann_id,
                    gu_name, bjd_code, _SCORE["ANNOUNCEMENT_NEW"], f"ANN_NEW:{dedup_hash}")

        # 접수시작 D-day 이벤트 (날짜 기반, 미래 예약)
        if apply_start_d and apply_start_d >= today:
            emitter(conn, "APPLICATION_START", "ANNOUNCEMENT", ann_id,
                    gu_name, bjd_code, _SCORE["APPLICATION_START"],
                    f"APP_START:{dedup_hash}",
                    scheduled_at=str(apply_start_d))

        # 마감임박 D-3 (접수마감 3일 이전 ~ 당일)
        if apply_end_d:
            delta = (apply_end_d - today).days
            if 0 <= delta <= 3:
                emitter(conn, "APPLICATION_DEADLINE", "ANNOUNCEMENT", ann_id,
                        gu_name, bjd_code, _SCORE["APPLICATION_DEADLINE"],
                        f"APP_END:{dedup_hash}")

        # 당첨자 발표 (해당일 예약 발행)
        if winner_d and winner_d >= today:
            emitter(conn, "WINNER_ANNOUNCEMENT", "ANNOUNCEMENT", ann_id,
                    gu_name, bjd_code, _SCORE["WINNER_ANNOUNCEMENT"],
                    f"WINNER:{dedup_hash}",
                    scheduled_at=str(winner_d))

        # 계약 (해당일 예약 발행)
        if contract_d and contract_d >= today:
            emitter(conn, "CONTRACT", "ANNOUNCEMENT", ann_id,
                    gu_name, bjd_code, _SCORE["CONTRACT"],
                    f"CONTRACT:{dedup_hash}",
                    scheduled_at=str(contract_d))

        # 통합 캘린더 동기화 (날짜 필드 → calendar_items, 멱등)
        sync_announcement_calendar(
            conn, ann_id, gu_name, apply_start_d, apply_end_d, winner_d, contract_d
        )

        return is_insert
