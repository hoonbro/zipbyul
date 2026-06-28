#!/usr/bin/env python3
"""집별 수집 엔트리포인트.

사용법:
  python collect.py              # 전체 수집 1회
  python collect.py --source applyhome  # 특정 소스만
  python collect.py --schedule   # APScheduler 데몬 모드
"""
import argparse
import logging
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent / "src"))

from jipbyul_collector.adapters.base import BaseAdapter
from jipbyul_collector.adapters.applyhome import ApplyhomeAptAdapter, ApplyhomeUnrankedAdapter
from jipbyul_collector.adapters.ecos import EcosAdapter
from jipbyul_collector.adapters.lh import LhNoticeAdapter
from jipbyul_collector.adapters.molit import MolitAdapter
from jipbyul_collector.common.db import close_pool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("collect")

_ADAPTERS = {
    "applyhome_apt":      ApplyhomeAptAdapter,
    "applyhome_unranked": ApplyhomeUnrankedAdapter,
    "lh":                 LhNoticeAdapter,
    "molit":              MolitAdapter,
    "ecos":               EcosAdapter,
}


def run_all(source_filter: str | None = None) -> None:
    with httpx.Client(timeout=30) as client:
        for name, cls in _ADAPTERS.items():
            if source_filter and source_filter not in name:
                continue
            logger.info("▶ %s 시작", name)
            cls(client).run_logged()
            logger.info("✓ %s 완료", name)


def run_scheduled() -> None:
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.triggers.interval import IntervalTrigger

    sched = BlockingScheduler(timezone="Asia/Seoul")
    # 운영자 수기 수집 잡(collection_job) 폴링 — 30초 간격
    sched.add_job(drain_collection_jobs, IntervalTrigger(seconds=30), id="manual_collect_drain")
    # 운영자 수동 SH 공고 큐(manual_announcement_queue) 폴링 — 30초 간격
    sched.add_job(drain_manual_announcements, IntervalTrigger(seconds=30), id="manual_announcement_drain")
    # 청약홈 / LH — 1일 2회 (08:00, 20:00)
    sched.add_job(lambda: run_all("applyhome"), CronTrigger(hour="8,20", minute=0))
    sched.add_job(lambda: run_all("lh"),        CronTrigger(hour="8,20", minute=5))
    # 실거래 — 1일 2회 (06:00, 18:00, 데이터량 많아 별도)
    sched.add_job(lambda: run_all("molit"),     CronTrigger(hour="6,18", minute=0))
    # ECOS — 1일 1회 (09:00)
    sched.add_job(lambda: run_all("ecos"),      CronTrigger(hour=9, minute=0))

    logger.info("스케줄러 시작 (Ctrl-C로 종료)")
    try:
        sched.start()
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        close_pool()


