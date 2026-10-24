import logging

from flask import Flask, jsonify, request
from pymongo.errors import PyMongoError

from config import Config
from db import SETUP_HINT, ensure_indexes, make_client, ping
from routes import catalog, chat, health, orders, owner
from util import ApiError


def create_app(overrides: dict | None = None, db=None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.update(overrides or {})
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    log = logging.getLogger("pmh")

    if db is None:
        db = make_client(app.config)[app.config["MONGO_DB_NAME"]]
    app.extensions["pmh_db"] = db
    ok, why = ping(db)
    if ok:
        ensure_indexes(db)
        log.info("MongoDB connection verified (db=%s)", app.config["MONGO_DB_NAME"])
    else:
        log.error("MongoDB NOT reachable (%s). %s", why, SETUP_HINT.format(uri=app.config["MONGO_URI"]))

    for m in (health, catalog, orders, owner, chat):
        app.register_blueprint(m.bp)

    allowed = set(app.config["CORS_ORIGINS"])

    @app.after_request
    def cors(resp):
        origin = request.headers.get("Origin")
        if origin and origin in allowed:  # only the configured frontend origin(s)
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Vary"] = "Origin"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Demo-Owner-Shop"
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
        return resp

    @app.before_request
    def preflight():
        if request.method == "OPTIONS":  # CORS headers are added in after_request for allowed origins only
            return "", 204

    @app.errorhandler(ApiError)
    def api_error(e):
        return jsonify({"error": {"message": e.message, "code": e.code}}), e.status

    @app.errorhandler(PyMongoError)
    def mongo_error(e):
        log.error("MongoDB error: %s", e.__class__.__name__)
        return jsonify({"error": {"message": "Database is unavailable. Start MongoDB Community Server and retry.", "code": "db_unavailable"}}), 503

    @app.errorhandler(404)
    def nf(_):
        return jsonify({"error": {"message": "Not found", "code": "not_found"}}), 404

    @app.errorhandler(405)
    def na(_):
        return jsonify({"error": {"message": "Method not allowed", "code": "method_not_allowed"}}), 405

    @app.errorhandler(413)
    def big(_):
        return jsonify({"error": {"message": "Request too large", "code": "too_large"}}), 413

    @app.errorhandler(Exception)
    def boom(e):
        log.exception("Unhandled error")
        return jsonify({"error": {"message": "Internal server error", "code": "internal"}}), 500

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=5000, debug=Config.__dict__.get("DEBUG", False))
