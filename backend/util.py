"""Shared helpers: errors, ids, serialisation, validation."""
import hashlib
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from flask import request


class ApiError(Exception):
    def __init__(self, status: int, message: str, code: str = "error"):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def aware(dt):
    """Mongo may hand back naive UTC datetimes; normalise to aware UTC."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def parse_dt(value, field: str):
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ApiError(400, f"{field} must be an ISO-8601 date-time string", "validation")
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ApiError(400, f"{field} is not a valid ISO-8601 date-time", "validation")
    return aware(dt)


def seed_oid(key: str) -> ObjectId:
    """Deterministic ObjectId so seed data keeps stable identifiers."""
    return ObjectId(hashlib.md5(key.encode()).hexdigest()[:24])


def oid(value, field: str = "id") -> ObjectId:
    if not isinstance(value, str) or len(value) != 24:
        raise ApiError(400, f"{field} is not a valid id", "invalid_id")
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise ApiError(400, f"{field} is not a valid id", "invalid_id")


def iso(dt):
    dt = aware(dt)
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def ser(value):
    """Recursively make a Mongo document JSON-safe (ObjectId->str, datetime->ISO, _id->id)."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return iso(value)
    if isinstance(value, list):
        return [ser(v) for v in value]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            out["id" if k == "_id" else k] = ser(v)
        return out
    return value


def json_body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError(400, "Request body must be a JSON object", "validation")
    return data


def int_field(data: dict, key: str, *, minimum=None, maximum=None, required=True, default=None):
    if key not in data or data[key] is None:
        if required:
            raise ApiError(400, f"{key} is required", "validation")
        return default
    v = data[key]
    if isinstance(v, bool) or not isinstance(v, int):
        raise ApiError(400, f"{key} must be an integer", "validation")
    if minimum is not None and v < minimum:
        raise ApiError(400, f"{key} must be at least {minimum}", "validation")
    if maximum is not None and v > maximum:
        raise ApiError(400, f"{key} must be at most {maximum}", "validation")
    return v


def str_field(data: dict, key: str, *, max_len=200, required=True, default=""):
    if key not in data or data[key] is None:
        if required:
            raise ApiError(400, f"{key} is required", "validation")
        return default
    v = data[key]
    if not isinstance(v, str):
        raise ApiError(400, f"{key} must be a string", "validation")
    v = v.strip()
    if required and not v:
        raise ApiError(400, f"{key} must not be empty", "validation")
    if len(v) > max_len:
        raise ApiError(400, f"{key} must be at most {max_len} characters", "validation")
    return v


def bool_arg(value, default=None):
    if value is None:
        return default
    return str(value).lower() in ("1", "true", "yes", "on")
