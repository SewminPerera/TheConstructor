

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
  const isV3      = (quotation?.schema_version ?? 2) >= 3;

  const ink    = [13,  13,  13];
  const muted  = [107, 114, 128];
  const amber  = [245, 158, 11];
  const white  = [255, 255, 255];
  const border = [229, 231, 235];

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
  const checkPageBreak = (needed) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // ── HEADER BAND ───────────────────────────────────────────────────────────
  rect(0, 0, W, 42, ink);
  setFont(20, "bold", white);
  doc.text("TheConstructor AI", MARGIN, 16);
  setFont(9, "normal", amber);
  doc.text(
    isV3 ? "Construction Cost Estimation Report" : "Foundation Cost Estimation Report",
    MARGIN, 23
  );
  setFont(8, "normal", [156, 163, 175]);
  const now = new Date().toLocaleDateString("en-LK", { year:"numeric", month:"long", day:"numeric" });
  doc.text(`Generated: ${now}`, MARGIN, 30);
  doc.text(
    isV3
      ? "CIDA 1:2:4 Mix · Foundation + Superstructure · Materials + Labour"
      : "CIDA 1:2:4 Mix · Strip Footing · Materials + Labour",
    MARGIN, 36
  );

  // Scale source badge
  const src = aiSummary?.scale_source || "Unknown";
  const badgeColor = src.toLowerCase().includes("dxf") ? [219,234,254] : [220,252,231];
  const badgeText  = src.toLowerCase().includes("dxf") ? [29,78,216]   : [22,101,52];
  rect(W - 72, 8, 52, 10, badgeColor, 3);
  doc.setTextColor(...badgeText);
  doc.setFontSize(7.5); doc.setFont("helvetica","bold");
  doc.text(src, W - 70, 14.5);

  // Confidence badge
  const conf = aiSummary?.confidence;
  if (conf && conf.score !== undefined) {
    const confColor = conf.score >= 75 ? [220,252,231] : conf.score >= 55 ? [219,234,254] : conf.score >= 35 ? [254,243,199] : [254,226,226];
    const confText  = conf.score >= 75 ? [22,101,52]   : conf.score >= 55 ? [29,78,216]   : conf.score >= 35 ? [146,64,14]   : [185,28,28];
    rect(W - 72, 20, 52, 10, confColor, 3);
    doc.setTextColor(...confText);
    doc.setFontSize(7.5); doc.setFont("helvetica","bold");
    doc.text(`${conf.label} · ${conf.score}%`, W - 70, 26.5);
  }

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
  if (aiSummary?.rooms?.room_count > 0) {
    summaryItems.push(["Rooms Detected",   `${aiSummary.rooms.room_count}`]);
    summaryItems.push(["Total Floor Area", `${aiSummary.rooms.total_floor_area_m2} m²`]);
  }

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
  checkPageBreak(60);
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
  if (isV3) {
    specItems.push(
      ["Wall Height",       `${assump.wall_height_m      ?? 3.0} m`],
      ["Number of Floors",  `${assump.number_of_floors   ?? 1}`],
      ["Floor Area",        `${assump.floor_area_m2      ?? 0} m²`],
      ["Brick Type",        assump.brick_type            ?? "—"],
      ["Roof Type",         assump.roof_type             ?? "none"],
      ["Plaster Type",      assump.plaster_type          ?? "both"],
      ["Paint Type",        assump.paint_type            ?? "emulsion"],
      ["Floor Finish",      assump.floor_finish          ?? "cement"],
      ["Load Factor",       `${assump.floor_load_factor  ?? 1.0}×`],
    );
  }

  const thirdCol = COL / 2 - 4;
  specItems.forEach(([k, v], i) => {
    const col = i % 2;
    const x   = MARGIN + col * (thirdCol + 8);
    if (col === 0 && i > 0) y += 10;
    checkPageBreak(12);
    rect(x, y - 4, thirdCol, 9, [249,250,251], 2);
    setFont(8, "normal", muted);
    doc.text(k, x + 4, y + 1);
    setFont(9, "bold", ink);
    doc.text(String(v), x + thirdCol - 4, y + 1, { align: "right" });
  });
  y += 14;

  // ── SECTION: Bill of Quantities ───────────────────────────────────────────
  checkPageBreak(40);
  setFont(9, "bold", muted);
  doc.text("BILL OF QUANTITIES", MARGIN, y); y += 6;
  line(y); y += 4;

  // Column positions
  const C1 = MARGIN + 4;
  const C2 = MARGIN + 62;
  const C3 = MARGIN + 95;
  const C4 = MARGIN + 120;
  const C5 = MARGIN + COL - 4;

  // Table header
  rect(MARGIN, y, COL, 8, ink, 3);
  setFont(7.5, "bold", white);
  doc.text("Material",       C1,       y + 5.5);
  doc.text("Order Qty",      C2,       y + 5.5);
  doc.text("Net Qty",        C3,       y + 5.5);
  doc.text("Unit Rate (LKR)",C4,       y + 5.5);
  doc.text("Total (LKR)",    C5,       y + 5.5, { align: "right" });
  y += 10;

  const renderTableRow = (row, i) => {
    checkPageBreak(12);
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
  };

  // ── Foundation Materials ──
  rect(MARGIN, y, COL, 7, [243,244,246]);
  setFont(7, "bold", muted);
  doc.text("FOUNDATION MATERIALS", C1, y + 5);
  y += 7;

  const MATERIAL_ROWS = [
    { label: "Cement",             qtyKey: "cement_bags", unit: "bags", costKey: "cement",         rateKey: "cement_bag" },
    { label: "River Sand",         qtyKey: "sand_m3",     unit: "m³",   costKey: "sand",            rateKey: "sand_m3"    },
    { label: "Metal / Aggregate",  qtyKey: "metal_m3",    unit: "m³",   costKey: "metal",           rateKey: "metal_m3"   },
    { label: "Tor Steel",          qtyKey: "steel_kg",    unit: "kg",   costKey: "steel",           rateKey: "steel_kg"   },
    { label: "Rubble Stone",       qtyKey: "rubble_m3",   unit: "m³",   costKey: "rubble_masonry",  rateKey: "rubble_m3"  },
  ];

  MATERIAL_ROWS.forEach((row, i) => renderTableRow(row, i));

  // Foundation Subtotal
  const fndSubKey = costs.FOUNDATION_SUBTOTAL || costs.MATERIALS_SUBTOTAL || "Rs. 0.00";
  rect(MARGIN, y, COL, 9, [243,244,246]);
  setFont(8, "bold", [55,65,81]);
  doc.text("Foundation Subtotal", C1, y + 6);
  doc.text(fndSubKey, C5, y + 6, { align: "right" });
  y += 9;

  // ── Superstructure ──
  if (isV3) {
    const SUPER_ROWS = [
      { label: "Wall Masonry",  qtyKey: "block_count",     unit: "blocks", costKey: "wall_masonry",  rateKey: "brick_each" },
      { label: "Lintels",       qtyKey: "lintel_count",    unit: "nos",    costKey: "lintels",       rateKey: "lintel_each" },
      { label: "Plastering",    qtyKey: "plaster_area_m2", unit: "m²",     costKey: "plastering",    rateKey: "plaster_m2" },
      { label: "Flooring",      qtyKey: "floor_area_m2",   unit: "m²",     costKey: "flooring",      rateKey: "floor_m2" },
      { label: "Roofing",       qtyKey: "roof_area_m2",    unit: "m²",     costKey: "roofing",       rateKey: "roof_m2" },
      { label: "Painting",      qtyKey: "paint_area_m2",   unit: "m²",     costKey: "painting",      rateKey: "paint_m2" },
    ];

    const hasAnySuper = SUPER_ROWS.some((r) => parseFloat((costs[r.costKey] || "0").replace(/[^0-9.]/g, "")) > 0);

    if (hasAnySuper) {
      checkPageBreak(20);
      rect(MARGIN, y, COL, 7, [243,244,246]);
      setFont(7, "bold", muted);
      doc.text("SUPERSTRUCTURE", C1, y + 5);
      y += 7;

      let superIdx = 0;
      SUPER_ROWS.forEach((row) => {
        const amount = parseFloat((costs[row.costKey] || "0").replace(/[^0-9.]/g, ""));
        if (amount > 0) {
          renderTableRow(row, superIdx);
          superIdx++;
        }
      });

      if (costs.SUPERSTRUCTURE_SUBTOTAL) {
        rect(MARGIN, y, COL, 9, [243,244,246]);
        setFont(8, "bold", [55,65,81]);
        doc.text("Superstructure Subtotal", C1, y + 6);
        doc.text(costs.SUPERSTRUCTURE_SUBTOTAL, C5, y + 6, { align: "right" });
        y += 9;
      }
    }
  }

  // ── Labour ──
  checkPageBreak(30);
  rect(MARGIN, y, COL, 7, [243,244,246]);
  setFont(7, "bold", muted);
  doc.text("LABOUR", C1, y + 5);
  y += 7;

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

  rect(MARGIN, y, COL, 9, [243,244,246]);
  setFont(8, "bold", [55,65,81]);
  doc.text("Labour Subtotal",              C1,  y + 6);
  doc.text(costs.LABOUR_SUBTOTAL || "Rs. 0.00", C5, y + 6, { align: "right" });
  y += 9;

  // ── Grand Total ──
  checkPageBreak(20);
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

  // ── SECTION: Cost Breakdown Chart ─────────────────────────────────────────
  checkPageBreak(60);
  setFont(9, "bold", muted);
  doc.text("COST BREAKDOWN", MARGIN, y); y += 6;
  line(y); y += 8;

  const allKeys = [
    ["Cement", "cement"], ["Sand", "sand"], ["Aggregate", "metal"],
    ["Tor Steel", "steel"], ["Rubble", "rubble_masonry"],
    ...(isV3 ? [
      ["Masonry", "wall_masonry"], ["Lintels", "lintels"],
      ["Plastering", "plastering"], ["Flooring", "flooring"],
      ["Roofing", "roofing"], ["Painting", "painting"],
    ] : []),
    ["Labour", "labour"],
  ];

  const chartColors = [
    [245,158,11], [234,179,8], [148,163,184], [248,113,113], [167,139,250],
    [217,119,6], [239,68,68], [99,102,241], [16,185,129], [180,83,9], [236,72,153], [96,165,250],
  ];

  const grandTotal = parseFloat((costs.GRAND_TOTAL || "0").replace(/[^0-9.]/g, "")) || 1;
  const barMaxW = COL - 60;

  allKeys.forEach(([label, key], i) => {
    const amt = parseFloat((costs[key] || "0").replace(/[^0-9.]/g, ""));
    if (amt > 0) {
      checkPageBreak(12);
      const pct = (amt / grandTotal) * 100;
      const barW = Math.max(2, (pct / 100) * barMaxW);

      setFont(8, "normal", muted);
      doc.text(label, MARGIN, y + 3);

      doc.setFillColor(...chartColors[i % chartColors.length]);
      doc.roundedRect(MARGIN + 50, y - 1, barW, 6, 1.5, 1.5, "F");

      setFont(7.5, "bold", ink);
      doc.text(`${pct.toFixed(1)}%`, MARGIN + 52 + barW, y + 3);
      y += 10;
    }
  });

  y += 6;

  // ── SECTION: Net Quantities ─────────────────────────────────────────────
  checkPageBreak(40);
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
    checkPageBreak(10);
    rect(x, y - 3.5, thirdCol, 8, [249,250,251], 2);
    setFont(8, "normal", muted); doc.text(k, x + 4, y + 1);
    setFont(9, "bold",   ink);   doc.text(v, x + thirdCol - 4, y + 1, { align: "right" });
  });
  y += 14;

  // ── FOOTER ────────────────────────────────────────────────────────────────
  checkPageBreak(20);
  line(y); y += 5;
  setFont(7.5, "normal", muted);
  doc.text(
    isV3
      ? "This estimate covers foundation and superstructure materials and labour. Site work and MEP are excluded."
      : "This estimate covers foundation materials and labour. Earthwork, finishing, and other costs are excluded.",
    MARGIN, y
  );
  y += 5;
  doc.text("Prices are based on current Sri Lankan market rates. Verify with local suppliers before procurement.", MARGIN, y);
  y += 5;
  setFont(7.5, "bold", muted);
  doc.text("TheConstructor AI · Built for Sri Lankan Construction · CIDA 1:2:4 Standard", MARGIN, y);

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const scope = isV3 ? "Full_Estimate" : "Foundation_BOQ";
  const filename = `${scope}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}
