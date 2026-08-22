import { useState } from "react";
import { exportBOQtoPDF } from "./ExportPDF";
import "./BOQPanel.css";

const FOUNDATION_ITEMS = [
  { key: "cement",         bg: "#FEF3C7", color: "#D97706", bar: "#F59E0B", label: "Cement",            qtyKey: "cement_bags", unit: "bags" },
  { key: "sand",           bg: "#FEF9C3", color: "#A16207", bar: "#EAB308", label: "River Sand",        qtyKey: "sand_m3",     unit: "m\u00B3" },
  { key: "metal",          bg: "#F1F5F9", color: "#475569", bar: "#94A3B8", label: "Metal / Aggregate", qtyKey: "metal_m3",    unit: "m\u00B3" },
  { key: "steel",          bg: "#FEE2E2", color: "#B91C1C", bar: "#F87171", label: "Tor Steel",         qtyKey: "steel_kg",    unit: "kg"  },
  { key: "rubble_masonry", bg: "#EDE9FE", color: "#6D28D9", bar: "#A78BFA", label: "Rubble Stone",      qtyKey: "rubble_m3",   unit: "m\u00B3" },
];

const SUPERSTRUCTURE_ITEMS = [
  { key: "wall_masonry", bg: "#FEF3C7", color: "#92400E", bar: "#D97706", label: "Wall Masonry",  qtyKey: "block_count",     unit: "blocks" },
  { key: "lintels",      bg: "#FEE2E2", color: "#991B1B", bar: "#EF4444", label: "Lintels",       qtyKey: "lintel_count",    unit: "nos" },
  { key: "plastering",   bg: "#E0E7FF", color: "#3730A3", bar: "#6366F1", label: "Plastering",    qtyKey: "plaster_area_m2", unit: "m\u00B2" },
  { key: "flooring",     bg: "#D1FAE5", color: "#065F46", bar: "#10B981", label: "Flooring",      qtyKey: "floor_area_m2",   unit: "m\u00B2" },
  { key: "roofing",      bg: "#FEF3C7", color: "#78350F", bar: "#B45309", label: "Roofing",       qtyKey: "roof_area_m2",    unit: "m\u00B2" },
  { key: "painting",     bg: "#FCE7F3", color: "#9D174D", bar: "#EC4899", label: "Painting",      qtyKey: "paint_area_m2",   unit: "m\u00B2" },
];

const LABOUR_ITEMS = [
  { key: "labour", bg: "#DBEAFE", color: "#1E40AF", label: "Labour Fee", qtyKey: "labour_days", unit: "days" },
];

const parseAmount = (str) => parseFloat((str || "0").replace(/[^0-9.]/g, "")) || 0;

