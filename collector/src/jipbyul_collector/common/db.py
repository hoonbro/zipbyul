"""PostgreSQL 연결 — psycopg3."""
from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg.rows import dict_row

from .settings import DSN


@contextmanager
def get_conn() -> Generator[psycopg.Connection, None, None]:
    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        yield conn


def close_pool() -> None:
    pass  # 연결 풀 미사용, 호환용 no-op
