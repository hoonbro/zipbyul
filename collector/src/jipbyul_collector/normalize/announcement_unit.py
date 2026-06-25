"""announcement_unit 정규화 + upsert (주택형별 분양가). 안전마진 §3.

필드 키와 무관한 DB 적재 계층. 어댑터가 청약홈 Mdl 응답을 내부 dict
(house_type / area_m2 / supply_count / supply_amount_manwon)로 변환해 넘긴다.
"""
import logging

from ..common.db import get_conn
from .announcement import _make_hash

logger = logging.getLogger(__name__)


def upsert_units(source_code: str, source_ref_id: str, units: list[dict]) -> int:
    """공고(dedup_hash로 조회)에 주택형 단위를 멱등 upsert. 반환 = 처리 행수.

    units: [{house_type, area_m2, supply_count, supply_amount_manwon}, ...]
    """
    if not units:
        return 0

    ann_hash = _make_hash(source_code, source_ref_id)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM housing_announcements WHERE dedup_hash = %s",
            (ann_hash,),
        ).fetchone()
        if not row:
            logger.warning("[%s] 주택형 적재 대상 공고 없음 (ref=%s)", source_code, source_ref_id)
            return 0
        ann_id = row["id"]

        count = 0
        for u in units:
            dedup_hash = _make_hash(ann_id, u.get("house_type"), u.get("area_m2"))
            conn.execute(
                """
                INSERT INTO announcement_unit
                    (announcement_id, house_type, area_m2,
                     supply_count, supply_amount_manwon, dedup_hash)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (dedup_hash) DO UPDATE
                    SET supply_count         = EXCLUDED.supply_count,
                        supply_amount_manwon = EXCLUDED.supply_amount_manwon,
                        collected_at         = now()
                """,
                (
                    ann_id,
                    u.get("house_type"),
                    u.get("area_m2"),
                    u.get("supply_count"),
                    u.get("supply_amount_manwon"),
                    dedup_hash,
                ),
            )
            count += 1
        return count
