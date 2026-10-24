"""POST /api/chat — MetroMate AI. Works without any API key (rule-based, grounded in MongoDB)."""
import logging
import re
import time
from collections import defaultdict, deque
from datetime import timedelta

from flask import Blueprint, current_app, jsonify, request

from db import get_db
from services import recommendation_service as rec
from services.ai_service import AIError, ask_llm, llm_enabled
from util import ApiError, int_field, iso, json_body, now_utc, oid, ser

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


def _card(db, p, shop, reason, q):
    shop_doc = db.shops.find_one({"_id": p["shop_id"]}) or (shop if isinstance(shop, dict) else {})
    shop_name = shop_doc.get("name") or (shop.get("name") if isinstance(shop, dict) else "")
    shop_type = shop_doc.get("shop_type")
    if shop_type is None:
        shop_type = "demo" if shop_doc.get("verification_status") == "sample" or shop_doc.get("location_type") == "demo_unverified" else "verified"
    verification_status = shop_doc.get("verification_status")
    if verification_status is None:
        verification_status = "sample" if shop_type == "demo" else "unverified"
    locations = []
    budget = q["budget_paise"] if q["budget_paise"] is not None else 15000
    minutes = q["minutes"] if q["minutes"] is not None else 20
    f = {"name": {"$regex": "^" + re.escape(p["name"]) + "$", "$options": "i"},
         "category": p["category"], "is_available": True, "price_paise": {"$lte": budget},
         "preparation_minutes": {"$lte": minutes}}
    if q["veg"]:
        f["is_vegetarian"] = True
    for match in db.products.find(f).sort("price_paise", 1):
        if q["veg"] and not rec.vegetarian_product(match):
            continue
        match_shop = db.shops.find_one({"_id": match["shop_id"], "is_active": True})
        if not match_shop:
            continue
        station_ids = match_shop.get("station_ids", ([match_shop["station_id"]] if match_shop.get("station_id") else []))
        for station in db.stations.find({"_id": {"$in": station_ids}, "is_active": True}).sort("display_name", 1):
            if "operational" not in station.get("status_by_line", {}).values():
                continue
            locations.append({"station_id": str(station["_id"]), "station_name": station["display_name"],
                              "lines": station.get("lines", []), "status_by_line": station.get("status_by_line", {}),
                              "location_type": match_shop.get("location_type", "demo_unverified"),
                              "distance_metres": match_shop.get("distance_metres"),
                              "verification_status": match_shop.get("verification_status", "unverified"),
                              "price_paise": match["price_paise"], "shop_name": match_shop["name"],
                              "shop_id": str(match_shop["_id"]), "detail_path": f"/shops/{match_shop['_id']}"})
    detail_path = f"/shops/{shop_doc['_id']}" if shop_doc.get("_id") else f"/shops/{p['shop_id']}"
    return {"product_id": str(p["_id"]), "product_name": p["name"], "price_paise": p["price_paise"],
            "shop_id": str(p["shop_id"]), "shop_name": shop_name, "is_available": p["is_available"],
            "is_vegetarian": p["is_vegetarian"], "preparation_minutes": p["preparation_minutes"], "reason": reason,
            "station_locations": locations, "shop_type": shop_type,
            "verification_status": verification_status,
            "data_source": shop_doc.get("data_source", ""), "detail_path": detail_path}


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


