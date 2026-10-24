"""MongoDB access (PyMongo). One client per app; no credentials are hardcoded."""
import logging

from flask import current_app
from pymongo import ASCENDING, MongoClient
from pymongo.errors import PyMongoError

log = logging.getLogger("pmh.db")

COLLECTIONS = ["stations", "shops", "products", "offers", "orders"]

SETUP_HINT = (
    "Could not reach MongoDB at {uri}. Make sure MongoDB Community Server is installed and running "
    "(Windows: `Get-Service *mongo*` then `Start-Service MongoDB`) and MONGO_URI in backend/.env is correct. "
    "MongoDB Compass is only a GUI; it does not include the server."
)


def make_client(cfg) -> MongoClient:
    return MongoClient(cfg["MONGO_URI"], serverSelectionTimeoutMS=cfg["MONGO_TIMEOUT_MS"], tz_aware=True)


def get_db():
    return current_app.extensions["pmh_db"]


def ping(db) -> tuple[bool, str]:
    try:
        db.client.admin.command("ping")
        return True, ""
    except PyMongoError as e:  # connection / timeout errors
        return False, e.__class__.__name__


def ensure_indexes(db):
    db.stations.create_index([("is_active", ASCENDING)])
    db.shops.create_index([("station_ids", ASCENDING), ("is_active", ASCENDING)])
    db.shops.create_index([("category", ASCENDING)])
    db.products.create_index([("shop_id", ASCENDING), ("is_available", ASCENDING)])
    db.products.create_index([("category", ASCENDING)])
    db.products.create_index([("name", ASCENDING)])
    db.offers.create_index([("shop_id", ASCENDING), ("is_active", ASCENDING)])
    db.orders.create_index([("order_number", ASCENDING)], unique=True)
    db.orders.create_index([("shop_id", ASCENDING), ("status", ASCENDING)])
    db.orders.create_index([("station_id", ASCENDING)])
    db.orders.create_index([("created_at", -1)])
