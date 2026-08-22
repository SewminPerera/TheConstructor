import os
import uuid
import traceback
import json
import cv2
import numpy as np

from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity

import calculator as calc
from db.models import save_project, get_user_projects, get_project_by_id, delete_project
from services.vision_services import analyze_with_hybrid
from services.dxf_services    import analyze_dxf, render_dxf_preview
from services.pdf_services    import convert_pdf_to_image

def _sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj

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

def _extract_superstructure_specs(source):
    
    def _get(key, default):
        if hasattr(source, 'get'):
            return source.get(key, default)
        return default

    return {
        "wall_height_m":    float(_get("wall_height",       3.0) or 3.0),
        "number_of_floors": int(_get("number_of_floors",    1) or 1),
        "floor_area_m2":    float(_get("floor_area",        0) or 0),
        "roof_type":        _get("roof_type",               "none"),
        "brick_type":       _get("brick_type",              "cement_block"),
        "plaster_type":     _get("plaster_type",            "both"),
        "paint_type":       _get("paint_type",              "emulsion"),
        "floor_finish":     _get("floor_finish",            "cement"),
    }

#Routes 

@analyze_bp.route("/preview/<path:filename>")
def serve_preview(filename):
    return send_from_directory(PREVIEWS_DIR, filename)

@analyze_bp.route("/analyze", methods=["POST"])
@jwt_required()
def analyze_blueprint():
   
    user_id = get_jwt_identity()

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f             = request.files["file"]
    original_name = f.filename or "upload"
    ext           = os.path.splitext(original_name)[1].lower()

    plan_width  = float(request.form.get("plan_width", 0) or 0)
    pixel_ratio = float(request.form.get("pixel_ratio", 0) or 0)

    job_id           = uuid.uuid4().hex
    upload_path      = os.path.join(TEMP_UPLOADS_DIR, f"{job_id}{ext}")
    preview_filename = f"{job_id}.png"
    preview_path     = os.path.join(PREVIEWS_DIR, preview_filename)

    f.save(upload_path)

    pdf_image_path = None  

    try:
       
        if ext == ".pdf":
            try:
                converted_path, pdf_info = convert_pdf_to_image(upload_path, dpi=300)
                pdf_image_path = converted_path
                
                analysis = analyze_with_hybrid(
                    converted_path, plan_width,
                    pixel_ratio=pixel_ratio if pixel_ratio > 0 else None,
                )
                
                analysis["pdf_info"] = pdf_info
               
                img = cv2.imread(converted_path)
                if img is not None:
                   
                    h, w = img.shape[:2]
                    if w > 2000:
                        scale = 2000 / w
                        img = cv2.resize(img, (2000, int(h * scale)), interpolation=cv2.INTER_AREA)
                    cv2.imwrite(preview_path, img)
                else:
                    _safe_remove(preview_path)
            except ImportError:
                return jsonify({
                    "success": False,
                    "error": "PDF support requires PyMuPDF. Install it with: pip install pymupdf",
                }), 500
            except Exception as pdf_err:
                return jsonify({
                    "success": False,
                    "error": f"Failed to process PDF: {str(pdf_err)}",
                }), 400

        elif ext == ".dxf":
            analysis = analyze_dxf(upload_path)
            render_dxf_preview(upload_path, preview_path)
        else:
            analysis = analyze_with_hybrid(
                upload_path, plan_width,
                pixel_ratio=pixel_ratio if pixel_ratio > 0 else None,
            )
            img = cv2.imread(upload_path)
            if img is not None:
                cv2.imwrite(preview_path, img)
            else:
                _safe_remove(preview_path)

        
        analysis = _sanitize_for_json(analysis)

       
        if analysis.get("error"):
            return jsonify({
                "success": False,
                "error":   analysis.get("message", analysis["error"]),
                "warning": analysis.get("warning", ""),
            }), 400

        
        plinths_raw = request.form.get("plinths", "")
        try:
            plinths_list = json.loads(plinths_raw) if plinths_raw else []
        except (ValueError, TypeError):
            plinths_list = []

        default_specs = {
            "door_count":      int(analysis.get("doors",   0)),
            "window_count":    int(analysis.get("windows", 0)),
            "wall_thickness":  float(request.form.get("wall_thickness", 9) or 9),
            "cement_brand":    request.form.get("cement_brand",  "generic"),
            "metal_brand":     request.form.get("metal_brand",   "generic"),
            "steel_brand":     request.form.get("steel_brand",   "generic"),
            "soil_type":       request.form.get("soil_type",     "normal"),
            "wastage_pct":     float(request.form.get("wastage_pct", 10) or 10),
            "plinth_height_m": float(request.form.get("plinth_height", 0.45) or 0.45),
            "plinths":         plinths_list,
            "labour_days":     int(request.form.get("labour_days",    0) or 0),
            "labour_workers":  int(request.form.get("labour_workers", 1) or 1),
            **_extract_superstructure_specs(request.form),
        }

        
        rooms = analysis.get("rooms")
        if rooms and rooms.get("total_floor_area_m2", 0) > 0 and default_specs["floor_area_m2"] == 0:
            default_specs["floor_area_m2"] = rooms["total_floor_area_m2"]

        quotation = calc.calculate_full_estimate(analysis["length_m"], default_specs)
        quotation = _sanitize_for_json(quotation)

        
        try:
            save_project(
                user_id    = user_id,
                filename   = original_name,
                specs      = default_specs,
                ai_summary = analysis,
                quotation  = quotation,
            )
        except Exception as db_err:
            print(f"⚠️  save_project failed (non-fatal): {db_err}")

        return jsonify({
            "success":     True,
            "ai_summary":  analysis,
            "quotation":   quotation,
            "preview_url": f"/preview/{preview_filename}",
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error":   f"Analysis failed: {str(e)}",
        }), 500

    finally:
        _safe_remove(upload_path)
        if pdf_image_path:
            _safe_remove(pdf_image_path)

@analyze_bp.route("/calculate", methods=["POST"])
@jwt_required()
def calculate_cost():
    """Fast cost-only recalculation — no file upload, no AI analysis."""
    body = request.get_json(silent=True) or {}

    wall_length_m = float(body.get("wall_length_m", 0) or 0)
    plinths_list = body.get("plinths") or []
    if not isinstance(plinths_list, list):
        plinths_list = []

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
        "plinths":         plinths_list,
        "labour_days":     int(body.get("labour_days",    0) or 0),
        "labour_workers":  int(body.get("labour_workers", 1) or 1),
        **_extract_superstructure_specs(body),
    }

    quotation = calc.calculate_full_estimate(wall_length_m, user_choices)
    return jsonify({"success": True, "quotation": quotation}), 200

@analyze_bp.route("/projects", methods=["GET"])
@jwt_required()
def list_projects():
    user_id  = get_jwt_identity()
    projects = get_user_projects(user_id)
    return jsonify({"projects": projects}), 200

@analyze_bp.route("/projects/<project_id>", methods=["GET"])
@jwt_required()
def get_project(project_id):
    user_id = get_jwt_identity()
    project = get_project_by_id(project_id, user_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"project": project}), 200

@analyze_bp.route("/projects/<project_id>", methods=["DELETE"])
@jwt_required()
def remove_project(project_id):
    user_id = get_jwt_identity()
    deleted = delete_project(project_id, user_id)
    if not deleted:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"success": True}), 200
