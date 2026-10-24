from flask import Blueprint, current_app, jsonify

from db import SETUP_HINT, get_db, ping
from services.ai_service import llm_enabled

bp = Blueprint("health", __name__)


@bp.get("/api/health")
def health():
    ok, why = ping(get_db())
    cfg = current_app.config
    body = {"status": "ok" if ok else "degraded", "database": {"connected": ok, "name": cfg["MONGO_DB_NAME"]},
            "chat_mode": "llm" if llm_enabled(cfg) else "rule_based"}
    if not ok:
        body["database"]["hint"] = SETUP_HINT.format(uri="the configured MONGO_URI")
        body["database"]["error_type"] = why
    return jsonify(body), (200 if ok else 503)
