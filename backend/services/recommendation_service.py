"""Rule-based, catalog-grounded recommender (works with no AI key). All prices come from MongoDB."""
import re
from datetime import timedelta

from util import now_utc

CAT_CHAI, CAT_BITES = ["chai"], ["bites", "bakery"]


def parse_query(text, budget_paise=None, minutes=None, dietary=None):
    s = (text or "").lower()
    if budget_paise is None:
        m = re.search(r"(?:₹|rs\.?|inr|under|below|within|budget)\s*(\d{2,4})(?!\s*(?:min|mins|minutes|मिनट|मिनिट))", s) \
            or re.search(r"(\d{2,4})\s*(?:₹|rs\b|rupees)", s)
        budget_paise = int(m.group(1)) * 100 if m else None
    explicit_minutes = minutes is not None
    if minutes is None:
        m = re.search(r"(\d{1,3})\s*(?:min|mins|minutes|मिनट|मिनिट)", s)
        if m:
            minutes, explicit_minutes = int(m.group(1)), True
    dietary = [d.lower() for d in (dietary or []) if isinstance(d, str)]
    veg = bool(re.search(r"\bveg\b|vegetarian|शाकाहारी|jain", s)) and not re.search(r"non[- ]?veg", s)
    veg = veg or "vegetarian" in dietary or "veg" in dietary
    product_keyword = "coffee" if re.search(r"\bcoffee\b", s) else None
    if product_keyword:
        intent = "coffee"
    elif re.search(r"chai|चाय|चहा", s):
        intent = "chai_bite"
    elif re.search(r"meal|lunch|thali|भोजन|जेवण", s):
        intent = "meal"
    elif re.search(r"snack|bite|nashta|नाश्ता", s):
        intent = "snacks"
    else:
        intent = "general"
    asks_train = bool(re.search(r"before (my )?(train|metro)|\btrain\b", s))
    return {"budget_paise": budget_paise, "minutes": minutes, "explicit_minutes": explicit_minutes,
            "veg": veg, "intent": intent, "product_keyword": product_keyword, "asks_train": asks_train}


def _slots(intent):
    if intent == "coffee":
        return [(CAT_CHAI, False, True)]
    if intent == "chai_bite":
        return [(CAT_CHAI, False, True), (CAT_BITES, False, False)]
    if intent == "meal":
        return [(["meals"], False, False), (CAT_CHAI, True, True), (["bakery"], True, False)]
    if intent == "snacks":
        sn = ["bites", "snacks", "bakery"]
        return [(sn, False, False), (sn, True, False), (CAT_CHAI, True, True)]
    return [(["meals", "bites"], False, False), (CAT_CHAI, True, True), (["bakery", "snacks"], True, False)]


def vegetarian_product(p):
    """True only for a vegetarian flag with no non-vegetarian egg dish wording."""
    text = f"{p.get('name', '')} {p.get('description', '')}"
    has_egg = re.compile(r"\b(?:eggs?|omelette|omelet|bhurji)\b", re.IGNORECASE)
    egg_free = re.compile(r"\b(?:eggless|egg[- ]free|no eggs?)\b", re.IGNORECASE)
    return bool(p.get("is_vegetarian")) and not (has_egg.search(text) and not egg_free.search(text))


def eligible_products(db, station_id, q, default_budget=15000, default_minutes=20):
    """Every available product at this station within budget / prep time / diet. Grouped list of docs."""
    station = db.stations.find_one({"_id": station_id, "is_active": True})
    if not station or "operational" not in station.get("status_by_line", {}).values():
        return [], {}
    shops = list(db.shops.find({"$or": [{"station_ids": station_id}, {"station_id": station_id}], "is_active": True}))
    if not shops:
        return [], {}
    budget = q["budget_paise"] if q["budget_paise"] is not None else default_budget
    minutes = q["minutes"] if q["minutes"] is not None else default_minutes
    flt = {"shop_id": {"$in": [s["_id"] for s in shops]}, "is_available": True,
           "preparation_minutes": {"$lte": minutes}, "price_paise": {"$lte": budget}}
    if q["veg"]:
        flt["is_vegetarian"] = True
    products = list(db.products.find(flt))
    if q.get("product_keyword"):
        term = q["product_keyword"].casefold()
        products = [p for p in products if term in f"{p.get('name', '')} {p.get('description', '')}".casefold()]
    if q["veg"]:
        # A stale or manually edited diet flag must not admit egg dishes into a vegetarian recommendation.
        products = [p for p in products if vegetarian_product(p)]
    return products, {s["_id"]: s for s in shops}


