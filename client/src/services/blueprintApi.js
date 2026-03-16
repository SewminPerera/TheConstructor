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
  fd.append("wastage_pct",     specs.wastagePct     ?? 10);
  fd.append("plinth_height",   specs.plinthHeight   ?? 0.45);
  fd.append("labour_days",     specs.labourDays     ?? 0);
  fd.append("labour_workers",  specs.labourWorkers  ?? 1);

  const res  = await api.post("/analyze", fd);
  const data = res.data;

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
