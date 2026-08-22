import api, { API_BASE } from "./api";

/**
 * Upload a blueprint file for AI analysis (YOLO or DXF parsing).
 * Returns ai_summary, quotation (default calc), and preview_url.
 */
export async function analyzeBlueprint(file, specs = {}) {
  const fd = new FormData();
  fd.append("file",           file);
  fd.append("plan_width",     specs.planWidth     ?? 0);
  fd.append("wall_thickness", specs.wallThickness ?? "9");
  fd.append("cement_brand",   specs.cementBrand   ?? "generic");
  fd.append("metal_brand",    specs.metalBrand    ?? "generic");
  fd.append("steel_brand",    specs.steelBrand    ?? "generic");
  fd.append("soil_type",      specs.soilType      ?? "normal");
  fd.append("wastage_pct",    specs.wastagePct    ?? 10);
  fd.append("plinth_height",  specs.plinthHeight  ?? 0.45);
  fd.append("labour_days",    specs.labourDays    ?? 0);
  fd.append("labour_workers", specs.labourWorkers ?? 1);

  // Superstructure params
  fd.append("wall_height",       specs.wallHeight      ?? 3.0);
  fd.append("number_of_floors",  specs.numberOfFloors  ?? 1);
  fd.append("floor_area",        specs.floorArea       ?? 0);
  fd.append("roof_type",         specs.roofType        ?? "none");
  fd.append("brick_type",        specs.brickType       ?? "cement_block");
  fd.append("plaster_type",      specs.plasterType     ?? "both");
  fd.append("paint_type",        specs.paintType       ?? "emulsion");
  fd.append("floor_finish",      specs.floorFinish     ?? "cement");

  // Scale calibration
  if (specs.pixelRatio) {
    fd.append("pixel_ratio", specs.pixelRatio);
  }

  let res;
  try {
    res = await api.post("/analyze", fd);
  } catch (err) {
    // Extract error message from backend JSON response
    const msg = err.response?.data?.error || err.message || "Analysis failed";
    throw new Error(msg);
  }
  const data = res.data;

  if (!data.success && data.error) {
    throw new Error(data.error);
  }

  if (data.preview_url?.startsWith("/")) {
    data.preview_url = `${API_BASE}${data.preview_url}`;
  }
  if (data.preview_url) {
    data.preview_url += `?t=${Date.now()}`;
  }
  return data;
}

/**
 * Fast cost-only recalculation — no file upload, no AI.
 * Accepts an optional AbortController signal for cancellation.
 */
export async function calculateCost(params, signal) {
  const res = await api.post("/calculate", params, { signal });
  return res.data;
}

export async function getUserProjects() {
  const res = await api.get("/projects");
  return res.data.projects;
}

export async function getProject(projectId) {
  const res = await api.get(`/projects/${projectId}`);
  return res.data.project;
}

export async function deleteProject(projectId) {
  const res = await api.delete(`/projects/${projectId}`);
  return res.data;
}
