"""real_estate_transactions 정규화 + upsert + TRANSACTION_NEW 이벤트."""
import hashlib
import logging
from datetime import date, datetime

logger = logging.getLogger(__name__)


def _make_hash(*parts) -> str:
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()


def _parse_price(val: str | None) -> int | None:
    if not val:
        return None
    return int(val.replace(",", "").strip())


def _parse_rgst_date(val: str | None) -> date | None:
    """YY.MM.DD → date. 공백/None → None."""
    if not val or not val.strip():
        return None
    try:
        return datetime.strptime(val.strip(), "%y.%m.%d").date()
    except ValueError:
        return None


def upsert_transaction(
    conn,
    source_code: str,
    bjd_code: str,
    gu_name: str,
    dong_name: str | None,
    complex_name: str | None,
    trade_type: str,      # SALE / JEONSE / MONTHLY
    area_m2: float | None,
    floor: int | None,
    price_manwon: int | None,
    contract_year: int,
    contract_month: int,
    contract_day: int,
    rgst_date_str: str | None,
    emitter,
    build_year: int | None = None,  # 연식(안전마진 신축 보정, V10)
) -> bool:
    """
    Returns True if INSERT (신규 등록 → TRANSACTION_NEW 발행).
    """
    contract_date = date(contract_year, contract_month, contract_day)
    contract_month_str = f"{contract_year}-{contract_month:02d}"

    dedup_hash = _make_hash(
        bjd_code,
        complex_name or "",
        str(area_m2 or ""),
        str(contract_date),
        str(floor or ""),
        str(price_manwon or ""),
        trade_type,
    )

    registered_at = _parse_rgst_date(rgst_date_str)

    row = conn.execute(
        """
        INSERT INTO real_estate_transactions
            (source_code, bjd_code, gu_name, dong_name, complex_name,
             trade_type, area_m2, floor, price_manwon,
             contract_date, contract_month, registered_at, build_year, dedup_hash)
        VALUES
            (%s, %s, %s, %s, %s,
             %s, %s, %s, %s,
             %s, %s, %s, %s, %s)
        ON CONFLICT (dedup_hash) DO UPDATE
            SET build_year = EXCLUDED.build_year
        RETURNING id, (xmax = 0) AS is_insert
        """,
        (
            source_code, bjd_code, gu_name, dong_name, complex_name,
            trade_type, area_m2, floor, price_manwon,
            contract_date, contract_month_str, registered_at, build_year, dedup_hash,
        ),
    ).fetchone()

    if row is None:
        return False

    tx_id     = row["id"]
    is_insert = row["is_insert"]

    if is_insert:
        emitter(conn, "TRANSACTION_NEW", "TRANSACTION", tx_id,
                gu_name, bjd_code, 1, f"TX_NEW:{dedup_hash}")

    return is_insert
