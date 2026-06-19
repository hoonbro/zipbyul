"""테스트용 더미 환경변수 — settings.py가 import 시점에 요구하는 키를 채운다."""
import os

os.environ.setdefault("DATA_GO_KR_SERVICE_KEY", "test")
os.environ.setdefault("ECOS_API_KEY", "test")
os.environ.setdefault("POSTGRES_DB", "test")
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