def _website_facts(db, station_id):
    """Build the small, current-station website context used to ground agent answers."""
    stations = list(db.stations.find({"is_active": True}, {"display_name": 1, "lines": 1}))
    shops = list(db.shops.find({"station_ids": station_id, "is_active": True}))
    shop_ids = [shop["_id"] for shop in shops]
    products = list(db.products.find({"shop_id": {"$in": shop_ids}})) if shop_ids else []
    offers = list(db.offers.find({"shop_id": {"$in": shop_ids}, "is_active": True})) if shop_ids else []

    facts = [
        {"id": "site:identity", "type": "site",
         "fact": "Independent demo prototype; not an official Pune Metro or Maha Metro app."},
        {"id": "site:limitations", "type": "site",
         "fact": "No live train data, real payments, or real-time inventory. Pickup time is an estimate from preparation time."},
    ]
    facts.extend({
        "id": f"station:{s['_id']}", "type": "station",
        "name": s.get("display_name", s.get("name", "")),
        "lines": [line.get("name", line.get("code", "")) for line in s.get("lines", [])],
    } for s in stations)
    facts.extend({
        "id": f"shop:{s['_id']}", "type": "shop", "name": s.get("name", ""),
        "category": s.get("category", ""), "description": s.get("description", ""),
        "station_ids": [str(value) for value in s.get("station_ids", [])],
        "location_description": s.get("location_description", ""),
        "shop_type": s.get("shop_type", ""),
    } for s in shops)
    facts.extend({
        "id": f"product:{p['_id']}", "type": "product", "name": p.get("name", ""),
        "description": p.get("description", ""), "category": p.get("category", ""),
        "shop_id": str(p.get("shop_id", "")), "price_paise": p.get("price_paise"),
        "is_available": p.get("is_available"), "is_vegetarian": p.get("is_vegetarian"),
        "preparation_minutes": p.get("preparation_minutes"),
    } for p in products)
    facts.extend({
        "id": f"offer:{o['_id']}", "type": "offer", "title": o.get("title", ""),
        "description": o.get("description", ""), "shop_id": str(o.get("shop_id", "")),
        "discount_type": o.get("discount_type", ""), "discount_value": o.get("discount_value"),
        "is_active": o.get("is_active", False),
    } for o in offers)
    return facts


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
    direct_matches = rec.product_suggestions(db, station_id, msg, q)
    if direct_matches is not None:
        alternatives = []
        for product, shop in direct_matches:
            prep = product["preparation_minutes"]
            alternatives.append({
                "shop": shop,
                "items": [product],
                "total_paise": product["price_paise"],
                "reasons": [f"Matches your requested item at {shop['name']}.",
                            f"Preparation takes about {prep} min."],
                "earliest_ready_at": now_utc() + timedelta(minutes=prep),
            })
        if alternatives:
            result = {
                "ok": True, "shop": alternatives[0]["shop"], "items": alternatives[0]["items"],
                "total_paise": alternatives[0]["total_paise"], "reasons": alternatives[0]["reasons"],
                "earliest_ready_at": alternatives[0]["earliest_ready_at"], "follow_up": False,
                "alternatives": alternatives,
                "message": "Here are matching options from the current demo catalog:",
            }
        else:
            result = {
                "ok": False, "items": [], "total_paise": 0, "reasons": [], "follow_up": False,
                "alternatives": [],
                "message": "I couldn't find that item available within your budget, diet, and time at this station.",
            }
    else:
        result = rec.recommend(db, station_id, q, cart_shops)
        fallback_result = result
        if llm_enabled(cfg) and not result.get("follow_up"):
            try:
                result, mode = _with_llm(db, cfg, station_id, q, msg, history), "llm"
                result["alternatives"] = fallback_result.get("alternatives", [])
            except AIError as e:
                note = f"AI provider unavailable or returned unusable output ({e}); showing rule-based result."
                log.warning("LLM fallback: %s", e)

    cards = []
    if result["ok"]:
        shop = result["shop"]
        why = {str(p["_id"]): result.get("reasons_by_id", {}).get(str(p["_id"]), "Matches your budget, diet and time, and is available now in the demo catalog.")
               for p in result["items"]}
        cards = [_card(db, p, shop, why[str(p["_id"])], q) for p in result["items"]]
    alternatives = result.get("alternatives", [])
    if result.get("ok") and not alternatives:
        alternatives = [result]
    suggestions = [{
        "items": [_card(db, p, option["shop"], "", q) for p in option["items"]],
        "total_paise": option["total_paise"],
        "reasons": option.get("reasons", []),
        "earliest_ready_at": iso(option.get("earliest_ready_at")),
        "shop_name": option["shop"]["name"],
    } for option in alternatives]
    return jsonify({
        "reply": result["message"], "recommendations": cards, "total_paise": result["total_paise"],
        "reasons": result.get("reasons", []),
        "earliest_ready_at": iso(result.get("earliest_ready_at")), "pickup_estimate_note": "Estimate from preparation time only (demo); not live shop or train data.",
        "suggested_prompts": PROMPTS, "mode": mode, "fallback_note": note, "suggestions": suggestions,
    })


def _with_llm(db, cfg, station_id, q, msg, history):
    pool, shops = rec.eligible_products(db, station_id, q)
    budget = q["budget_paise"] if q["budget_paise"] is not None else 15000
    eligible = [{"id": str(p["_id"]), "name": p["name"], "price_rupees": p["price_paise"] // 100, "shop_id": str(p["shop_id"]),
                 "category": p["category"], "vegetarian": p["is_vegetarian"], "prep_minutes": p["preparation_minutes"]} for p in pool]
    constraints = {"budget_rupees": budget // 100, "available_minutes": q["minutes"], "vegetarian_only": q["veg"]}
    website_facts = _website_facts(db, station_id)
    out = ask_llm(cfg, msg, history, constraints, eligible, website_facts)
    by_id = {str(p["_id"]): p for p in pool}
    ids = list(dict.fromkeys(out["product_ids"]))
    if any(i not in by_id for i in ids):
        raise AIError("hallucinated_product_id")  # model named something outside the retrieved catalog
    valid_sources = {fact["id"] for fact in website_facts}
    source_ids = out.get("source_ids", [])
    if any(source_id not in valid_sources for source_id in source_ids):
        raise AIError("unknown_website_source")
    reply = out["reply"]
    if "₹" in reply or "rs." in reply.lower() or "rupee" in reply.lower():
        reply = "Here is a pick from the demo catalog (prices below come from the database):"
    if not ids:
        if not source_ids:
            reply = "I can only help with information listed on this demo website, such as its stations, shops, products, and offers."
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
