"""
db/models.py
------------
Schema helpers and CRUD for each MongoDB collection.
"""
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from .mongo import get_db


def _now():
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    """Recursively convert ObjectId → str so Flask can JSON-serialize."""
    if doc is None:
        return None
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, dict):
            result[k] = _serialize(v)
        elif isinstance(v, list):
            result[k] = [str(i) if isinstance(i, ObjectId) else i for i in v]
        else:
            result[k] = v
    return result


def safe_object_id(id_str: str):
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        return None


# ── USERS ─────────────────────────────────────────────────────────────────────

def create_user(name: str, email: str, hashed_password: str) -> dict:
    db  = get_db()
    doc = {
        "name":       name,
        "email":      email.lower().strip(),
        "password":   hashed_password,
        "created_at": _now(),
    }
    result    = db.users.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


def find_user_by_email(email: str) -> dict | None:
    db  = get_db()
    doc = db.users.find_one({"email": email.lower().strip()})
    return _serialize(doc) if doc else None


def find_user_by_id(user_id: str) -> dict | None:
    db  = get_db()
    oid = safe_object_id(user_id)
    if not oid:
        return None
    doc = db.users.find_one({"_id": oid})
    return _serialize(doc) if doc else None


# ── PROJECTS ──────────────────────────────────────────────────────────────────

def save_project(user_id: str, filename: str, specs: dict,
                 ai_summary: dict, quotation: dict) -> dict:
    db  = get_db()
    doc = {
        "user_id":    user_id,
        "filename":   filename,
        "specs":      specs,
        "ai_summary": ai_summary,
        "quotation":  quotation,
        "created_at": _now(),
    }
    result     = db.projects.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


def get_user_projects(user_id: str, limit: int = 20) -> list:
    db     = get_db()
    cursor = (
        db.projects
        .find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return [_serialize(doc) for doc in cursor]


def get_project_by_id(project_id: str, user_id: str) -> dict | None:
    db  = get_db()
    oid = safe_object_id(project_id)
    if not oid:
        return None
    doc = db.projects.find_one({"_id": oid, "user_id": user_id})
    return _serialize(doc) if doc else None


# ── MATERIALS ─────────────────────────────────────────────────────────────────

def get_all_prices() -> dict:
    db  = get_db()
    doc = db.materials.find_one({"_id": "prices"})
    if doc:
        doc.pop("_id", None)
        return doc
    return {
        "cement_bag":  {"generic": 2300.0, "tokyo_super": 2450.0, "sanstha": 2350.0},
        "sand_m3":     {"generic": 22000.0},
        "metal_m3":    {"generic": 18500.0, "icc": 21000.0, "tokyo_super": 20500.0, "maga": 20000.0},
        "steel_kg":    {"generic": 390.0,   "lanwa": 420.0, "melwa": 415.0, "gtb": 405.0},
        "rubble_m3":   {"generic": 8500.0},
        "labour_day":  {"generic": 3500.0},
    }