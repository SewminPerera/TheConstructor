"""
routes/analyze.py
-----------------
POST /analyze   — upload blueprint, run AI analysis, return ai_summary + preview
POST /calculate — take wall measurements + specs, return quotation (fast, no file)
GET  /projects  — list current user's saved projects  (JWT required)
GET  /preview/<filename> — serve preview image
"""
import os
import uuid
import cv2

from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request

import calculator as calc
from db.models import save_project, get_user_projects
from services.vision_services import analyze_with_hybrid
from services.dxf_services    import analyze_dxf, render_dxf_preview

analyze_bp = Blueprint("analyze", __name__)

BASE_DIR          = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP_UPLOADS_DIR  = os.path.join(BASE_DIR, "temp_uploads")
PREVIEWS_DIR      = os.path.join(BASE_DIR, "previews")

os.makedirs(TEMP_UPLOADS_DIR, exist_ok=True)
os.makedirs(PREVIEWS_DIR,     exist_ok=True)


def _safe_remove(path: str):
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


# ── Routes ────────────────────────────────────────────────────────────────────

@analyze_bp.route("/preview/<path:filename>")
def serve_preview(filename):
    return send_from_directory(PREVIEWS_DIR, filename)


@analyze_bp.route("/analyze", methods=["POST"])
def analyze_blueprint():
    """AI-only analysis: run YOLO or DXF parsing, return measurements + preview."""
    user_id = None
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
    except Exception:
        pass

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f             = request.files["file"]
    original_name = f.filename or "upload"
    ext           = os.path.splitext(original_name)[1].lower()

    plan_width = float(request.form.get("plan_width", 0) or 0)

    job_id           = uuid.uuid4().hex
    upload_path      = os.path.join(TEMP_UPLOADS_DIR, f"{job_id}{ext}")
    preview_filename = f"{job_id}.png"
    preview_path     = os.path.join(PREVIEWS_DIR, preview_filename)

    f.save(upload_path)

    try:
        if ext == ".dxf":
            analysis = analyze_dxf(upload_path)
            render_dxf_preview(upload_path, preview_path)
        else:
            analysis = analyze_with_hybrid(upload_path, plan_width)
            img = cv2.imread(upload_path)
            if img is not None:
                cv2.imwrite(preview_path, img)
            else:
                _safe_remove(preview_path)

        # Also run a default calculation so first render has data
        default_specs = {
            "door_count":      int(analysis.get("doors",   0)),
            "window_count":    int(analysis.get("windows", 0)),
            "wall_thickness":  float(request.form.get("wall_thickness", 9)),
            "cement_brand":    request.form.get("cement_brand",  "generic"),
            "metal_brand":     request.form.get("metal_brand",   "generic"),
            "steel_brand":     request.form.get("steel_brand",   "generic"),
            "soil_type":       request.form.get("soil_type",     "normal"),
            "wastage_pct":     float(request.form.get("wastage_pct", 10) or 10),
            "plinth_height_m": float(request.form.get("plinth_height", 0.45) or 0.45),
            "labour_days":     int(request.form.get("labour_days",    0) or 0),
            "labour_workers":  int(request.form.get("labour_workers", 1) or 1),
        }
        quotation = calc.calculate_foundation_only(analysis["length_m"], default_specs)

        # Persist to MongoDB
        save_project(
            user_id    = user_id,
            filename   = original_name,
            specs      = default_specs,
            ai_summary = analysis,
            quotation  = quotation,
        )

        return jsonify({
            "success":     True,
            "ai_summary":  analysis,
            "quotation":   quotation,
            "preview_url": f"/preview/{preview_filename}",
        }), 200

    finally:
        _safe_remove(upload_path)


@analyze_bp.route("/calculate", methods=["POST"])
def calculate_cost():
    """Fast cost-only recalculation — no file upload, no AI analysis."""
    body = request.get_json(silent=True) or {}

    wall_length_m = float(body.get("wall_length_m", 0) or 0)
    user_choices = {
        "door_count":      int(body.get("door_count",     0) or 0),
        "window_count":    int(body.get("window_count",   0) or 0),
        "wall_thickness":  float(body.get("wall_thickness", 9) or 9),
        "cement_brand":    body.get("cement_brand",   "generic"),
        "metal_brand":     body.get("metal_brand",    "generic"),
        "steel_brand":     body.get("steel_brand",    "generic"),
        "soil_type":       body.get("soil_type",      "normal"),
        "wastage_pct":     float(body.get("wastage_pct",  10) or 10),
        "plinth_height_m": float(body.get("plinth_height", 0.45) or 0.45),
        "labour_days":     int(body.get("labour_days",    0) or 0),
        "labour_workers":  int(body.get("labour_workers", 1) or 1),
    }

    quotation = calc.calculate_foundation_only(wall_length_m, user_choices)
    return jsonify({"success": True, "quotation": quotation}), 200


@analyze_bp.route("/projects", methods=["GET"])
@jwt_required()
def list_projects():
    user_id  = get_jwt_identity()
    projects = get_user_projects(user_id)
    return jsonify({"projects": projects}), 200
