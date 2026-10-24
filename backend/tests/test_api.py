import json

import mongomock
import pytest
from pymongo.errors import ServerSelectionTimeoutError

from app import create_app
from seed import seed
from tests.conftest import STATION, in_min, order_body, owner, pid, sid


# ---- health / db ----
def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json["database"]["connected"] is True and r.json["chat_mode"] == "rule_based"


def test_health_reports_db_down(app, client, monkeypatch):
    def boom(*a, **k):
        raise ServerSelectionTimeoutError("down")
    monkeypatch.setattr(app.extensions["pmh_db"].client.admin, "command", boom, raising=False)
    r = client.get("/api/health")
    assert r.status_code == 503 and r.json["database"]["connected"] is False and "hint" in r.json["database"]


def test_catalog_returns_503_when_db_fails(app, client, monkeypatch):
    def boom(*a, **k):
        raise ServerSelectionTimeoutError("down")
    monkeypatch.setattr(app.extensions["pmh_db"].shops, "find", boom)
    r = client.get("/api/shops")
    assert r.status_code == 503 and r.json["error"]["code"] == "db_unavailable"


# ---- seed ----
def test_seed_idempotent_and_non_destructive(db):
    before = {c: db[c].count_documents({}) for c in ["stations", "shops", "products", "offers", "orders"]}
    db.products.update_one({"seed_key": "vada-junction-vp"}, {"$set": {"price_paise": 2500}})
    assert sum(seed(db).values()) == 0
    assert {c: db[c].count_documents({}) for c in before} == before
    assert db.products.find_one({"seed_key": "vada-junction-vp"})["price_paise"] == 2500  # edit survived


def test_seed_prices_are_paise_and_ids_stable(client):
    p = client.get(f"/api/products/{pid('vada-junction-vp')}").json
    assert p["price_paise"] == 2000 and p["id"] == pid("vada-junction-vp")


# ---- reads / filters ----
def test_stations_and_shops(client):
    st = client.get("/api/stations").json
    dc = next(s for s in st if s["id"] == STATION)
    assert dc["display_name"] == "District Court (Civil Court)" and [l["code"] for l in dc["lines"]] == ["purple", "aqua"]
    shops = client.get(f"/api/shops?station_id={STATION}").json
    assert len(shops) == 7 and all(s["shop_type"] == "demo" for s in shops)
    assert client.get(f"/api/shops/{sid('chai-tapri')}").json["name"] == "Tapri Express"


def test_filters(client):
    veg = client.get(f"/api/products?station_id={STATION}&vegetarian=true&available=true&max_price_paise=10000&category=bites").json
    assert veg and all(p["is_vegetarian"] and p["is_available"] and p["price_paise"] <= 10000 and p["category"] == "bites" for p in veg)
    s = client.get("/api/products?q=misal").json
    assert any("Misal" in p["name"] for p in s)
    assert client.get(f"/api/shops/{sid('chai-tapri')}/products").json


def test_invalid_ids_and_not_found(client):
    assert client.get("/api/products/not-an-id").status_code == 400
    assert client.get("/api/products/" + "a" * 24).status_code == 404
    assert client.get("/api/shops?station_id=zzz").status_code == 400
    assert client.get("/api/nope").status_code == 404


def test_no_raw_objectid_in_json(client):
    assert "ObjectId" not in client.get("/api/orders").get_data(as_text=True)


# ---- orders ----
def test_create_order_server_side_pricing(client):
    body = order_body([{"product_id": pid("vada-junction-vp"), "quantity": 3}, {"product_id": pid("vada-junction-cs"), "quantity": 1}])
    body["total_paise"] = 1  # client-supplied totals must be ignored
    r = client.post("/api/orders", json=body)
    assert r.status_code == 201, r.json
    o = r.json
    assert o["subtotal_paise"] == 3 * 2000 + 8900 and o["discount_paise"] == 15 * o["subtotal_paise"] // 100  # 15% offer, >= ₹99
    assert o["total_paise"] == o["subtotal_paise"] - o["discount_paise"] and o["status"] == "placed"
    assert o["order_number"].startswith("PMH-") and {i["line_total_paise"] for i in o["items"]} == {6000, 8900}
    assert client.get(f"/api/orders/{o['id']}").json["total_paise"] == o["total_paise"]


