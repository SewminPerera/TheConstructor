import { useState } from "react";
import { exportBOQtoPDF } from "./ExportPDF";
import "./BOQPanel.css";

const MATERIAL_ITEMS = [
  { key: "cement",         bg: "#FEF3C7", color: "#D97706", bar: "#F59E0B", label: "Cement",            qtyKey: "cement_bags", unit: "bags" },
  { key: "sand",           bg: "#FEF9C3", color: "#A16207", bar: "#EAB308", label: "River Sand",        qtyKey: "sand_m3",     unit: "m\u00B3" },
  { key: "metal",          bg: "#F1F5F9", color: "#475569", bar: "#94A3B8", label: "Metal / Aggregate", qtyKey: "metal_m3",    unit: "m\u00B3" },
  { key: "steel",          bg: "#FEE2E2", color: "#B91C1C", bar: "#F87171", label: "Tor Steel",         qtyKey: "steel_kg",    unit: "kg"  },
  { key: "rubble_masonry", bg: "#EDE9FE", color: "#6D28D9", bar: "#A78BFA", label: "Rubble Stone",      qtyKey: "rubble_m3",   unit: "m\u00B3" },
];

const parseAmount = (str) => parseFloat((str || "0").replace(/[^0-9.]/g, "")) || 0;

const LABOUR_ITEMS = [
  { key: "labour", bg: "#DBEAFE", label: "Labour Fee", qtyKey: "labour_days", unit: "days" },
];

export default function BOQPanel({ quotation, aiSummary, recalculating }) {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [exporting, setExporting] = useState(false);

  const costs  = quotation?.costs_lkr   || {};
  const qty    = quotation?.quantities  || {};
  const assump = quotation?.assumptions || {};
  const wastage = assump.wastage_pct ?? 10;

  const handleExport = async () => {
    setExporting(true);
    try {
      exportBOQtoPDF({ aiSummary: aiSummary || {}, quotation, specs: assump });
    } finally {
      setExporting(false);
    }
  };

  const totalMaterials = MATERIAL_ITEMS.reduce((s, i) => s + parseAmount(costs[i.key]), 0);

  const renderRow = (item, showBar = false) => {
    const amount = parseAmount(costs[item.key]);
    const pct = showBar && totalMaterials > 0 ? Math.max(4, (amount / totalMaterials) * 100) : 0;
    return (
      <div className="boq-row" key={item.key}>
        <div className="boq-left">
          <div className="boq-emoji" style={{ background: item.bg, color: item.color }}>
            {item.label.charAt(0)}
          </div>
          <div className="boq-info">
            <div className="boq-name">{item.label}</div>
            <div className="boq-qty">
              {qty[item.qtyKey] ?? 0} {item.unit}
              {wastage > 0 && qty[`net_${item.qtyKey}`] != null && (
                <span className="boq-net"> · net {qty[`net_${item.qtyKey}`]} {item.unit}</span>
              )}
            </div>
            {showBar && (
              <div className="boq-bar-track">
                <div className="boq-bar-fill" style={{ width: `${pct}%`, background: item.bar }} />
              </div>
            )}
          </div>
        </div>
        <div className="boq-price">{costs[item.key] || "Rs. 0.00"}</div>
      </div>
    );
  };

  return (
    <div className={`boq-panel${recalculating ? " boq-panel--recalculating" : ""}`}>
      <div className="boq-panel-header">
        <div>
          <h3 className="boq-panel-title">Bill of Quantities</h3>
          <p className="boq-panel-sub">Foundation · Strip footing · incl. {wastage}% wastage</p>
        </div>
        <div className="boq-header-right">
          <div className="boq-badges">
            <span className="boq-badge boq-badge--soil">{assump.soil_label || "Normal Soil"}</span>
            <span className="boq-badge boq-badge--depth">{assump.footing_depth_m ?? "\u2014"}m deep</span>
          </div>
          <button className="boq-export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? "Generating..." : "Export PDF"}
          </button>
        </div>
      </div>

      {recalculating && <div className="boq-recalculating">Recalculating...</div>}

      {/* Materials */}
      <div className="boq-section-label">Materials</div>
      <div className="boq-list">
        {MATERIAL_ITEMS.map((item) => renderRow(item, true))}
      </div>
      {costs.MATERIALS_SUBTOTAL && (
        <div className="boq-subtotal">
          <span>Materials Subtotal</span>
          <span>{costs.MATERIALS_SUBTOTAL}</span>
        </div>
      )}

      {/* Labour */}
      <div className="boq-section-label">Labour</div>
      <div className="boq-list">
        {LABOUR_ITEMS.map((item) => renderRow(item, false))}
      </div>
      {costs.LABOUR_SUBTOTAL && (
        <div className="boq-subtotal">
          <span>Labour Subtotal</span>
          <span>{costs.LABOUR_SUBTOTAL}</span>
        </div>
      )}

      <div className="boq-total">
        <div>
          <div className="boq-total-label">GRAND TOTAL</div>
          <div className="boq-total-note">incl. {wastage}% wastage allowance</div>
        </div>
        <span className="boq-total-amount">{costs.GRAND_TOTAL || "Rs. 0.00"}</span>
      </div>

      <button className="boq-assumptions-toggle" onClick={() => setShowAssumptions((v) => !v)}>
        <span>View Calculation Assumptions</span>
        <span>{showAssumptions ? "\u25B2" : "\u25BC"}</span>
      </button>

      {showAssumptions && (
        <div className="boq-assumptions-grid">
          {[
            ["Foundation Type",    assump.foundation_type            || "\u2014"],
            ["Soil Type",          assump.soil_label                 || "\u2014"],
            ["Depth Multiplier",   `${assump.soil_depth_multiplier ?? 1.0}\u00D7`],
            ["Width Multiplier",   `${assump.soil_width_multiplier ?? 1.0}\u00D7`],
            ["Footing Width",      `${assump.footing_width_m       ?? "\u2014"} m`],
            ["Trench Depth",       `${assump.trench_depth_m        ?? "\u2014"} m`],
            ["Slab Depth",         `${assump.slab_depth_m          ?? "\u2014"} m`],
            ["Plinth Height",      `${assump.plinth_height_m       ?? 0.45} m`],
            ["Wall Thickness",     `${assump.wall_thickness_in     ?? 9}"`],
            ["Openings Deducted",  `${assump.opening_deduction_m   ?? 0} m (${assump.door_count ?? 0}D + ${assump.window_count ?? 0}W)`],
            ["Effective Length",   `${assump.effective_wall_length_m ?? "\u2014"} m`],
            ["Wastage",            `${assump.wastage_pct           ?? 0}%`],
            ["Cement / m\u00B3",   `${assump.cement_bags_per_m3    ?? "\u2014"} bags`],
            ["Sand / m\u00B3",     `${assump.sand_m3_per_m3        ?? "\u2014"} m\u00B3`],
            ["Metal / m\u00B3",    `${assump.metal_m3_per_m3       ?? "\u2014"} m\u00B3`],
            ["Steel / m\u00B3",    `${assump.steel_kg_per_m3       ?? "\u2014"} kg`],
            ["Mix Ratio",          "1 : 2 : 4 (CIDA)"],
            ["Concrete Volume",    `${qty.concrete_m3              ?? "\u2014"} m\u00B3`],
          ].map(([k, v]) => (
            <div className="boq-assump-cell" key={k}>
              <span className="boq-assump-key">{k}</span>
              <span className="boq-assump-val">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
