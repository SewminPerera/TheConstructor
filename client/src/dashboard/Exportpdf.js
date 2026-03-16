// ExportPDF.js — client-side BOQ PDF export using jsPDF
// Install: npm install jspdf

import jsPDF from "jspdf";

export function exportBOQtoPDF({ aiSummary, quotation, specs }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210; // A4 width
  const MARGIN = 20;
  const COL = W - MARGIN * 2;
  let y = 0;

  const costs     = quotation?.costs_lkr    || {};
  const qty       = quotation?.quantities   || {};
  const assump    = quotation?.assumptions  || {};
  const unitRates = quotation?.unit_rates_lkr || {};
  const wastage   = assump.wastage_pct ?? 10;

  const ink    = [13,  13,  13];
  const muted  = [107, 114, 128];
  const amber  = [245, 158, 11];
  const white  = [255, 255, 255];
  const border = [229, 231, 235];
  const green  = [220, 252, 231];
  const blue   = [219, 234, 254];

  // ── Helper functions ──────────────────────────────────────────────────────
  const setFont = (size, weight = "normal", color = ink) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", weight);
    doc.setTextColor(...color);
  };
  const rect = (x, ry, w, h, color, radius = 0) => {
    doc.setFillColor(...color);
    if (radius) doc.roundedRect(x, ry, w, h, radius, radius, "F");
    else        doc.rect(x, ry, w, h, "F");
  };
  const line = (ry, color = border) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, ry, W - MARGIN, ry);
  };

  // ── HEADER BAND ───────────────────────────────────────────────────────────
  rect(0, 0, W, 42, ink);
  setFont(20, "bold", white);
  doc.text("TheConstructor AI", MARGIN, 16);
  setFont(9, "normal", amber);
  doc.text("Foundation Cost Estimation Report", MARGIN, 23);
  setFont(8, "normal", [156, 163, 175]);
  const now = new Date().toLocaleDateString("en-LK", { year:"numeric", month:"long", day:"numeric" });
  doc.text(`Generated: ${now}`, MARGIN, 30);
  doc.text("CIDA 1:2:4 Mix · Strip Footing · Materials + Labour", MARGIN, 36);

  // Scale source badge
  const src = aiSummary?.scale_source || "Unknown";
  const badgeColor = src.toLowerCase().includes("dxf") ? [219,234,254] : [220,252,231];
  const badgeText  = src.toLowerCase().includes("dxf") ? [29,78,216]   : [22,101,52];
  rect(W - 72, 8, 52, 10, badgeColor, 3);
  doc.setTextColor(...badgeText);
  doc.setFontSize(7.5); doc.setFont("helvetica","bold");
  doc.text(src, W - 70, 14.5);

  y = 50;

  // ── SECTION: Blueprint Summary ────────────────────────────────────────────
  setFont(9, "bold", muted);
  doc.text("BLUEPRINT SUMMARY", MARGIN, y); y += 6;
  line(y); y += 5;

  const summaryItems = [
    ["Scale Source",      aiSummary?.scale_source || "—"],
    ["Wall Length",       `${aiSummary?.length_m ?? "—"} m`],
    ["Doors Detected",    `${aiSummary?.doors ?? "—"}`],
    ["Windows Detected",  `${aiSummary?.windows ?? "—"}`],
  ];

  const halfCol = COL / 2 - 4;
  summaryItems.forEach(([k, v], i) => {
    const x = MARGIN + (i % 2) * (halfCol + 8);
    if (i % 2 === 0 && i > 0) y += 10;
    rect(x, y - 4, halfCol, 9, [249,250,251], 2);
    setFont(8, "normal", muted);
    doc.text(k, x + 4, y + 1);
    setFont(9, "bold", ink);
    doc.text(String(v), x + halfCol - 4, y + 1, { align: "right" });
  });
  y += 14;

  // ── SECTION: Project Specs ────────────────────────────────────────────────
  setFont(9, "bold", muted);
  doc.text("PROJECT SPECIFICATIONS", MARGIN, y); y += 6;
  line(y); y += 5;

  const specItems = [
    ["Foundation Type",    assump.foundation_type      || "Strip Footing"],
    ["Soil Type",          assump.soil_label            || "Normal Soil"],
    ["Wall Thickness",     `${assump.wall_thickness_in ?? "—"}"`],
    ["Plinth Height",      `${assump.plinth_height_m   ?? "—"} m`],
    ["Footing Width",      `${assump.footing_width_m   ?? "—"} m`],
    ["Trench Depth",       `${assump.trench_depth_m    ?? "—"} m`],
    ["Opening Deduction",  `${assump.opening_deduction_m ?? 0} m (${assump.door_count ?? 0}D + ${assump.window_count ?? 0}W)`],
    ["Effective Length",   `${assump.effective_wall_length_m ?? "—"} m`],
    ["Wastage Allowance",  `${wastage}%`],
    ["Mix Ratio",          "1 : 2 : 4 (CIDA)"],
    ["Cement Brand",       assump.cement_brand         || "Generic"],
    ["Steel Brand",        assump.steel_brand          || "Generic"],
    ["Aggregate Supplier", assump.metal_brand          || "Generic"],
    ["Concrete Volume",    `${qty.concrete_m3          ?? "—"} m³`],
  ];

  const thirdCol = COL / 2 - 4;
  specItems.forEach(([k, v], i) => {
    const col = i % 2;
    const x   = MARGIN + col * (thirdCol + 8);
    if (col === 0 && i > 0) y += 10;
    rect(x, y - 4, thirdCol, 9, [249,250,251], 2);
    setFont(8, "normal", muted);
    doc.text(k, x + 4, y + 1);
    setFont(9, "bold", ink);
    doc.text(String(v), x + thirdCol - 4, y + 1, { align: "right" });
  });
  y += 14;

  // ── SECTION: Bill of Quantities ───────────────────────────────────────────
  setFont(9, "bold", muted);
  doc.text("BILL OF QUANTITIES", MARGIN, y); y += 6;
  line(y); y += 4;

  // Column positions
  const C1 = MARGIN + 4;       // Material name
  const C2 = MARGIN + 62;      // Order Qty
  const C3 = MARGIN + 95;      // Net Qty
  const C4 = MARGIN + 120;     // Unit Rate
  const C5 = MARGIN + COL - 4; // Total (right-aligned)

  // Table header
  rect(MARGIN, y, COL, 8, ink, 3);
  setFont(7.5, "bold", white);
  doc.text("Material",       C1,       y + 5.5);
  doc.text("Order Qty",      C2,       y + 5.5);
  doc.text("Net Qty",        C3,       y + 5.5);
  doc.text("Unit Rate (LKR)",C4,       y + 5.5);
  doc.text("Total (LKR)",    C5,       y + 5.5, { align: "right" });
  y += 10;

  // ── Materials section label ──
  rect(MARGIN, y, COL, 7, [243,244,246]);
  setFont(7, "bold", muted);
  doc.text("MATERIALS", C1, y + 5);
  y += 7;

  const MATERIAL_ROWS = [
    { label: "Cement",             qtyKey: "cement_bags", unit: "bags", costKey: "cement",         rateKey: "cement_bag" },
    { label: "River Sand",         qtyKey: "sand_m3",     unit: "m³",   costKey: "sand",            rateKey: "sand_m3"    },
    { label: "Metal / Aggregate",  qtyKey: "metal_m3",    unit: "m³",   costKey: "metal",           rateKey: "metal_m3"   },
    { label: "Tor Steel",          qtyKey: "steel_kg",    unit: "kg",   costKey: "steel",           rateKey: "steel_kg"   },
    { label: "Rubble Stone",       qtyKey: "rubble_m3",   unit: "m³",   costKey: "rubble_masonry",  rateKey: "rubble_m3"  },
  ];

  MATERIAL_ROWS.forEach((row, i) => {
    const rowBg = i % 2 === 0 ? [249,250,251] : white;
    rect(MARGIN, y, COL, 10, rowBg);
    doc.setDrawColor(...border); doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, COL, 10);

    const orderQty  = qty[row.qtyKey]           ?? "—";
    const netQty    = qty[`net_${row.qtyKey}`]  ?? "—";
    const unitRate  = unitRates[row.rateKey]    ? `Rs. ${Number(unitRates[row.rateKey]).toLocaleString("en-LK", { minimumFractionDigits: 2 })}` : "—";
    const total     = costs[row.costKey]        || "Rs. 0.00";

    setFont(8.5, "bold", ink);
    doc.text(row.label,                 C1,  y + 6.5);
    setFont(7.5, "normal", ink);
    doc.text(`${orderQty} ${row.unit}`, C2,  y + 6.5);
    doc.text(`${netQty !== "—" ? netQty : "—"} ${netQty !== "—" ? row.unit : ""}`, C3, y + 6.5);
    doc.text(String(unitRate),          C4,  y + 6.5);
    setFont(8, "bold", ink);
    doc.text(String(total),             C5,  y + 6.5, { align: "right" });
    y += 10;
  });

  // Materials Subtotal
  rect(MARGIN, y, COL, 9, [243,244,246]);
  setFont(8, "bold", [55,65,81]);
  doc.text("Materials Subtotal",           C1,  y + 6);
  doc.text(costs.MATERIALS_SUBTOTAL || "Rs. 0.00", C5, y + 6, { align: "right" });
  y += 9;

  // ── Labour section label ──
  rect(MARGIN, y, COL, 7, [243,244,246]);
  setFont(7, "bold", muted);
  doc.text("LABOUR", C1, y + 5);
  y += 7;

  // Labour row
  const labourDays    = qty.labour_days    ?? 0;
  const labourWorkers = qty.labour_workers ?? 1;
  const labourRate = unitRates.labour_day ? `Rs. ${Number(unitRates.labour_day).toLocaleString("en-LK", { minimumFractionDigits: 2 })}/person/day` : "—";
  rect(MARGIN, y, COL, 10, [249,250,251]);
  doc.setDrawColor(...border); doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, COL, 10);
  setFont(8.5, "bold", ink);
  doc.text("Labour Fee", C1, y + 6.5);
  setFont(7.5, "normal", ink);
  doc.text(`${labourDays}d × ${labourWorkers}p`, C2, y + 6.5);
  doc.text("—", C3, y + 6.5);
  doc.text(labourRate, C4, y + 6.5);
  setFont(8, "bold", ink);
  doc.text(costs.labour || "Rs. 0.00", C5, y + 6.5, { align: "right" });
  y += 10;

  // Labour Subtotal
  rect(MARGIN, y, COL, 9, [243,244,246]);
  setFont(8, "bold", [55,65,81]);
  doc.text("Labour Subtotal",              C1,  y + 6);
  doc.text(costs.LABOUR_SUBTOTAL || "Rs. 0.00", C5, y + 6, { align: "right" });
  y += 9;

  // Grand Total row
  y += 2;
  rect(MARGIN, y, COL, 14, ink, 4);
  setFont(10, "bold", white);
  doc.text("GRAND TOTAL",               MARGIN + 4,  y + 9);
  setFont(8,  "normal", [156,163,175]);
  doc.text(`incl. ${wastage}% wastage`, MARGIN + 4,  y + 13.5);
  doc.setTextColor(...amber);
  doc.setFontSize(13); doc.setFont("helvetica","bold");
  doc.text(costs.GRAND_TOTAL || "Rs. 0.00", MARGIN + COL - 4, y + 10, { align: "right" });
  y += 20;

  // ── SECTION: Quantity Details ─────────────────────────────────────────────
  setFont(9, "bold", muted);
  doc.text("NET QUANTITIES (before wastage)", MARGIN, y); y += 6;
  line(y); y += 5;

  const netItems = [
    ["Cement (net)",      `${qty.net_cement_bags ?? "—"} bags`],
    ["River Sand (net)",  `${qty.net_sand_m3     ?? "—"} m³`  ],
    ["Aggregate (net)",   `${qty.net_metal_m3    ?? "—"} m³`  ],
    ["Tor Steel (net)",   `${qty.net_steel_kg    ?? "—"} kg`  ],
  ];
  netItems.forEach(([k, v], i) => {
    const col = i % 2;
    const x   = MARGIN + col * (thirdCol + 8);
    if (col === 0 && i > 0) y += 9;
    rect(x, y - 3.5, thirdCol, 8, [249,250,251], 2);
    setFont(8, "normal", muted); doc.text(k, x + 4, y + 1);
    setFont(9, "bold",   ink);   doc.text(v, x + thirdCol - 4, y + 1, { align: "right" });
  });
  y += 14;

  // ── FOOTER ────────────────────────────────────────────────────────────────
  line(y); y += 5;
  setFont(7.5, "normal", muted);
  doc.text("This estimate covers foundation materials and labour. Earthwork, finishing, and other costs are excluded.", MARGIN, y);
  y += 5;
  doc.text("Prices are based on current Sri Lankan market rates. Verify with local suppliers before procurement.", MARGIN, y);
  y += 5;
  setFont(7.5, "bold", muted);
  doc.text("TheConstructor AI · Built for Sri Lankan Construction · CIDA 1:2:4 Standard", MARGIN, y);

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const filename = `BOQ_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}
