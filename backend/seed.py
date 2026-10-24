"""Repeatable, non-destructive seeding.

  python seed.py            # idempotent; inserts missing demo docs and refreshes source-managed station/import records
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
STATIONS = Path(__file__).resolve().parents[1] / "data" / "stations.json"
STATION_OUTLETS = Path(__file__).parent / "data" / "station_outlets.json"

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
    """Insert only if deterministic _id is absent; other reconciliation is explicit and source-scoped."""
    res = coll.update_one({"_id": doc["_id"]}, {"$setOnInsert": doc}, upsert=True)
    return 1 if res.upserted_id is not None else 0


def seed(db, reset: bool = False) -> dict:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    station_data = json.loads(STATIONS.read_text(encoding="utf-8"))
    curated_outlets = json.loads(STATION_OUTLETS.read_text(encoding="utf-8"))
    now = now_utc()
    if reset:
        for c in COLLECTIONS:
            db[c].delete_many({})
    added = {c: 0 for c in COLLECTIONS}

    station_docs = {}
    route_keys = set()
    for line in station_data["lines"]:
        for item in line["stations"]:
            route_key = (line["code"], item["id"])
            if route_key in route_keys or item["status"] not in station_data["status_notes"]:
                raise ValueError(f"Duplicate station on {line['code']} or invalid status: {item['id']}")
            route_keys.add(route_key)
            doc = station_docs.setdefault(item["id"], {
                "_id": seed_oid("station:" + item["id"]), "seed_key": item["id"],
                "name": item["name"], "display_name": item["name"], "aliases": [], "lines": [],
                "sequence": {}, "status_by_line": {}, "source_urls": [], "is_active": True,
                "has_demo_shops": item["id"] == "district-court",
                "is_interchange": False, "data_source": "Official operator / authority station references",
            })
            doc["aliases"] = sorted(set(doc["aliases"] + item.get("aliases", [])))
            doc["lines"].append({"code": line["code"], "name": line["name"], "line_number": line["number"]})
            doc["sequence"][line["code"]] = item["order"]
            doc["status_by_line"][line["code"]] = item["status"]
            doc["source_urls"].append(station_data["sources"][line["code"]])
            if item["status"] != "operational" and line.get("status_source_url"):
                doc["source_urls"].append(line["status_source_url"])
            if item["status"] == "under_construction" and line["code"] == "purple":
                doc["source_urls"].append(station_data["sources"]["extensions"])
    for doc in station_docs.values():
        doc["is_interchange"] = len(doc["lines"]) > 1
        statuses = set(doc["status_by_line"].values())
        doc["status"] = next(iter(statuses)) if len(statuses) == 1 else "requires_verification"
        doc["status_note"] = " ".join(sorted({station_data["status_notes"][status] for status in statuses}))
        doc["source_urls"] = sorted(set(doc["source_urls"]))
        doc["info_source"] = "Official references; status is recorded per line and may require rechecking."
        added["stations"] += _insert_missing(db.stations, doc)
        # Canonical station metadata is source-managed. This backfills/refreshes it without touching
        # shop, product, offer, order, or user-owned station fields such as local active state.
        db.stations.update_one({"_id": doc["_id"]}, {"$set": {k: v for k, v in doc.items() if k not in ("_id", "seed_key", "is_active")}})

    for sh in cat["shops"]:
        shop_doc = {
            "_id": seed_oid("shop:" + sh["id"]), "seed_key": sh["id"], "name": sh["name"],
            "description": sh["desc"], "category": sh["category"],
            "station_ids": [seed_oid("station:" + sh["stationId"])],
            "shop_type": "demo" if sh["kind"] == "demo" else "verified",
            "location_description": ZONE_TEXT[sh["zone"]], "zone": sh["zone"],
            "location_type": "demo_unverified" if sh["kind"] == "demo" else None,
            "distance_metres": None, "address": None, "opening_hours": None,
            "data_source": "Synthetic hackathon sample catalog" if sh["kind"] == "demo" else "",
            "verification_status": "sample" if sh["kind"] == "demo" else "unverified",
            "last_verified_at": None,
            "availability": "open_demo", "is_active": True,
            "ui": {"hue": sh["hue"], "icon": sh["icon"]}, "created_at": now, "updated_at": now,
        }
        added["shops"] += _insert_missing(db.shops, shop_doc)
        db.shops.update_one({"_id": shop_doc["_id"], "shop_type": "demo"}, {"$set": {
            "location_type": "demo_unverified", "distance_metres": None, "address": None,
            "opening_hours": None, "data_source": "Synthetic hackathon sample catalog",
            "verification_status": "sample", "last_verified_at": None,
        }})
        # Backfill the legacy station_ids relationship for existing seed outlets only when absent.
        db.shops.update_one({"_id": shop_doc["_id"], "$or": [{"station_ids": {"$exists": False}}, {"station_ids": []}]},
                            {"$set": {"station_ids": shop_doc["station_ids"]}})

    for p in cat["products"]:
        product_doc = {
            "_id": seed_oid("product:" + p["id"]), "seed_key": p["id"],
            "shop_id": seed_oid("shop:" + p["shopId"]), "name": p["name"], "description": p["desc"],
            "category": p["category"], "price_paise": int(p["price"]) * 100, "image_url": None,
            "is_vegetarian": p["veg"], "dietary_tags": CAT_TO_PRODUCT_DIET[p["veg"]],
            "is_available": p["available"], "preparation_minutes": p["prepMin"],
            "created_at": now, "updated_at": now,
            "data_source": "Synthetic hackathon sample catalog", "verification_status": "sample",
        }
        added["products"] += _insert_missing(db.products, product_doc)
        db.products.update_one({"_id": product_doc["_id"], "verification_status": {"$exists": False}}, {"$set": {
            "data_source": "Synthetic hackathon sample catalog", "verification_status": "sample",
            "dietary_tags": CAT_TO_PRODUCT_DIET[p["veg"]],
        }})

    canonical_station_ids = {key: doc["_id"] for key, doc in station_docs.items()}
    active_curated_shop_ids, active_curated_product_ids = set(), set()
    for outlet in curated_outlets:
        required = {"id", "name", "category", "description", "station_ids", "location_type", "source_url",
                    "verification_status", "last_verified_at", "products"}
        if not isinstance(outlet, dict) or not required.issubset(outlet):
            raise ValueError("Each curated outlet must include its identity, classification, station, source, verification date and products fields")
        if outlet["category"] not in {"chai", "bites", "meals", "bakery", "store", "essentials"}:
            raise ValueError(f"Invalid outlet category for {outlet['id']}")
        if outlet["location_type"] not in {"inside_station", "station_premises", "nearby_outside"}:
            raise ValueError(f"Invalid location_type for {outlet['id']}")
        if outlet["verification_status"] != "verified" or not outlet["source_url"] or not outlet["last_verified_at"]:
            raise ValueError(f"Curated real outlet {outlet['id']} requires a verified source URL and last_verified_at")
        if not outlet["station_ids"] or any(key not in canonical_station_ids for key in outlet["station_ids"]):
            raise ValueError(f"Unknown or missing station reference for outlet {outlet['id']}")
        shop_id = seed_oid("curated-shop:" + outlet["id"])
        active_curated_shop_ids.add(shop_id)
        shop_doc = {
            "_id": shop_id, "seed_key": outlet["id"], "name": outlet["name"], "description": outlet["description"],
            "source_managed": True,
            "category": outlet["category"], "station_ids": [canonical_station_ids[key] for key in outlet["station_ids"]],
            "shop_type": "verified", "location_type": outlet["location_type"],
            "distance_metres": outlet.get("distance_metres"), "address": outlet.get("address"),
            "opening_hours": outlet.get("opening_hours"), "contact": outlet.get("contact"),
            "coordinates": outlet.get("coordinates"), "data_source": outlet["source_url"],
            "verification_status": "verified", "last_verified_at": outlet["last_verified_at"],
            "zone": "nearby" if outlet["location_type"] == "nearby_outside" else "concourse",
            "location_description": outlet.get("address") or outlet["location_type"],
            "availability": "verified_source", "is_active": True, "created_at": now, "updated_at": now,
        }
        added["shops"] += _insert_missing(db.shops, shop_doc)
        db.shops.update_one({"_id": shop_id, "source_managed": True}, {"$set": {k: v for k, v in shop_doc.items() if k not in ("_id", "created_at")}})
        for item in outlet["products"]:
            if not isinstance(item.get("price_paise"), int) or item["price_paise"] < 0 or not isinstance(item.get("is_vegetarian"), bool):
                raise ValueError(f"Product {item.get('id')} in {outlet['id']} needs integer price_paise and boolean is_vegetarian")
            product_id = seed_oid("curated-product:" + item["id"])
            active_curated_product_ids.add(product_id)
            product_doc = {
                "_id": product_id, "seed_key": item["id"], "shop_id": shop_id, "name": item["name"],
                "source_managed": True,
                "description": item.get("description", ""), "category": item.get("category", outlet["category"]),
                "price_paise": item["price_paise"], "image_url": None, "is_vegetarian": item["is_vegetarian"],
                "dietary_tags": item.get("dietary_tags", CAT_TO_PRODUCT_DIET[item["is_vegetarian"]]),
                "is_available": item.get("is_available", True), "preparation_minutes": item.get("preparation_minutes", 0),
                "data_source": outlet["source_url"], "verification_status": "verified",
                "last_verified_at": outlet["last_verified_at"], "created_at": now, "updated_at": now,
            }
            added["products"] += _insert_missing(db.products, product_doc)
            db.products.update_one({"_id": product_id, "source_managed": True}, {"$set": {k: v for k, v in product_doc.items() if k not in ("_id", "created_at")}})

    db.shops.update_many({"source_managed": True, "_id": {"$nin": list(active_curated_shop_ids)}}, {"$set": {"is_active": False}})
    db.products.update_many({"source_managed": True, "_id": {"$nin": list(active_curated_product_ids)}}, {"$set": {"is_available": False}})

    # Retire two prior seed keys whose canonical station ids were renamed. Keep their records
    # intact for existing references rather than deleting documents.
    for old_key, new_key in (("deccan", "deccan-gymkhana"), ("pune-rly", "pune-railway-station")):
        db.stations.update_one({"seed_key": old_key}, {"$set": {
            "is_active": False, "canonical_station_id": seed_oid("station:" + new_key),
        }})

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
