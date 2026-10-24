import os
from dotenv import load_dotenv

load_dotenv()


def _list(v: str):
    return [x.strip() for x in v.split(",") if x.strip()]


class Config:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "pune_metro_hub")
    MONGO_TIMEOUT_MS = int(os.getenv("MONGO_TIMEOUT_MS", "3000"))
    CORS_ORIGINS = _list(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))
    MAX_CONTENT_LENGTH = 64 * 1024  # request-size limit
    CHAT_RATE_LIMIT_PER_MIN = int(os.getenv("CHAT_RATE_LIMIT_PER_MIN", "20"))
    CHAT_MAX_MESSAGE_CHARS = 500
    AI_PROVIDER = os.getenv("AI_PROVIDER", "").strip().lower()
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "").strip()
    AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "12"))
    # Demo-only: lets the customer "advance status" button work without accounts.
    ALLOW_DEMO_CUSTOMER_STATUS = os.getenv("ALLOW_DEMO_CUSTOMER_STATUS", "1") == "1"
    TESTING = False
