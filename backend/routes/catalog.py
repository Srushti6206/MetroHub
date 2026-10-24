"""Stations, shops, products, offers (read-only customer API)."""
import re

from flask import Blueprint, jsonify, request

from db import get_db
from util import ApiError, bool_arg, now_utc, oid, ser, aware

bp = Blueprint("catalog", __name__)


def offer_json(o, now=None):
    now = now or now_utc()
    s, e = aware(o.get("start_at")), aware(o.get("end_at"))
    live = bool(o.get("is_active")) and (not s or s <= now) and (not e or e >= now)
    d = ser(o)
    d["is_live"] = live
    return d


@bp.get("/api/stations")
def stations():
    args = request.args
    f = {"is_active": True}
    line = args.get("line", "").strip().lower()
    status = args.get("status", "").strip().lower()
    q = args.get("q", "").strip()[:80]
    if line and line not in {"purple", "aqua", "line3"}:
        raise ApiError(400, "line must be purple, aqua, or line3", "validation")
    if status and status not in {"operational", "under_construction", "planned", "requires_verification"}:
        raise ApiError(400, "Invalid station status", "validation")
    if line:
        f["lines.code"] = line
    if status:
        f["$or"] = [{f"status_by_line.{code}": status} for code in (line,) if line] or [
            {f"status_by_line.{code}": status} for code in ("purple", "aqua", "line3")
        ]
    if q:
        f["$and"] = [{"$or": [{"display_name": {"$regex": re.escape(q), "$options": "i"}},
                                  {"aliases": {"$regex": re.escape(q), "$options": "i"}}]}]
    return jsonify([ser(s) for s in get_db().stations.find(f).sort("display_name", 1)])


@bp.get("/api/stations/<station_id>")
def station(station_id):
    db = get_db()
    s = db.stations.find_one({"_id": oid(station_id, "station_id"), "is_active": True})
    if not s:
        raise ApiError(404, "Station not found", "not_found")
    s["shops"] = [ser(sh) for sh in db.shops.find({"$or": [{"station_ids": s["_id"]}, {"station_id": s["_id"]}], "is_active": True}).sort("name", 1)]
    return jsonify(ser(s))


@bp.get("/api/stations/<station_id>/shops")
def station_shops(station_id):
    db = get_db()
    sid = oid(station_id, "station_id")
    if not db.stations.find_one({"_id": sid, "is_active": True}, {"_id": 1}):
        raise ApiError(404, "Station not found", "not_found")
    f = {"$or": [{"station_ids": sid}, {"station_id": sid}], "is_active": True}
    category = request.args.get("category", "").strip()
    q = request.args.get("q", "").strip()[:80]
    if category:
        f["category"] = category[:30]
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        product_ids = [p["shop_id"] for p in db.products.find({"$or": [{"name": rx}, {"description": rx}]}, {"shop_id": 1})]
        f["$and"] = [f["$or"], {"$or": [{"name": rx}, {"description": rx}, {"_id": {"$in": product_ids}}]}]
    return jsonify([ser(sh) for sh in db.shops.find(f).sort("name", 1)])


@bp.get("/api/shops")
def shops():
    f = {"is_active": True}
    if request.args.get("station_id"):
        sid = oid(request.args["station_id"], "station_id")
        f["$or"] = [{"station_ids": sid}, {"station_id": sid}]
    if request.args.get("category"):
        f["category"] = request.args["category"][:30]
    q = (request.args.get("q") or "").strip()[:80]
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        pids = [p["shop_id"] for p in get_db().products.find({"$or": [{"name": rx}, {"description": rx}]}, {"shop_id": 1})]
        product_match = {"$or": [{"name": rx}, {"description": rx}, {"_id": {"$in": pids}}]}
        if "$or" in f:
            f["$and"] = [f.pop("$or"), product_match]
        else:
            f.update(product_match)
    return jsonify([ser(s) for s in get_db().shops.find(f).sort("name", 1)])


@bp.get("/api/shops/<shop_id>")
def shop(shop_id):
    s = get_db().shops.find_one({"_id": oid(shop_id, "shop_id"), "is_active": True})
    if not s:
        raise ApiError(404, "Shop not found", "not_found")
    return jsonify(ser(s))


def product_filter(shop_id=None):
    a = request.args
    f = {}
    if shop_id is not None:
        f["shop_id"] = shop_id
    elif a.get("shop_id"):
        f["shop_id"] = oid(a["shop_id"], "shop_id")
    elif a.get("station_id"):
        sid = oid(a["station_id"], "station_id")
        ids = [s["_id"] for s in get_db().shops.find({"$or": [{"station_ids": sid}, {"station_id": sid}], "is_active": True}, {"_id": 1})]
        f["shop_id"] = {"$in": ids}
    if a.get("category"):
        f["category"] = a["category"][:30]
    q = (a.get("q") or "").strip()[:80]
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        f["$or"] = [{"name": rx}, {"description": rx}]
    av = bool_arg(a.get("available"))
    if av is not None:
        f["is_available"] = av
    if bool_arg(a.get("vegetarian")):
        f["is_vegetarian"] = True
    if a.get("max_price_paise"):
        try:
            f["price_paise"] = {"$lte": int(a["max_price_paise"])}
        except ValueError:
            raise ApiError(400, "max_price_paise must be an integer", "validation")
    return f


@bp.get("/api/products")
def products():
    return jsonify([ser(p) for p in get_db().products.find(product_filter()).sort([("shop_id", 1), ("name", 1)]).limit(500)])


@bp.get("/api/shops/<shop_id>/products")
def shop_products(shop_id):
    sid = oid(shop_id, "shop_id")
    if not get_db().shops.find_one({"_id": sid}, {"_id": 1}):
        raise ApiError(404, "Shop not found", "not_found")
    return jsonify([ser(p) for p in get_db().products.find(product_filter(sid)).sort("name", 1)])


@bp.get("/api/products/<product_id>")
def product(product_id):
    p = get_db().products.find_one({"_id": oid(product_id, "product_id")})
    if not p:
        raise ApiError(404, "Product not found", "not_found")
    return jsonify(ser(p))


@bp.get("/api/offers")
def offers():
    f = {}
    if request.args.get("shop_id"):
        f["shop_id"] = oid(request.args["shop_id"], "shop_id")
    if request.args.get("station_id"):
        sid = oid(request.args["station_id"], "station_id")
        ids = [s["_id"] for s in get_db().shops.find({"$or": [{"station_ids": sid}, {"station_id": sid}], "is_active": True}, {"_id": 1})]
        f["shop_id"] = {"$in": ids}
    now = now_utc()
    out = [offer_json(o, now) for o in get_db().offers.find(f)]
    if not bool_arg(request.args.get("include_inactive"), False):
        out = [o for o in out if o["is_live"]]
    return jsonify(out)
