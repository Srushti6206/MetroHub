import app as app_module
from services import ai_service
from tests.conftest import STATION, pid, sid


def ask(client, msg, **kw):
    return client.post("/api/chat", json={"message": msg, "station_id": STATION, **kw})


def test_rule_based_veg_snacks_under_100(client):
    r = ask(client, "Suggest vegetarian snacks under ₹100")
    j = r.json
    assert r.status_code == 200 and j["mode"] == "rule_based" and j["recommendations"]
    assert j["total_paise"] == sum(c["price_paise"] for c in j["recommendations"]) <= 10000
    for c in j["recommendations"]:
        assert c["is_vegetarian"] and c["is_available"]
        assert client.get(f"/api/products/{c['product_id']}").json["price_paise"] == c["price_paise"]  # real, current price


def test_vegetarian_chat_rejects_mislabeled_egg_products(client, db):
    # Exercise the active backend path even if an old/edited Mongo record has the wrong diet flag.
    db.products.update_many({}, {"$set": {"is_available": False}})
    db.products.update_one({"seed_key": "chai-tapri-omelette"}, {"$set": {"is_available": True, "is_vegetarian": True}})
    db.products.update_one({"seed_key": "baker-basket-cookie"}, {"$set": {"is_available": True}})

    response = ask(client, "Suggest vegetarian snacks under ₹100").json
    ids = {item["product_id"] for item in response["recommendations"]}
    assert response["recommendations"]
    assert pid("chai-tapri-omelette") not in ids
    assert pid("baker-basket-cookie") in ids  # an eggless item remains eligible


def test_budget_and_minutes_from_text(client):
    j = ask(client, "I have ₹120 and 10 minutes. Suggest something vegetarian.").json
    assert j["recommendations"] and j["total_paise"] <= 12000
    assert all(c["preparation_minutes"] <= 10 and c["is_vegetarian"] for c in j["recommendations"])


def test_chai_and_bite_and_meal(client):
    j = ask(client, "Find chai and a quick bite").json
    assert {c["shop_id"] for c in j["recommendations"]} == {j["recommendations"][0]["shop_id"]} and len(j["recommendations"]) == 2
    m = ask(client, "Build a meal under ₹150").json
    assert m["recommendations"] and m["total_paise"] <= 15000


def test_train_question_asks_followup(client):
    j = ask(client, "What can I pick up before my train?").json
    assert j["recommendations"] == [] and "minutes" in j["reply"]
    assert ask(client, "What can I pick up before my train? I have 10 minutes").json["recommendations"]


def test_unavailable_never_recommended(client, db):
    db.products.update_many({}, {"$set": {"is_available": False}})
    j = ask(client, "snacks under ₹100").json
    assert j["recommendations"] == [] and "couldn't find" in j["reply"]


def test_owner_change_reflected_in_chat(client):
    for c in ask(client, "vegetarian snacks under ₹100").json["recommendations"]:
        client.patch(f"/api/owner/products/{c['product_id']}", json={"is_available": False}, headers={"X-Demo-Owner-Shop": c["shop_id"]})
    after = ask(client, "vegetarian snacks under ₹100").json
    assert all(c["is_available"] for c in after["recommendations"])


def test_validation_and_limits(client):
    assert client.post("/api/chat", json={"station_id": STATION}).status_code == 400
    assert ask(client, "x" * 501).status_code == 400
    assert client.post("/api/chat", json={"message": "hi", "station_id": "bad"}).status_code == 400
    assert ask(client, "hi", history="nope").status_code == 400
    assert ask(client, "snacks", budget_paise=5).status_code == 400


def test_rate_limit(db):
    a = app_module.create_app({"TESTING": True, "CHAT_RATE_LIMIT_PER_MIN": 2}, db=db)
    c = a.test_client()
    codes = [c.post("/api/chat", json={"message": "hi", "station_id": STATION}, environ_base={"REMOTE_ADDR": "9.9.9.9"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# ---- LLM (mocked; no key or network needed) ----
LLM_CFG = {"AI_PROVIDER": "openai", "OPENAI_API_KEY": "test-key", "OPENAI_MODEL": "test-model", "CHAT_RATE_LIMIT_PER_MIN": 1000}


def llm_client(db, monkeypatch, fn):
    monkeypatch.setattr("routes.chat.ask_llm", fn)
    return app_module.create_app({"TESTING": True, **LLM_CFG}, db=db).test_client()


def test_llm_mode_valid_response(db, monkeypatch):
    ids = [pid("vada-junction-vp"), pid("vada-junction-sand")]
    c = llm_client(db, monkeypatch, lambda *a, **k: {"reply": "Quick veg combo from one stall.", "product_ids": ids})
    j = ask(c, "veg snacks under ₹100").json
    assert j["mode"] == "llm" and [x["product_id"] for x in j["recommendations"]] == ids
    assert j["total_paise"] == 2000 + 5900  # backend-calculated


def test_llm_hallucinated_id_falls_back(db, monkeypatch):
    c = llm_client(db, monkeypatch, lambda *a, **k: {"reply": "ok", "product_ids": ["f" * 24]})
    j = ask(c, "veg snacks under ₹100").json
    assert j["mode"] == "rule_based" and "unusable" in j["fallback_note"] and j["recommendations"]


def test_llm_cannot_break_budget_diet_or_availability(db, monkeypatch):
    # chicken roll: non-veg, ₹99 -> outside veg-only eligible pool; lemon tea unavailable
    for bad in ([pid("vada-junction-chicken")], [pid("chai-tapri-lemon")]):
        c = llm_client(db, monkeypatch, lambda *a, _b=bad, **k: {"reply": "x", "product_ids": _b})
        j = ask(c, "vegetarian snacks under ₹100").json
        assert j["mode"] == "rule_based"
    c = llm_client(db, monkeypatch, lambda *a, **k: {"reply": "x", "product_ids": [pid("vada-junction-vp"), pid("chai-tapri-chai")]})
    assert ask(c, "snacks under ₹100").json["mode"] == "rule_based"  # two shops -> rejected


def test_llm_reply_with_prices_is_replaced(db, monkeypatch):
    c = llm_client(db, monkeypatch, lambda *a, **k: {"reply": "Only ₹5 for everything!", "product_ids": [pid("vada-junction-vp")]})
    assert "₹5" not in ask(c, "snacks under ₹100").json["reply"]


def test_llm_provider_error_falls_back(db, monkeypatch):
    def fail(*a, **k):
        raise ai_service.AIError("rate_limited")
    j = ask(llm_client(db, monkeypatch, fail), "snacks under ₹100").json
    assert j["mode"] == "rule_based" and "rate_limited" in j["fallback_note"] and j["recommendations"]


def test_ask_llm_handles_timeout_and_bad_json(monkeypatch):
    import urllib.request, pytest
    cfg = {"OPENAI_API_KEY": "k", "OPENAI_MODEL": "m", "AI_TIMEOUT_SECONDS": 1}
    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(TimeoutError()))
    with pytest.raises(ai_service.AIError):
        ai_service.ask_llm(cfg, "hi", [], {}, [])

    class R:
        def __enter__(s): return s
        def __exit__(s, *a): pass
        def read(s): return b'{"choices":[{"message":{"content":"not json"}}]}'
    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: R())
    with pytest.raises(ai_service.AIError):
        ai_service.ask_llm(cfg, "hi", [], {}, [])
