
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from db.models import (
    find_user_by_id, get_all_prices, update_all_prices,
    update_single_price, delete_price,
)

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

def _require_admin():
    
    user_id = get_jwt_identity()
    user = find_user_by_id(user_id)
    if not user or user.get("role", "user") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None

@admin_bp.route("/prices", methods=["GET"])
@jwt_required()
def list_prices():
    err = _require_admin()
    if err:
        return err
    prices = get_all_prices()
    return jsonify({"success": True, "prices": prices}), 200

@admin_bp.route("/prices", methods=["PUT"])
@jwt_required()
def replace_prices():
    err = _require_admin()
    if err:
        return err
    body = request.get_json(silent=True)
    if not body or not isinstance(body, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400
    update_all_prices(body)
    return jsonify({"success": True}), 200

@admin_bp.route("/prices/<material_key>/<brand>", methods=["PUT"])
@jwt_required()
def update_price(material_key, brand):
    err = _require_admin()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    price = body.get("price")
    if price is None:
        return jsonify({"error": "Missing 'price' field"}), 400
    try:
        price = float(price)
    except (TypeError, ValueError):
        return jsonify({"error": "Price must be a number"}), 400
    update_single_price(material_key, brand, price)
    return jsonify({"success": True}), 200

@admin_bp.route("/prices/<material_key>/<brand>", methods=["POST"])
@jwt_required()
def add_brand(material_key, brand):
    err = _require_admin()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    price = body.get("price")
    if price is None:
        return jsonify({"error": "Missing 'price' field"}), 400
    try:
        price = float(price)
    except (TypeError, ValueError):
        return jsonify({"error": "Price must be a number"}), 400
    update_single_price(material_key, brand, price)
    return jsonify({"success": True}), 200

@admin_bp.route("/prices/<material_key>/<brand>", methods=["DELETE"])
@jwt_required()
def remove_brand(material_key, brand):
    err = _require_admin()
    if err:
        return err
    deleted = delete_price(material_key, brand)
    if not deleted:
        return jsonify({"error": "Brand not found"}), 404
    return jsonify({"success": True}), 200