export default function BOQPanel({ quotation, aiSummary, recalculating }) {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [exporting, setExporting] = useState(false);

  const costs  = quotation?.costs_lkr   || {};
  const qty    = quotation?.quantities  || {};
  const assump = quotation?.assumptions || {};
  const wastage = assump.wastage_pct ?? 10;
  const isV3 = (quotation?.schema_version ?? 2) >= 3;
  const hasSuper = isV3 && parseAmount(costs.SUPERSTRUCTURE_SUBTOTAL) > 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      exportBOQtoPDF({ aiSummary: aiSummary || {}, quotation, specs: assump });
    } finally {
      setExporting(false);
    }
  };

  const fndTotal   = parseAmount(costs.FOUNDATION_SUBTOTAL || costs.MATERIALS_SUBTOTAL);
  const superTotal = parseAmount(costs.SUPERSTRUCTURE_SUBTOTAL);
  const allTotal   = fndTotal + superTotal;

  const renderRow = (item, maxAmount = 0) => {
    const amount = parseAmount(costs[item.key]);
    const pct = maxAmount > 0 ? Math.max(4, (amount / maxAmount) * 100) : 0;
    if (amount === 0 && item.key !== "labour") return null;
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
            {maxAmount > 0 && (
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

  const scopeLabel = isV3
    ? "Foundation + Superstructure · Strip footing · CIDA 1:2:4"
    : "Foundation · Strip footing · incl. " + wastage + "% wastage";

  return (
    <div className={`boq-panel${recalculating ? " boq-panel--recalculating" : ""}`}>
      <div className="boq-panel-header">
        <div>
          <h3 className="boq-panel-title">Bill of Quantities</h3>
          <p className="boq-panel-sub">{scopeLabel}</p>
        </div>
        <div className="boq-header-right">
          <div className="boq-badges">
            <span className="boq-badge boq-badge--soil">{assump.soil_label || "Normal Soil"}</span>
            <span className="boq-badge boq-badge--depth">{assump.footing_depth_m ?? "\u2014"}m deep</span>
            {isV3 && assump.number_of_floors > 1 && (
              <span className="boq-badge boq-badge--floors">{assump.number_of_floors} Floors</span>
            )}
          </div>
          <button className="boq-export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? "Generating..." : "Export PDF"}
          </button>
        </div>
      </div>

      {recalculating && <div className="boq-recalculating">Recalculating...</div>}

      {/* Foundation Materials */}
      <div className="boq-section-label">Foundation Materials</div>
      <div className="boq-list">
        {FOUNDATION_ITEMS.map((item) => renderRow(item, allTotal))}
      </div>
      {costs.FOUNDATION_SUBTOTAL && (
        <div className="boq-subtotal">
          <span>Foundation Subtotal</span>
          <span>{costs.FOUNDATION_SUBTOTAL}</span>
        </div>
      )}
      {/* Backward compat: show old MATERIALS_SUBTOTAL if no FOUNDATION_SUBTOTAL */}
      {!costs.FOUNDATION_SUBTOTAL && costs.MATERIALS_SUBTOTAL && (
        <div className="boq-subtotal">
          <span>Materials Subtotal</span>
          <span>{costs.MATERIALS_SUBTOTAL}</span>
        </div>
      )}

      {/* Superstructure */}
      {hasSuper && (
        <>
          <div className="boq-section-label">Superstructure</div>
          <div className="boq-list">
            {SUPERSTRUCTURE_ITEMS.map((item) => renderRow(item, allTotal))}
          </div>
          <div className="boq-subtotal">
            <span>Superstructure Subtotal</span>
            <span>{costs.SUPERSTRUCTURE_SUBTOTAL}</span>
          </div>
        </>
      )}

      {/* Labour */}
      <div className="boq-section-label">Labour</div>
      <div className="boq-list">
        {LABOUR_ITEMS.map((item) => renderRow(item, 0))}
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
            ["Openings Deducted",  `${assump.opening_deduction_m   ?? 0} m`],
            ["Effective Length",   `${assump.effective_wall_length_m ?? "\u2014"} m`],
            ["Wastage",            `${assump.wastage_pct           ?? 0}%`],
            ["Mix Ratio",          "1 : 2 : 4 (CIDA)"],
            ["Concrete Volume",    `${qty.concrete_m3              ?? "\u2014"} m\u00B3`],
            ...(isV3 ? [
              ["Wall Height",      `${assump.wall_height_m         ?? 3.0} m`],
              ["Floors",           `${assump.number_of_floors      ?? 1}`],
              ["Floor Area",       `${assump.floor_area_m2         ?? 0} m\u00B2`],
              ["Brick Type",       assump.brick_type               ?? "\u2014"],
              ["Roof Type",        assump.roof_type                ?? "none"],
              ["Plaster Type",     assump.plaster_type             ?? "both"],
              ["Paint Type",       assump.paint_type               ?? "emulsion"],
              ["Floor Finish",     assump.floor_finish             ?? "cement"],
              ["Load Factor",      `${assump.floor_load_factor     ?? 1.0}\u00D7`],
            ] : []),
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
