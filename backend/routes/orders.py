from flask import Blueprint, current_app, jsonify, request

from db import get_db
from services import order_service as svc
from util import ApiError, json_body, oid, parse_dt, ser

bp = Blueprint("orders", __name__)


@bp.post("/api/orders")
def create():
    doc = svc.create_order(get_db(), json_body(), parse_dt)
    return jsonify(ser(doc)), 201


@bp.get("/api/orders")
def list_orders():
    f = {}
    if request.args.get("station_id"):
        f["station_id"] = oid(request.args["station_id"], "station_id")
    if request.args.get("status"):
        if request.args["status"] not in svc.STATUSES:
            raise ApiError(400, "Unknown status", "validation")
        f["status"] = request.args["status"]
    return jsonify([ser(o) for o in get_db().orders.find(f).sort("created_at", -1).limit(200)])


@bp.get("/api/orders/<order_id>")
def get_order(order_id):
    o = get_db().orders.find_one({"_id": svc.resolve_order_id(get_db(), order_id)})
    if not o:
        raise ApiError(404, "Order not found", "not_found")
    return jsonify(ser(o))


@bp.patch("/api/orders/<order_id>/status")
def customer_status(order_id):
    """DEMO ONLY: lets the tracking page's 'advance (simulated)' button work. Customers can never reject."""
    if not current_app.config["ALLOW_DEMO_CUSTOMER_STATUS"]:
        raise ApiError(403, "Customer status changes are disabled", "forbidden")
    status = json_body().get("status")
    if status == "rejected":
        raise ApiError(403, "Customers cannot reject orders", "forbidden")
    return jsonify(ser(svc.change_status(get_db(), svc.resolve_order_id(get_db(), order_id), status)))
