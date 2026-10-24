"""Order business logic. Prices/totals are ALWAYS computed here from MongoDB, never from the client."""
import random
import re
import string
from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from util import ApiError, aware, now_utc, oid

STATUSES = ["placed", "accepted", "preparing", "ready", "collected", "rejected"]
TRANSITIONS = {
    "placed": {"accepted", "rejected"},
    "accepted": {"preparing", "rejected"},
    "preparing": {"ready"},
    "ready": {"collected"},
    "collected": set(),
    "rejected": set(),
}
MAX_LINES = 30
MAX_QTY = 20
CLOCK_GRACE = timedelta(seconds=90)
MAX_AHEAD = timedelta(hours=24)


def best_offer(db, shop_id, subtotal_paise, at):
    """Best live offer for the subtotal. Returns (offer_doc|None, discount_paise)."""
    best, best_amt = None, 0
    for o in db.offers.find({"shop_id": shop_id, "is_active": True}):
        start, end = aware(o.get("start_at")), aware(o.get("end_at"))
        if (start and start > at) or (end and end < at):
            continue
        if subtotal_paise < o.get("min_subtotal_paise", 0):
            continue
        if o["discount_type"] == "percent":
            amt = subtotal_paise * o["discount_value"] // 100
        else:  # flat, in paise
            amt = min(o["discount_value"], subtotal_paise)
        if amt > best_amt:
            best, best_amt = o, amt
    return best, best_amt


def _order_number(db):
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(8):
        n = "PMH-" + "".join(random.choices(alphabet, k=6))
        if not db.orders.find_one({"order_number": n}, {"_id": 1}):
            return n
    raise ApiError(500, "Could not allocate an order number", "order_number")


