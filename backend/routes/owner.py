"""Shop-owner API. DEMO ACCESS ONLY: the shop is chosen with the X-Demo-Owner-Shop header.
This is NOT authentication and must not be used in production."""
from functools import wraps

from flask import Blueprint, g, jsonify, request

from db import get_db
from routes.catalog import offer_json
from services import order_service as svc
from util import ApiError, int_field, json_body, now_utc, oid, parse_dt, ser, str_field

bp = Blueprint("owner", __name__)
PRODUCT_CATS = {"chai", "bites", "meals", "bakery", "snacks", "essentials"}


def demo_owner(fn):
    @wraps(fn)
    def wrap(*a, **kw):
        sid = oid(request.headers.get("X-Demo-Owner-Shop", ""), "X-Demo-Owner-Shop")
        shop = get_db().shops.find_one({"_id": sid, "is_active": True})
        if not shop:
            raise ApiError(404, "Demo owner shop not found", "not_found")
        g.shop = shop
        return fn(*a, **kw)
    return wrap


@bp.get("/api/owner/orders")
@demo_owner
def orders():
    return jsonify([ser(o) for o in get_db().orders.find({"shop_id": g.shop["_id"]}).sort("created_at", -1).limit(200)])


@bp.patch("/api/owner/orders/<order_id>/status")
@demo_owner
def order_status(order_id):
    o = svc.change_status(get_db(), svc.resolve_order_id(get_db(), order_id), json_body().get("status"), allowed_shop_id=g.shop["_id"])
    return jsonify(ser(o))


@bp.get("/api/owner/products")
@demo_owner
def products():
    return jsonify([ser(p) for p in get_db().products.find({"shop_id": g.shop["_id"]}).sort("name", 1)])


def _product_fields(d: dict, partial: bool) -> dict:
    out = {}
    req = not partial
    if "name" in d or req:
        out["name"] = str_field(d, "name", max_len=80)
    if "description" in d or req:
        out["description"] = str_field(d, "description", max_len=300, required=False)
    if "category" in d or req:
        c = d.get("category")
        if c not in PRODUCT_CATS:
            raise ApiError(400, f"category must be one of {', '.join(sorted(PRODUCT_CATS))}", "validation")
        out["category"] = c
    if "price_paise" in d or req:
        out["price_paise"] = int_field(d, "price_paise", minimum=100, maximum=1_000_000)
    if "preparation_minutes" in d or req:
        out["preparation_minutes"] = int_field(d, "preparation_minutes", minimum=1, maximum=120)
    for k, default in (("is_vegetarian", None), ("is_available", True)):
        if k in d:
            if not isinstance(d[k], bool):
                raise ApiError(400, f"{k} must be true or false", "validation")
            out[k] = d[k]
        elif req:
            if default is None:
                raise ApiError(400, f"{k} is required", "validation")
            out[k] = default
    if "is_vegetarian" in out:
        out["dietary_tags"] = ["vegetarian"] if out["is_vegetarian"] else ["non-vegetarian"]
    if "image_url" in d:
        v = d["image_url"]
        if v is not None and (not isinstance(v, str) or len(v) > 300 or not v.startswith(("http://", "https://"))):
            raise ApiError(400, "image_url must be an http(s) URL or null", "validation")
        out["image_url"] = v
    return out


@bp.post("/api/owner/products")
@demo_owner
def add_product():
    f = _product_fields(json_body(), partial=False)
    now = now_utc()
    f.update({"shop_id": g.shop["_id"], "image_url": f.get("image_url"), "created_at": now, "updated_at": now})
    res = get_db().products.insert_one(f)
    f["_id"] = res.inserted_id
    return jsonify(ser(f)), 201


def _own_product(pid):
    p = get_db().products.find_one({"_id": oid(pid, "product_id")})
    if not p:
        raise ApiError(404, "Product not found", "not_found")
    if p["shop_id"] != g.shop["_id"]:
        raise ApiError(403, "This product belongs to a different shop", "forbidden")
    return p


