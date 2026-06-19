"""calendar_items 동기화 — 공고 날짜 필드에서 통합 캘린더 이벤트 생성.

calendar_items엔 UNIQUE 제약이 없어, 공고별로 기존 행을 지우고 현재 날짜로
다시 넣는 delete-then-insert 방식으로 멱등성을 보장한다. (날짜 변경도 반영)
event_type은 contracts/enums.yaml을 따른다.
"""
from datetime import date


def sync_announcement_calendar(
    conn,
    ann_id: int,
    gu_name: str | None,
    apply_start: date | None,
    apply_end: date | None,
    winner_date: date | None,
    contract_date: date | None,
) -> None:
    conn.execute(
        "DELETE FROM calendar_items WHERE ref_type = 'ANNOUNCEMENT' AND ref_id = %s",
        (ann_id,),
    )
    events = (
        ("APPLICATION_START",    apply_start),
        ("APPLICATION_DEADLINE", apply_end),
        ("WINNER_ANNOUNCEMENT",  winner_date),
        ("CONTRACT",             contract_date),
    )
    for event_type, event_date in events:
        if event_date is None:
            continue
        conn.execute(
            """
            INSERT INTO calendar_items (ref_type, ref_id, event_type, gu_name, event_date)
            VALUES ('ANNOUNCEMENT', %s, %s, %s, %s)
            """,
            (ann_id, event_type, gu_name, event_date),
        )
