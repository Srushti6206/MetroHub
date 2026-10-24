"""POST /api/chat — MetroMate AI. Works without any API key (rule-based, grounded in MongoDB)."""
import logging
import time
from collections import defaultdict, deque

from flask import Blueprint, current_app, jsonify, request

from db import get_db
from services import recommendation_service as rec
from services.ai_service import AIError, ask_llm, llm_enabled
from util import ApiError, int_field, iso, json_body, oid, ser

bp = Blueprint("chat", __name__)
log = logging.getLogger("pmh.chat")
_hits: dict[str, deque] = defaultdict(deque)

PROMPTS = ["Suggest vegetarian snacks under ₹100", "I have ₹120 and 10 minutes", "Find chai and a quick bite",
           "Build a meal under ₹150", "What can I pick up before my train?"]


def _rate_limit():
    limit = current_app.config["CHAT_RATE_LIMIT_PER_MIN"]
    q, now = _hits[request.remote_addr or "?"], time.monotonic()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit:
        raise ApiError(429, "Too many chat requests. Please wait a minute.", "rate_limited")
    q.append(now)


def _card(p, shop, reason):
    return {"product_id": str(p["_id"]), "product_name": p["name"], "price_paise": p["price_paise"],
            "shop_id": str(p["shop_id"]), "shop_name": shop["name"] if shop else "", "is_available": p["is_available"],
            "is_vegetarian": p["is_vegetarian"], "preparation_minutes": p["preparation_minutes"], "reason": reason}


def _history(raw):
    if raw is None:
        return []
    if not isinstance(raw, list) or len(raw) > 20:
        raise ApiError(400, "history must be a list of at most 20 messages", "validation")
    out = []
    for h in raw[-6:]:
        if isinstance(h, dict) and h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str):
            out.append({"role": h["role"], "content": h["content"][:300]})
    return out


@bp.post("/api/chat")
def chat():
    _rate_limit()
    cfg = current_app.config
    d = json_body()
    msg = d.get("message")
    if not isinstance(msg, str) or not msg.strip():
        raise ApiError(400, "message is required", "validation")
    if len(msg) > cfg["CHAT_MAX_MESSAGE_CHARS"]:
        raise ApiError(400, f"message must be at most {cfg['CHAT_MAX_MESSAGE_CHARS']} characters", "validation")
    station_id = oid(d.get("station_id"), "station_id")
    budget = int_field(d, "budget_paise", minimum=100, maximum=1_000_000, required=False)
    minutes = int_field(d, "available_minutes", minimum=1, maximum=240, required=False)
    dietary = d.get("dietary_preferences") or []
    if not isinstance(dietary, list) or len(dietary) > 5:
        raise ApiError(400, "dietary_preferences must be a short list", "validation")
    history = _history(d.get("history"))
    cart_ids = set()
    for pid in (d.get("cart_product_ids") or [])[:30]:
        cart_ids.add(oid(pid, "cart_product_ids"))

    db = get_db()
    if not db.stations.find_one({"_id": station_id, "is_active": True}, {"_id": 1}):
        raise ApiError(404, "Station not found", "not_found")
    cart_shops = {p["shop_id"] for p in db.products.find({"_id": {"$in": list(cart_ids)}}, {"shop_id": 1})} if cart_ids else set()

    # Explicit UI values only fill gaps; a number in the message wins.
    q = rec.parse_query(msg, None, None, dietary)
    if q["budget_paise"] is None:
        q["budget_paise"] = budget
    if q["minutes"] is None and minutes is not None:
        q["minutes"], q["explicit_minutes"] = minutes, True

    mode, note = "rule_based", None
    result = rec.recommend(db, station_id, q, cart_shops)

    if llm_enabled(cfg) and not result.get("follow_up"):
        try:
            result, mode = _with_llm(db, cfg, station_id, q, msg, history, result), "llm"
        except AIError as e:
            note = f"AI provider unavailable or returned unusable output ({e}); showing rule-based result."
            log.warning("LLM fallback: %s", e)

    cards = []
    if result["ok"]:
        shop = result["shop"]
        why = {str(p["_id"]): result.get("reasons_by_id", {}).get(str(p["_id"]), "Matches your budget, diet and time, and is available now in the demo catalog.")
               for p in result["items"]}
        cards = [_card(p, shop, why[str(p["_id"])]) for p in result["items"]]
    return jsonify({
        "reply": result["message"], "recommendations": cards, "total_paise": result["total_paise"],
        "reasons": result.get("reasons", []),
        "earliest_ready_at": iso(result.get("earliest_ready_at")), "pickup_estimate_note": "Estimate from preparation time only (demo); not live shop or train data.",
        "suggested_prompts": PROMPTS, "mode": mode, "fallback_note": note,
    })


def _with_llm(db, cfg, station_id, q, msg, history, base):
    pool, shops = rec.eligible_products(db, station_id, q)
    if not pool:
        raise AIError("no_eligible_products")
    budget = q["budget_paise"] if q["budget_paise"] is not None else 15000
    eligible = [{"id": str(p["_id"]), "name": p["name"], "price_rupees": p["price_paise"] // 100, "shop_id": str(p["shop_id"]),
                 "category": p["category"], "vegetarian": p["is_vegetarian"], "prep_minutes": p["preparation_minutes"]} for p in pool]
    constraints = {"budget_rupees": budget // 100, "available_minutes": q["minutes"], "vegetarian_only": q["veg"]}
    out = ask_llm(cfg, msg, history, constraints, eligible)
    by_id = {str(p["_id"]): p for p in pool}
    ids = list(dict.fromkeys(out["product_ids"]))
    if any(i not in by_id for i in ids):
        raise AIError("hallucinated_product_id")  # model named something outside the retrieved catalog
    reply = out["reply"]
    if "₹" in reply or "rs." in reply.lower() or "rupee" in reply.lower():
        reply = "Here is a pick from the demo catalog (prices below come from the database):"
    if not ids:
        return {"ok": False, "items": [], "total_paise": 0, "reasons": [], "message": reply, "follow_up": True}
    items = [by_id[i] for i in ids]
    if len({p["shop_id"] for p in items}) != 1:
        raise AIError("multiple_shops")
    total = sum(p["price_paise"] for p in items)
    if total > budget:
        raise AIError("over_budget")
    shop = shops[items[0]["shop_id"]]
    max_prep = max(p["preparation_minutes"] for p in items)
    from datetime import timedelta
    from util import now_utc
    return {"ok": True, "shop": shop, "items": items, "total_paise": total, "message": reply,
            "reasons": [f"Total ₹{total // 100} (calculated from database prices) is within your budget.",
                        f"Longest preparation is {max_prep} min.", "Chosen by the AI model from items the backend verified as eligible."],
            "earliest_ready_at": now_utc() + timedelta(minutes=max_prep)}