@bp.patch("/api/owner/products/<product_id>")
@demo_owner
def edit_product(product_id):
    p = _own_product(product_id)
    f = _product_fields(json_body(), partial=True)
    if not f:
        raise ApiError(400, "No editable fields supplied", "validation")
    f["updated_at"] = now_utc()
    return jsonify(ser(get_db().products.find_one_and_update({"_id": p["_id"]}, {"$set": f}, return_document=True)))


@bp.delete("/api/owner/products/<product_id>")
@demo_owner
def delete_product(product_id):
    p = _own_product(product_id)
    get_db().products.delete_one({"_id": p["_id"]})  # historical orders keep their price snapshots
    return "", 204


def _offer_fields(d: dict, partial: bool, current=None) -> dict:
    out, req = {}, not partial
    if "title" in d or req:
        out["title"] = str_field(d, "title", max_len=100)
    if "description" in d:
        out["description"] = str_field(d, "description", max_len=200, required=False)
    if "discount_type" in d or req:
        if d.get("discount_type") not in ("percent", "flat"):
            raise ApiError(400, "discount_type must be 'percent' or 'flat'", "validation")
        out["discount_type"] = d["discount_type"]
    dtype = out.get("discount_type") or (current or {}).get("discount_type")
    if "discount_value" in d or req:
        v = int_field(d, "discount_value", minimum=1)
        if dtype == "percent" and v > 90:
            raise ApiError(400, "Percent discount must be between 1 and 90", "validation")
        if dtype == "flat" and v > 100_000:
            raise ApiError(400, "Flat discount (paise) is too large", "validation")
        out["discount_value"] = v
    if "min_subtotal_paise" in d or req:
        out["min_subtotal_paise"] = int_field(d, "min_subtotal_paise", minimum=0, maximum=1_000_000, required=False, default=0)
    if "is_active" in d or req:
        if not isinstance(d.get("is_active", True), bool):
            raise ApiError(400, "is_active must be true or false", "validation")
        out["is_active"] = d.get("is_active", True)
    for k in ("start_at", "end_at"):
        if k in d or (req and k == "start_at"):
            out[k] = parse_dt(d.get(k), k) or (now_utc() if k == "start_at" else None)
    s = out.get("start_at", (current or {}).get("start_at"))
    e = out.get("end_at", (current or {}).get("end_at"))
    if s and e and e <= s:
        raise ApiError(400, "end_at must be after start_at", "validation")
    return out


@bp.get("/api/owner/offers")
@demo_owner
def offers():
    return jsonify([offer_json(o) for o in get_db().offers.find({"shop_id": g.shop["_id"]})])


@bp.post("/api/owner/offers")
@demo_owner
def add_offer():
    f = _offer_fields(json_body(), partial=False)
    f["shop_id"] = g.shop["_id"]
    f.setdefault("description", "Demo offer (fictional).")
    f.setdefault("end_at", None)
    f["_id"] = get_db().offers.insert_one(f).inserted_id
    return jsonify(offer_json(f)), 201


def _own_offer(oid_):
    o = get_db().offers.find_one({"_id": oid(oid_, "offer_id")})
    if not o:
        raise ApiError(404, "Offer not found", "not_found")
    if o["shop_id"] != g.shop["_id"]:
        raise ApiError(403, "This offer belongs to a different shop", "forbidden")
    return o


@bp.patch("/api/owner/offers/<offer_id>")
@demo_owner
def edit_offer(offer_id):
    o = _own_offer(offer_id)
    f = _offer_fields(json_body(), partial=True, current=o)
    if not f:
        raise ApiError(400, "No editable fields supplied", "validation")
    return jsonify(offer_json(get_db().offers.find_one_and_update({"_id": o["_id"]}, {"$set": f}, return_document=True)))


@bp.delete("/api/owner/offers/<offer_id>")
@demo_owner
def delete_offer(offer_id):
    o = _own_offer(offer_id)
    get_db().offers.delete_one({"_id": o["_id"]})
    return "", 204
