"""Repeatable, non-destructive seeding.

  python seed.py            # insert missing demo documents only (idempotent; never overwrites edits)
  python seed.py --reset --yes   # EXPLICIT: delete all documents in the app collections, then reseed
"""
import argparse
import json
import sys
from datetime import timedelta
from pathlib import Path

from config import Config
from db import COLLECTIONS, SETUP_HINT, ensure_indexes, make_client, ping
from util import now_utc, seed_oid

CATALOG = Path(__file__).parent / "data" / "catalog.json"

ZONE_TEXT = {
    "concourse": "Approximate demo placement near the station area. Not a real or verified location.",
    "nearby": "Approximate demo placement in the surrounding area. Not a real or verified location.",
}
CAT_TO_PRODUCT_DIET = {True: ["vegetarian"], False: ["non-vegetarian"]}

DEMO_ORDERS = [  # (order_number, shop, [(product_key, qty)], status, arrive_in_min)
    ("PMH-DEMO01", "vada-junction", [("vada-junction-vp", 2), ("vada-junction-dvp", 1)], "placed", 15),
    ("PMH-DEMO02", "misal-ghar", [("misal-ghar-misal", 1)], "preparing", 10),
    ("PMH-DEMO03", "chai-tapri", [("chai-tapri-chai", 2), ("chai-tapri-bun", 2)], "ready", 5),
    ("PMH-DEMO04", "baker-basket", [("baker-basket-cookie", 2)], "collected", -20),
]


def _insert_missing(coll, doc):
    """Insert only if the deterministic _id is absent; existing (possibly edited) docs are untouched."""
    res = coll.update_one({"_id": doc["_id"]}, {"$setOnInsert": doc}, upsert=True)
    return 1 if res.upserted_id is not None else 0


def seed(db, reset: bool = False) -> dict:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    now = now_utc()
    if reset:
        for c in COLLECTIONS:
            db[c].delete_many({})
    added = {c: 0 for c in COLLECTIONS}

    for s in cat["stations"]:
        lines = [{"code": l, "name": "Purple Line" if l == "purple" else "Aqua Line", "line_number": 1 if l == "purple" else 2} for l in s["lines"]]
        added["stations"] += _insert_missing(db.stations, {
            "_id": seed_oid("station:" + s["id"]), "seed_key": s["id"],
            "name": s["name"].split(" (")[0], "display_name": s["name"], "lines": lines,
            "is_active": True, "has_demo_shops": s["hasDemoShops"],
            "info_source": "Name and lines confirmed from public secondary sources (Wikipedia/news). "
                           "punemetrorail.org was not verified; re-check before presenting as official.",
        })

    for sh in cat["shops"]:
        added["shops"] += _insert_missing(db.shops, {
            "_id": seed_oid("shop:" + sh["id"]), "seed_key": sh["id"], "name": sh["name"],
            "description": sh["desc"], "category": sh["category"],
            "station_ids": [seed_oid("station:" + sh["stationId"])],
            "shop_type": "demo" if sh["kind"] == "demo" else "verified",
            "location_description": ZONE_TEXT[sh["zone"]], "zone": sh["zone"],
            "availability": "open_demo", "is_active": True,
            "ui": {"hue": sh["hue"], "icon": sh["icon"]}, "created_at": now, "updated_at": now,
        })

    for p in cat["products"]:
        added["products"] += _insert_missing(db.products, {
            "_id": seed_oid("product:" + p["id"]), "seed_key": p["id"],
            "shop_id": seed_oid("shop:" + p["shopId"]), "name": p["name"], "description": p["desc"],
            "category": p["category"], "price_paise": int(p["price"]) * 100, "image_url": None,
            "is_vegetarian": p["veg"], "dietary_tags": CAT_TO_PRODUCT_DIET[p["veg"]],
            "is_available": p["available"], "preparation_minutes": p["prepMin"],
            "created_at": now, "updated_at": now,
        })

    for o in cat["offers"]:
        added["offers"] += _insert_missing(db.offers, {
            "_id": seed_oid("offer:" + o["id"]), "seed_key": o["id"], "shop_id": seed_oid("shop:" + o["shopId"]),
            "title": o["title"], "description": "Demo offer (fictional).", "discount_type": "percent",
            "discount_value": o["percent"], "min_subtotal_paise": o["minSubtotal"] * 100,
            "start_at": now, "end_at": None, "is_active": o["active"],
        })

    station_id = seed_oid("station:district-court")
    for number, shop_key, items, status, arrive in DEMO_ORDERS:
        if db.orders.find_one({"order_number": number}):
            continue
        embedded = []
        for pkey, qty in items:
            p = db.products.find_one({"_id": seed_oid("product:" + pkey)})
            if not p:
                continue
            embedded.append({"product_id": p["_id"], "product_name": p["name"], "unit_price_paise": p["price_paise"],
                             "quantity": qty, "line_total_paise": p["price_paise"] * qty})
        if not embedded:
            continue
        sub = sum(i["line_total_paise"] for i in embedded)
        arrival = now + timedelta(minutes=arrive)
        created = now - timedelta(minutes=15)
        added["orders"] += _insert_missing(db.orders, {
            "_id": seed_oid("order:" + number), "order_number": number, "station_id": station_id,
            "shop_id": seed_oid("shop:" + shop_key), "items": embedded, "subtotal_paise": sub,
            "discount_paise": 0, "total_paise": sub, "status": status, "expected_arrival_at": arrival,
            "preferred_pickup_at": arrival + timedelta(minutes=5), "customer_notes": "",
            "is_demo_seed": True, "status_history": [{"status": "placed", "at": created}],
            "created_at": created, "updated_at": now,
        })
    return added


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="delete all app documents first")
    ap.add_argument("--yes", action="store_true", help="confirm --reset")
    a = ap.parse_args()
    if a.reset and not a.yes:
        sys.exit("--reset deletes all documents in: " + ", ".join(COLLECTIONS) + ". Re-run with --reset --yes to confirm.")
    cfg = {"MONGO_URI": Config.MONGO_URI, "MONGO_TIMEOUT_MS": Config.MONGO_TIMEOUT_MS}
    db = make_client(cfg)[Config.MONGO_DB_NAME]
    ok, why = ping(db)
    if not ok:
        sys.exit(f"ERROR ({why}): " + SETUP_HINT.format(uri=Config.MONGO_URI))
    ensure_indexes(db)
    print("Inserted:", seed(db, reset=a.reset))


if __name__ == "__main__":
    main()
