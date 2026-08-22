
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from .mongo import get_db


def _now():
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
   
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




def create_user(name: str, email: str, hashed_password: str, role: str = "user") -> dict:
    db  = get_db()
    doc = {
        "name":       name,
        "email":      email.lower().strip(),
        "password":   hashed_password,
        "role":       role,
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


def delete_project(project_id: str, user_id: str) -> bool:
    db  = get_db()
    oid = safe_object_id(project_id)
    if not oid:
        return False
    result = db.projects.delete_one({"_id": oid, "user_id": user_id})
    return result.deleted_count > 0




def get_all_prices() -> dict:
    db  = get_db()
    doc = db.materials.find_one({"_id": "prices"})
    if doc:
        doc.pop("_id", None)
        return doc

    return {
        "cement_bag":  {"generic": 2350.0, "lanwa": 2250.0, "ultratec": 2400.0, "tokyo_super": 2500.0, "sanstha": 2450.0},
        "sand_m3":     {"generic": 22000.0},
        "metal_m3":    {"generic": 18500.0, "icc": 21000.0, "tokyo_super": 20500.0, "maga": 20000.0},
        "steel_kg":    {"generic": 390.0, "lanwa": 420.0, "melwa": 415.0, "gtb": 405.0},
        "rubble_m3":   {"generic": 8500.0},
        "labour_day":  {"generic": 5500.0},
        "brick_each":  {"cement_block": 80.0, "clay_brick": 35.0},
        "plaster_m2":  {"generic": 650.0},
        "paint_m2":    {"emulsion": 280.0, "weathercoat": 380.0},
        "floor_m2":    {"cement": 450.0, "tile": 1800.0},
        "roof_m2":     {"flat_slab": 4500.0, "timber_tile": 3200.0, "timber_sheet": 2200.0},
        "lintel_each": {"generic": 4500.0},
    }


def update_all_prices(prices: dict) -> bool:
    db = get_db()
    db.materials.replace_one({"_id": "prices"}, {**prices, "_id": "prices"}, upsert=True)
    return True


def update_single_price(material_key: str, brand: str, price: float) -> bool:
    db = get_db()
    db.materials.update_one(
        {"_id": "prices"},
        {"$set": {f"{material_key}.{brand}": price}},
        upsert=True,
    )
    return True


def delete_price(material_key: str, brand: str) -> bool:
    db = get_db()
    result = db.materials.update_one(
        {"_id": "prices"},
        {"$unset": {f"{material_key}.{brand}": ""}},
    )
    return result.modified_count > 0