def _build(pool, budget, intent):
    slots, used, out, remaining, failed = _slots(intent), set(), [], budget, False
    for i, (cats, optional, cheapest) in enumerate(slots):
        cands = [p for p in pool if p["category"] in cats and p["_id"] not in used]
        reserve = 0
        for cats2, opt2, _ in slots[i + 1:]:
            if not opt2:
                prices = [p["price_paise"] for p in pool if p["category"] in cats2]
                reserve += min(prices) if prices else 0
        fit = sorted([p for p in cands if p["price_paise"] <= remaining - reserve],
                     key=lambda p: p["price_paise"] if cheapest else -p["price_paise"])
        if not fit:
            failed = failed or not optional
            continue
        used.add(fit[0]["_id"])
        out.append(fit[0])
        remaining -= fit[0]["price_paise"]
    return [] if failed else out


def recommend(db, station_id, q, cart_shop_ids=()):
    """Returns dict(ok, shop, items, total_paise, reasons, earliest_ready_at, message, follow_up)."""
    if q["asks_train"] and not q["explicit_minutes"]:
        return {"ok": False, "items": [], "total_paise": 0, "reasons": [], "follow_up": True,
                "message": "How many minutes do you have before your train? I don't have live train data, so tell me and I'll find items that can be ready in time."}
    budget = q["budget_paise"] if q["budget_paise"] is not None else 15000
    pool, shops = eligible_products(db, station_id, q)
    best = None
    for sid, shop in shops.items():
        items = _build([p for p in pool if p["shop_id"] == sid], budget, q["intent"])
        if not items:
            continue
        total = sum(p["price_paise"] for p in items)
        score = len(items) * 10000 + total + (6000 if sid in cart_shop_ids else 0) - max(p["preparation_minutes"] for p in items)
        if not best or score > best[0]:
            best = (score, shop, items)
    minutes = q["minutes"] if q["minutes"] is not None else 20
    if not best:
        return {"ok": False, "items": [], "total_paise": 0, "reasons": [], "follow_up": False,
                "message": f"I couldn't find available items within ₹{budget // 100} and {minutes} min"
                           f"{' (vegetarian)' if q['veg'] else ''} at this station. Try a higher budget or a little more time."}
    _, shop, items = best
    total = sum(p["price_paise"] for p in items)
    max_prep = max(p["preparation_minutes"] for p in items)
    reasons = [f"Total ₹{total // 100} is within your ₹{budget // 100} budget"
               + ("" if q["budget_paise"] is not None else " (default; tell me your budget to refine)") + ".",
               f"Longest preparation is {max_prep} min, within your {minutes}-minute window.",
               "All items are vegetarian." if q["veg"] else "Veg and non-veg items are both eligible.",
               "Only items currently marked available in the catalog were considered (checked at checkout, not reserved)."]
    if shop["_id"] in cart_shop_ids:
        reasons.append("Same shop as items already in your cart, so you collect in one stop.")
    return {"ok": True, "shop": shop, "items": items, "total_paise": total, "reasons": reasons,
            "earliest_ready_at": now_utc() + timedelta(minutes=max_prep), "follow_up": False,
            "message": f"Here's a {'vegetarian ' if q['veg'] else ''}pick from {shop['name']} (demo shop):"}
