import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[4] / ".env")

SERVICE_KEY = os.environ["DATA_GO_KR_SERVICE_KEY"]
ECOS_KEY    = os.environ["ECOS_API_KEY"]

DB_HOST     = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT     = int(os.getenv("POSTGRES_PORT", "5432"))
DB_NAME     = os.environ["POSTGRES_DB"]
DB_USER     = os.environ["POSTGRES_USER"]
DB_PASSWORD = os.environ["POSTGRES_PASSWORD"]

DSN = (
    f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} "
    f"user={DB_USER} password={DB_PASSWORD}"
)
