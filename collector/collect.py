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

    sched = BlockingScheduler(timezone="Asia/Seoul")
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
