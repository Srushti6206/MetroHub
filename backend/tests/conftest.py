import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import mongomock
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app  # noqa: E402
from seed import seed  # noqa: E402
from util import seed_oid  # noqa: E402


@pytest.fixture()
def db():
    d = mongomock.MongoClient(tz_aware=True)["pmh_test"]
    seed(d)
    return d


@pytest.fixture()
def app(db):
    return create_app({"TESTING": True, "CHAT_RATE_LIMIT_PER_MIN": 1000, "AI_PROVIDER": "", "OPENAI_API_KEY": "", "OPENAI_MODEL": ""}, db=db)


@pytest.fixture()
def client(app):
    return app.test_client()


STATION = str(seed_oid("station:district-court"))


def sid(shop):
    return str(seed_oid("shop:" + shop))


def pid(key):
    return str(seed_oid("product:" + key))


def in_min(m):
    return (datetime.now(timezone.utc) + timedelta(minutes=m)).isoformat().replace("+00:00", "Z")


def order_body(items, shop="vada-junction", arrive=15, pickup=25, **kw):
    b = {"station_id": STATION, "shop_id": sid(shop), "items": items,
         "expected_arrival_at": in_min(arrive), "preferred_pickup_at": in_min(pickup)}
    b.update(kw)
    return b


def owner(shop):
    return {"X-Demo-Owner-Shop": sid(shop)}