def create_order(db, data: dict, parse_dt):
    """Validate everything first, then insert ONE document (atomic per-document on a standalone mongod).

    No multi-document transaction is used: a standalone local mongod does not support them. Availability is
    validated at checkout time only; there is no stock reservation, so concurrent orders are not guaranteed.
    """
    now = now_utc()
    station_id = oid(data.get("station_id"), "station_id")
    shop_id = oid(data.get("shop_id"), "shop_id")
    lines = data.get("items")
    if not isinstance(lines, list) or not lines:
        raise ApiError(400, "items must be a non-empty list", "validation")
    if len(lines) > MAX_LINES:
        raise ApiError(400, f"At most {MAX_LINES} different items per order", "validation")

    qty_by = {}
    for ln in lines:
        if not isinstance(ln, dict):
            raise ApiError(400, "Each item must be an object", "validation")
        pid = oid(ln.get("product_id"), "product_id")
        q = ln.get("quantity")
        if isinstance(q, bool) or not isinstance(q, int) or not 1 <= q <= MAX_QTY:
            raise ApiError(400, f"quantity must be an integer between 1 and {MAX_QTY}", "validation")
        qty_by[pid] = qty_by.get(pid, 0) + q
        if qty_by[pid] > MAX_QTY:
            raise ApiError(400, f"At most {MAX_QTY} of one item per order", "validation")

    station = db.stations.find_one({"_id": station_id, "is_active": True})
    if not station:
        raise ApiError(404, "Station not found", "not_found")
    shop = db.shops.find_one({"_id": shop_id, "is_active": True})
    if not shop:
        raise ApiError(404, "Shop not found", "not_found")
    if station_id not in shop.get("station_ids", []):
        raise ApiError(422, "This shop is not associated with the selected station", "station_mismatch")

    products = {p["_id"]: p for p in db.products.find({"_id": {"$in": list(qty_by)}})}
    items, max_prep, subtotal = [], 0, 0
    for pid, qty in qty_by.items():
        p = products.get(pid)
        if not p:
            raise ApiError(404, f"Product {pid} not found", "not_found")
        if p["shop_id"] != shop_id:
            raise ApiError(422, "All items in one order must come from the same shop (checkout per shop)", "multi_shop")
        if not p.get("is_available"):
            raise ApiError(409, f"'{p['name']}' is currently unavailable", "unavailable")
        line = p["price_paise"] * qty
        subtotal += line
        max_prep = max(max_prep, p["preparation_minutes"])
        items.append({"product_id": pid, "product_name": p["name"], "unit_price_paise": p["price_paise"],
                      "quantity": qty, "line_total_paise": line})

    arrival = parse_dt(data.get("expected_arrival_at"), "expected_arrival_at")
    pickup = parse_dt(data.get("preferred_pickup_at"), "preferred_pickup_at")
    if not arrival or not pickup:
        raise ApiError(400, "expected_arrival_at and preferred_pickup_at are required", "validation")
    if arrival < now - CLOCK_GRACE:
        raise ApiError(422, "Expected arrival is in the past", "pickup_time")
    if arrival > now + MAX_AHEAD or pickup > now + MAX_AHEAD + timedelta(hours=1):
        raise ApiError(422, "Pickup must be within the next 24 hours", "pickup_time")
    if pickup < arrival:
        raise ApiError(422, "Preferred pickup time cannot be earlier than your expected arrival", "pickup_time")
    earliest = now + timedelta(minutes=max_prep)
    if pickup < earliest - CLOCK_GRACE:
        raise ApiError(422, f"Pickup is too early: the longest preparation in this order is {max_prep} min", "pickup_time")

    notes = data.get("customer_notes", "")
    if notes is None:
        notes = ""
    if not isinstance(notes, str) or len(notes) > 200:
        raise ApiError(400, "customer_notes must be a string of at most 200 characters", "validation")

    offer, discount = best_offer(db, shop_id, subtotal, now)
    doc = {
        "station_id": station_id, "shop_id": shop_id, "items": items, "subtotal_paise": subtotal,
        "discount_paise": discount, "total_paise": subtotal - discount,
        "offer_title": offer["title"] if offer else None, "status": "placed",
        "expected_arrival_at": arrival, "preferred_pickup_at": pickup, "customer_notes": notes.strip(),
        "is_demo_seed": False, "status_history": [{"status": "placed", "at": now}],
        "created_at": now, "updated_at": now,
    }
    for _ in range(3):
        doc["order_number"] = _order_number(db)
        try:
            res = db.orders.insert_one(doc)
            doc["_id"] = res.inserted_id
            return doc
        except DuplicateKeyError:
            doc.pop("_id", None)
    raise ApiError(500, "Could not create order, please retry", "order_number")


def change_status(db, order_id, new_status, allowed_shop_id=None):
    if new_status not in STATUSES:
        raise ApiError(400, f"status must be one of {', '.join(STATUSES)}", "validation")
    order = db.orders.find_one({"_id": order_id})
    if not order:
        raise ApiError(404, "Order not found", "not_found")
    if allowed_shop_id is not None and order["shop_id"] != allowed_shop_id:
        raise ApiError(403, "This order belongs to a different shop", "forbidden")
    if new_status not in TRANSITIONS[order["status"]]:
        raise ApiError(409, f"Cannot change status from '{order['status']}' to '{new_status}'", "bad_transition")
    now = now_utc()
    res = db.orders.find_one_and_update(
        {"_id": order_id, "status": order["status"]},  # guards against a concurrent change
        {"$set": {"status": new_status, "updated_at": now},
         "$push": {"status_history": {"status": new_status, "at": now}}},
        return_document=True,
    )
    if not res:
        raise ApiError(409, "Order status changed concurrently; refresh and retry", "conflict")
    return res


def resolve_order_id(db, key):
    """Accept either the ObjectId string or the readable order number (PMH-XXXXXX)."""
    if isinstance(key, str) and re.fullmatch(r"PMH-[A-Z0-9]{3,12}", key):
        o = db.orders.find_one({"order_number": key}, {"_id": 1})
        if not o:
            raise ApiError(404, "Order not found", "not_found")
        return o["_id"]
    return oid(key, "order_id")
