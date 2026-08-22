from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)

try:
    import bcrypt as _bcrypt
    def _hash_password(plain: str) -> str:
        return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
    def _check_password(plain: str, hashed: str) -> bool:
        return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    print("✅ Using bcrypt for password hashing")
except Exception:
    from werkzeug.security import generate_password_hash, check_password_hash
    def _hash_password(plain: str) -> str:
        return generate_password_hash(plain)
    def _check_password(plain: str, hashed: str) -> bool:
        return check_password_hash(hashed, plain)
    print("⚠️  bcrypt unavailable — using werkzeug password hashing")

from db.models import (
    create_user,
    find_user_by_email,
    find_user_by_id,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

def _user_public(user: dict) -> dict:
    return {
        "id":         str(user["_id"]),
        "name":       user.get("name", ""),
        "email":      user.get("email", ""),
        "role":       user.get("role", "user"),
        "created_at": str(user.get("created_at", "")),
    }

@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        body = request.get_json(force=True, silent=True) or {}
        name     = (body.get("name")     or "").strip()
        email    = (body.get("email")    or "").strip().lower()
        password = (body.get("password") or "").strip()

        if not name or not email or not password:
            return jsonify({"error": "name, email and password are required"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        if find_user_by_email(email):
            return jsonify({"error": "An account with this email already exists"}), 409

        hashed = _hash_password(password)
        user   = create_user(name, email, hashed)
        token  = create_access_token(identity=str(user["_id"]))

        return jsonify({
            "message": "Account created successfully",
            "token":   token,
            "user":    _user_public(user),
        }), 201

    except Exception as e:
        print(f"❌ Register error: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        body = request.get_json(force=True, silent=True) or {}
        email    = (body.get("email")    or "").strip().lower()
        password = (body.get("password") or "").strip()

        if not email or not password:
            return jsonify({"error": "email and password are required"}), 400

        user = find_user_by_email(email)
        if not user or not _check_password(password, user["password"]):
            return jsonify({"error": "Invalid email or password"}), 401

        token = create_access_token(identity=str(user["_id"]))
        return jsonify({
            "token": token,
            "user":  _user_public(user),
        }), 200

    except Exception as e:
        print(f"❌ Login error: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    try:
        user_id = get_jwt_identity()
        user    = find_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify({"user": _user_public(user)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
