"""ECOS 서울 주택가격전망 CSI + 기준금리 어댑터."""
import logging
from datetime import date

from ..common.settings import ECOS_KEY
from ..normalize.market_index import upsert_snapshot
from .base import BaseAdapter

logger = logging.getLogger(__name__)

_BASE = f"https://ecos.bok.or.kr/api/StatisticSearch/{ECOS_KEY}/json/kr"

# 최근 N개월 조회 범위
def _period() -> tuple[str, str]:
    today = date.today()
    end   = f"{today.year}{today.month:02d}"
    y, m  = today.year, today.month - 11
    if m <= 0:
        m, y = m + 12, y - 1
    start = f"{y}{m:02d}"
    return start, end


class EcosAdapter(BaseAdapter):
    source_code = "ECOS"

    def run(self) -> int:
        start, end = _period()
        new_count = 0
        new_count += self._collect_csi(start, end)
        new_count += self._collect_base_rate(start, end)
        logger.info("[ECOS] 신규 스냅샷 %d건", new_count)
        return new_count

    def _collect_csi(self, start: str, end: str) -> int:
        """서울 주택가격전망 CSI: 511Y002 / FMFB / F0001"""
        url  = f"{_BASE}/1/100/511Y002/M/{start}/{end}/FMFB/F0001"
        rows, payload = self._fetch_rows(url)
        from ..common.db import get_conn
        count = 0
        with get_conn() as conn:
            self.save_raw(conn, payload)
        with get_conn() as conn:
            for row in rows:
                val = row.get("DATA_VALUE")
                if val is None:
                    continue
                is_new = upsert_snapshot(
                    conn, "HOUSE_PRICE_OUTLOOK_SEOUL_CSI",
                    row["TIME"][:4] + "-" + row["TIME"][4:],
                    float(val),
                    self.emit_event,
                )
                if is_new:
                    count += 1
        return count

    def _collect_base_rate(self, start: str, end: str) -> int:
        """기준금리: 722Y001 / 0101000"""
        url  = f"{_BASE}/1/100/722Y001/M/{start}/{end}/0101000"
        rows, payload = self._fetch_rows(url)
        from ..common.db import get_conn
        count = 0
        with get_conn() as conn:
            self.save_raw(conn, payload)
        with get_conn() as conn:
            for row in rows:
                val = row.get("DATA_VALUE")
                if val is None:
                    continue
                is_new = upsert_snapshot(
                    conn, "BASE_RATE",
                    row["TIME"][:4] + "-" + row["TIME"][4:],
                    float(val),
                    self.emit_event,
                )
                if is_new:
                    count += 1
        return count

    def _fetch_rows(self, url: str) -> tuple[list[dict], dict]:
        r = self.client.get(url, timeout=20)
        r.raise_for_status()
        d = r.json()
        return d.get("StatisticSearch", {}).get("row", []), d