def drain_collection_jobs() -> None:
    """PENDING 수집 잡을 1건 집어 실행한다(운영자 수기 트리거). 스케줄러가 주기 호출."""
    from jipbyul_collector.common.db import get_conn

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, source FROM collection_job
            WHERE status = 'PENDING'
            ORDER BY requested_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            """
        ).fetchone()
        if row is None:
            return
        job_id, source = row["id"], row["source"]
        conn.execute(
            "UPDATE collection_job SET status='RUNNING', started_at=now() WHERE id=%s",
            (job_id,),
        )
        conn.commit()

    logger.info("▶ 수기 수집 잡 #%s (%s) 시작", job_id, source)
    try:
        run_all(source)
        status, message = "SUCCESS", None
    except Exception as e:  # noqa: BLE001 — 잡 실패는 기록하고 스케줄러는 계속
        status, message = "FAILED", str(e)[:500]
        logger.exception("수기 수집 잡 #%s 실패", job_id)

    with get_conn() as conn:
        conn.execute(
            "UPDATE collection_job SET status=%s, finished_at=now(), message=%s WHERE id=%s",
            (status, message, job_id),
        )
        conn.commit()
    logger.info("✓ 수기 수집 잡 #%s → %s", job_id, status)


class _ManualEmitter(BaseAdapter):
    """수동 공고 드레인 전용 — emit_event(domain_event 발행)만 재사용. 외부 호출 없음."""
    source_code = "ADMIN_MANUAL"

    def __init__(self) -> None:  # emit_event는 httpx client 불필요
        pass

    def run(self) -> int:
        return 0


def drain_manual_announcements() -> None:
    """운영자 수동 SH 공고 큐를 1건 처리. Spring은 큐에만 쓰고 본체 적재는 여기서.

    기존 upsert_announcement(이벤트 발행·캘린더 동기화) + upsert_units를 그대로 재사용한다.
    """
    from jipbyul_collector.common.db import get_conn
    from jipbyul_collector.normalize.announcement import _make_hash, upsert_announcement
    from jipbyul_collector.normalize.announcement_unit import upsert_units

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, payload FROM manual_announcement_queue
            WHERE status = 'PENDING'
            ORDER BY requested_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            """
        ).fetchone()
        if row is None:
            return
        qid, payload = row["id"], row["payload"]
        conn.execute(
            "UPDATE manual_announcement_queue SET status='RUNNING' WHERE id=%s", (qid,)
        )
        conn.commit()

    source_ref_id = f"MANUAL-{qid}"
    logger.info("▶ 수동 공고 큐 #%s (%s) 처리", qid, payload.get("supplyType"))
    try:
        upsert_announcement(
            source_code="ADMIN_MANUAL",
            source_ref_id=source_ref_id,
            pblanc_no=None,
            title=payload.get("title"),
            supply_type=payload.get("supplyType"),
            gu_name=payload.get("guName"),
            bjd_code=None,
            apply_start=payload.get("applyStart"),
            apply_end=payload.get("applyEnd"),
            winner_date=payload.get("winnerDate"),
            contract_date=payload.get("contractDate"),
            source_url=payload.get("sourceUrl"),
            summary_json={"manual": True},
            emitter=_ManualEmitter().emit_event,
            dong_name=payload.get("dongName"),
        )
        units = [
            {
                "house_type": u.get("houseType"),
                "area_m2": u.get("areaM2"),
                "supply_count": u.get("supplyCount"),
                "supply_amount_manwon": u.get("supplyAmountManwon"),
            }
            for u in (payload.get("units") or [])
        ]
        upsert_units("ADMIN_MANUAL", source_ref_id, units)

        with get_conn() as conn:
            ann = conn.execute(
                "SELECT id FROM housing_announcements WHERE dedup_hash = %s",
                (_make_hash("ADMIN_MANUAL", source_ref_id),),
            ).fetchone()
            conn.execute(
                """
                UPDATE manual_announcement_queue
                SET status='DONE', announcement_id=%s, processed_at=now() WHERE id=%s
                """,
                (ann["id"] if ann else None, qid),
            )
            conn.commit()
        logger.info("✓ 수동 공고 큐 #%s → DONE (공고 #%s)", qid, ann["id"] if ann else None)
    except Exception as e:  # noqa: BLE001 — 잡 실패는 기록하고 스케줄러는 계속
        logger.exception("수동 공고 큐 #%s 실패", qid)
        with get_conn() as conn:
            conn.execute(
                """
                UPDATE manual_announcement_queue
                SET status='FAILED', message=%s, processed_at=now() WHERE id=%s
                """,
                (str(e)[:500], qid),
            )
            conn.commit()


def backfill_calendar() -> None:
    """외부 호출 없이 기존 housing_announcements 날짜 필드에서 calendar_items 재생성."""
    from jipbyul_collector.common.db import get_conn
    from jipbyul_collector.normalize.calendar import sync_announcement_calendar

    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, gu_name, apply_start, apply_end,
                   winner_announce_date, contract_date
            FROM housing_announcements
            """
        ).fetchall()
        for r in rows:
            sync_announcement_calendar(
                conn, r["id"], r["gu_name"], r["apply_start"], r["apply_end"],
                r["winner_announce_date"], r["contract_date"],
            )
    logger.info("calendar 백필 완료: 공고 %d건", len(rows))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--source", help="특정 소스만 실행 (applyhome/lh/molit/ecos)")
    p.add_argument("--schedule", action="store_true", help="스케줄러 데몬 모드")
    p.add_argument("--backfill-calendar", action="store_true",
                   help="기존 공고에서 calendar_items 재생성 (외부 호출 없음)")
    args = p.parse_args()

    if args.backfill_calendar:
        backfill_calendar()
        close_pool()
    elif args.schedule:
        run_scheduled()
    else:
        run_all(args.source)
        close_pool()


if __name__ == "__main__":
    main()
