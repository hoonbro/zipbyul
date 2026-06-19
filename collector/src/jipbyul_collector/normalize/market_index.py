"""market_index_snapshots upsert + MARKET_INDEX_UPDATED / RATE_DECISION 이벤트."""
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

_BAND_MAP = {
    lambda v: v < 95:  "하락전망우세",
    lambda v: v > 105: "상승전망우세",
}


def _band(value: float) -> str:
    if value < 95:
        return "하락전망우세"
    if value > 105:
        return "상승전망우세"
    return "중립"


def upsert_snapshot(
    conn,
    index_code: str,
    base_month: str,   # YYYY-MM
    value: float,
    emitter,
) -> bool:
    """Returns True if new snapshot (→ 이벤트 발행)."""
    is_rate = index_code == "BASE_RATE"
    band = None if is_rate else _band(value)

    row = conn.execute(
        """
        INSERT INTO market_index_snapshots (index_code, base_month, value, band)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (index_code, base_month) DO NOTHING
        RETURNING id, (xmax = 0) AS is_insert
        """,
        (index_code, base_month, value, band),
    ).fetchone()

    if row is None:
        return False

    is_insert = row["is_insert"]
    snap_id   = row["id"]

    if is_insert:
        if is_rate:
            emitter(conn, "RATE_DECISION", "MARKET_INDEX", snap_id,
                    None, None, 3, f"RATE:{base_month}:{value}")
        else:
            emitter(conn, "MARKET_INDEX_UPDATED", "MARKET_INDEX", snap_id,
                    "서울", None, 1, f"CSI:{base_month}:{value}")

    return is_insert