def test_order_snapshot_survives_price_change(client):
    o = client.post("/api/orders", json=order_body([{"product_id": pid("vada-junction-vp"), "quantity": 1}])).json
    assert client.patch(f"/api/owner/products/{pid('vada-junction-vp')}", json={"price_paise": 9900}, headers=owner("vada-junction")).status_code == 200
    assert client.get(f"/api/orders/{o['id']}").json["items"][0]["unit_price_paise"] == 2000


@pytest.mark.parametrize("mut,code", [
    (lambda b: b.update(items=[]), 400),
    (lambda b: b.update(items=[{"product_id": "bad", "quantity": 1}]), 400),
    (lambda b: b.update(items=[{"product_id": "a" * 24, "quantity": 1}]), 404),
    (lambda b: b["items"][0].update(quantity=0), 400),
    (lambda b: b["items"][0].update(quantity=99), 400),
    (lambda b: b["items"][0].update(quantity="2"), 400),
    (lambda b: b.update(shop_id=sid("chai-tapri")), 422),  # product from another shop
    (lambda b: b.update(station_id="b" * 24), 404),
])
def test_order_validation(client, mut, code):
    b = order_body([{"product_id": pid("vada-junction-vp"), "quantity": 1}])
    mut(b)
    assert client.post("/api/orders", json=b).status_code == code


def test_unavailable_product_rejected(client):
    r = client.post("/api/orders", json=order_body([{"product_id": pid("chai-tapri-lemon"), "quantity": 1}], shop="chai-tapri"))
    assert r.status_code == 409 and "unavailable" in r.json["error"]["message"]


def test_pickup_rules(client):
    item = [{"product_id": pid("vada-junction-cs"), "quantity": 1}]  # prep 9 min
    assert client.post("/api/orders", json=order_body(item, arrive=1, pickup=3)).status_code == 422  # too early for prep
    assert client.post("/api/orders", json=order_body(item, arrive=20, pickup=10)).status_code == 422  # pickup before arrival
    assert client.post("/api/orders", json=order_body(item, arrive=-30, pickup=-20)).status_code == 422  # past
    assert client.post("/api/orders", json=order_body(item, arrive=10, pickup=12)).status_code == 201
    bad = order_body(item)
    bad["expected_arrival_at"] = "not-a-date"
    assert client.post("/api/orders", json=bad).status_code == 400


def test_status_transitions_and_owner_scope(client):
    o = client.post("/api/orders", json=order_body([{"product_id": pid("vada-junction-vp"), "quantity": 1}])).json
    h = owner("vada-junction")
    assert client.patch(f"/api/owner/orders/{o['id']}/status", json={"status": "ready"}, headers=h).status_code == 409
    assert client.patch(f"/api/owner/orders/{o['id']}/status", json={"status": "accepted"}, headers=owner("chai-tapri")).status_code == 403
    for s in ("accepted", "preparing", "ready", "collected"):
        r = client.patch(f"/api/owner/orders/{o['id']}/status", json={"status": s}, headers=h)
        assert r.status_code == 200 and r.json["status"] == s
    assert client.patch(f"/api/owner/orders/{o['id']}/status", json={"status": "placed"}, headers=h).status_code == 409
    assert client.get(f"/api/orders/{o['id']}").json["status"] == "collected"  # customer sees owner change
    assert client.patch(f"/api/owner/orders/{o['id']}/status", json={"status": "bogus"}, headers=h).status_code == 400


def test_customer_cannot_reject(client):
    o = client.post("/api/orders", json=order_body([{"product_id": pid("vada-junction-vp"), "quantity": 1}])).json
    assert client.patch(f"/api/orders/{o['id']}/status", json={"status": "rejected"}).status_code == 403
    assert client.patch(f"/api/orders/{o['id']}/status", json={"status": "accepted"}).status_code == 200


# ---- owner CRUD ----
def test_owner_requires_demo_header(client):
    assert client.get("/api/owner/products").status_code == 400
    assert client.get("/api/owner/products", headers={"X-Demo-Owner-Shop": "a" * 24}).status_code == 404


def test_owner_product_crud_visible_to_customers(client):
    h = owner("tiffin-tales")
    r = client.post("/api/owner/products", headers=h, json={"name": "Sheera", "description": "Sweet", "category": "meals",
                                                            "price_paise": 4900, "preparation_minutes": 5, "is_vegetarian": True})
    assert r.status_code == 201 and r.json["shop_id"] == sid("tiffin-tales")
    new_id = r.json["id"]
    assert any(p["id"] == new_id for p in client.get(f"/api/shops/{sid('tiffin-tales')}/products").json)
    assert client.patch(f"/api/owner/products/{new_id}", headers=h, json={"price_paise": 5900, "is_available": False}).status_code == 200
    p = client.get(f"/api/products/{new_id}").json
    assert p["price_paise"] == 5900 and p["is_available"] is False
    assert client.patch(f"/api/owner/products/{new_id}", headers=owner("chai-tapri"), json={"price_paise": 100}).status_code == 403
    assert client.patch(f"/api/owner/products/{new_id}", headers=h, json={"price_paise": -5}).status_code == 400
    assert client.post("/api/owner/products", headers=h, json={"name": "x"}).status_code == 400
    assert client.delete(f"/api/owner/products/{new_id}", headers=h).status_code == 204
    assert client.get(f"/api/products/{new_id}").status_code == 404


def test_owner_offer_crud_and_validation(client):
    h = owner("chai-tapri")
    base = {"title": "20% off", "discount_type": "percent", "discount_value": 20, "min_subtotal_paise": 5000}
    r = client.post("/api/owner/offers", headers=h, json=base)
    assert r.status_code == 201 and r.json["is_live"] is True
    oid_ = r.json["id"]
    assert client.post("/api/owner/offers", headers=h, json={**base, "discount_value": 95}).status_code == 400
    assert client.post("/api/owner/offers", headers=h, json={**base, "discount_type": "bogus"}).status_code == 400
    assert client.post("/api/owner/offers", headers=h, json={**base, "start_at": in_min(60), "end_at": in_min(10)}).status_code == 400
    expired = client.post("/api/owner/offers", headers=h, json={**base, "start_at": in_min(-120), "end_at": in_min(-60)}).json
    live_ids = [o["id"] for o in client.get("/api/offers").json]
    assert oid_ in live_ids and expired["id"] not in live_ids
    assert client.patch(f"/api/owner/offers/{oid_}", headers=owner("vada-junction"), json={"is_active": False}).status_code == 403
    assert client.patch(f"/api/owner/offers/{oid_}", headers=h, json={"is_active": False}).status_code == 200
    assert oid_ not in [o["id"] for o in client.get("/api/offers").json]
    assert client.delete(f"/api/owner/offers/{oid_}", headers=h).status_code == 204


# ---- misc security ----
def test_cors_only_for_configured_origin(app):
    c = app.test_client()
    ok = c.get("/api/stations", headers={"Origin": "http://localhost:5173"})
    bad = c.get("/api/stations", headers={"Origin": "https://evil.example"})
    assert ok.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert "Access-Control-Allow-Origin" not in bad.headers


def test_request_size_limit(client):
    assert client.post("/api/orders", data="x" * 70000, content_type="application/json").status_code == 413


def test_order_lookup_by_order_number(client):
    o = client.post("/api/orders", json=order_body([{"product_id": pid("vada-junction-vp"), "quantity": 1}])).json
    assert client.get(f"/api/orders/{o['order_number']}").json["id"] == o["id"]
    assert client.patch(f"/api/orders/{o['order_number']}/status", json={"status": "accepted"}).json["status"] == "accepted"
    assert client.get("/api/orders/PMH-ZZZZZZ").status_code == 404
