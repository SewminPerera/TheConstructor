import { useState, useRef } from "react";
import "./SpecsPanel.css";

const SOIL_OPTIONS = [
  { value: "hard_rock", label: "Hard Rock",            note: "0.8x depth" },
  { value: "laterite",  label: "Laterite / Hard Soil", note: "0.9x depth" },
  { value: "normal",    label: "Normal Soil (Loam)",   note: "1.0x depth" },
  { value: "sandy",     label: "Sandy Soil",           note: "1.2x depth" },
  { value: "soft_clay", label: "Soft Clay / Fill",     note: "1.5x depth" },
];

const PLINTH_OPTIONS = [
  { value: "0.30", label: "0.30 m (Minimum)" },
  { value: "0.45", label: "0.45 m (Standard)" },
  { value: "0.60", label: "0.60 m (Elevated)" },
  { value: "0.75", label: "0.75 m (Flood Prone)" },
];

export default function SpecsPanel({
  cementBrand, wallThickness, metalBrand, steelBrand,
  planWidth, soilType, wastagePct, plinthHeight, labourDays, labourWorkers,
  isDXF, onShowScaleHelper, onRecalculate,
}) {
  // Local state to avoid sending every keystroke / slider move
  const [localWastage,      setLocalWastage]      = useState(wastagePct);
  const [localLabourDays,   setLocalLabourDays]   = useState(labourDays    ?? "0");
  const [localLabourWorkers,setLocalLabourWorkers] = useState(labourWorkers ?? "1");
  const debounceRef       = useRef(null);
  const labourDebounceRef = useRef(null);

  const handleWastageChange = (e) => {
    const val = e.target.value;
    setLocalWastage(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onRecalculate({ wastagePct: val });
    }, 300);
  };

  const handleLabourDaysChange = (e) => {
    const val = e.target.value;
    setLocalLabourDays(val);
    clearTimeout(labourDebounceRef.current);
    labourDebounceRef.current = setTimeout(() => {
      onRecalculate({ labourDays: val, labourWorkers: localLabourWorkers });
    }, 400);
  };

  const handleLabourWorkersChange = (e) => {
    const val = e.target.value;
    setLocalLabourWorkers(val);
    clearTimeout(labourDebounceRef.current);
    labourDebounceRef.current = setTimeout(() => {
      onRecalculate({ labourWorkers: val, labourDays: localLabourDays });
    }, 400);
  };

  return (
    <div className="specs-card">
      <div className="specs-header">
        <span className="specs-label">Project Specifications</span>
        <span className="specs-live"><span className="live-dot" /> Live recalculation</span>
      </div>

      {/* ── Row 1: Material & Scale ── */}
      <p className="specs-row-title">Materials & Scale</p>
      <div className="specs-grid specs-grid--materials">

        <div className="spec-field">
          <label>Cement Brand</label>
          <select className="spec-select" value={cementBrand} onChange={(e) => onRecalculate({ cementBrand: e.target.value })}>
            <option value="generic">General Rate</option>
            <option value="lanwa">Lanwa</option>
            <option value="ultratec">Ultratec</option>
            <option value="tokyo_super">Tokyo Super</option>
            <option value="sanstha">INSEE / Sanstha</option>
          </select>
        </div>

        <div className="spec-field">
          <label>Wall Thickness</label>
          <select className="spec-select" value={wallThickness} onChange={(e) => onRecalculate({ wallThickness: e.target.value })}>
            <option value="4.5">4.5" (Half Brick)</option>
            <option value="9">9.0" (One Brick)</option>
            <option value="12">12.0" (One & Half)</option>
          </select>
        </div>

        <div className="spec-field">
          <label>Aggregate Supplier</label>
          <select className="spec-select" value={metalBrand} onChange={(e) => onRecalculate({ metalBrand: e.target.value })}>
            <option value="generic">Local Quarry</option>
            <option value="icc">ICC Aggregates</option>
            <option value="tokyo_super">Tokyo Supermix</option>
            <option value="maga">Maga</option>
          </select>
        </div>

        <div className="spec-field">
          <label>Tor Steel Brand</label>
          <select className="spec-select" value={steelBrand} onChange={(e) => onRecalculate({ steelBrand: e.target.value })}>
            <option value="generic">General Rate</option>
            <option value="lanwa">Lanwa (Sanstha)</option>
            <option value="melwa">Melwa</option>
            <option value="gtb">GTB Steel</option>
          </select>
        </div>

        <div className="spec-field">
          <label>
            Reference Width (m)
            {!isDXF && <button className="scale-link" onClick={onShowScaleHelper}>Need help?</button>}
          </label>
          <input
            className={`spec-input${planWidth > 0 ? " has-value" : ""}`}
            type="number" step="0.1"
            placeholder={isDXF ? "Auto (DXF)" : "e.g. 12.5"}
            value={planWidth || ""}
            disabled={isDXF}
            onChange={(e) => onRecalculate({ planWidth: e.target.value })}
          />
        </div>

      </div>

      {/* ── Divider ── */}
      <div className="specs-divider">
        <span>Accuracy Parameters</span>
      </div>


      {/* ── Row 2: Accuracy ── */}
      <div className="specs-grid specs-grid--accuracy">

        <div className="spec-field">
          <label>
            Soil Type
            <span className="spec-accuracy-tag">Accuracy</span>
          </label>
          <select
            className="spec-select spec-select--highlight"
            value={soilType}
            onChange={(e) => onRecalculate({ soilType: e.target.value })}
          >
            {SOIL_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({s.note})
              </option>
            ))}
          </select>
          <p className="spec-hint">Affects footing depth and width calculation</p>
        </div>

        <div className="spec-field">
          <label>
            Plinth Height
            <span className="spec-accuracy-tag">Accuracy</span>
          </label>
          <select
            className="spec-select spec-select--highlight"
            value={plinthHeight}
            onChange={(e) => onRecalculate({ plinthHeight: e.target.value })}
          >
            {PLINTH_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="spec-hint">Height from ground to floor level (affects rubble masonry)</p>
        </div>

        <div className="spec-field">
          <label>
            Wastage %
            <span className="spec-accuracy-tag">Accuracy</span>
          </label>
          <div className="wastage-row">
            <input
              className="spec-input spec-input--wastage"
              type="range" min="0" max="25" step="1"
              value={localWastage}
              onChange={handleWastageChange}
            />
            <span className="wastage-val">{localWastage}%</span>
          </div>
          <p className="spec-hint">
            {localWastage == 0  ? "No wastage — underestimates real cost" :
             localWastage <= 10 ? "Recommended for good contractors (10%)" :
             localWastage <= 15 ? "Standard allowance (10-15%)" :
                                  "High wastage — check site conditions"}
          </p>
        </div>

      </div>

      {/* ── Divider ── */}
      <div className="specs-divider">
        <span>Labour</span>
      </div>

      {/* ── Labour section ── */}
      <div className="specs-grid specs-grid--labour">

        <div className="spec-field spec-field--labour">
          <label>
            Labour Fee
            <span className="spec-accuracy-tag">Cost</span>
          </label>
          <div className="labour-input-row">
            <div className="labour-input-group">
              <span className="labour-input-label">How many days</span>
              <input
                className="spec-input spec-input--days"
                type="number"
                min="0"
                max="999"
                step="1"
                placeholder="0"
                value={localLabourDays}
                onChange={handleLabourDaysChange}
              />
            </div>
            <span className="labour-multiply">×</span>
            <div className="labour-input-group">
              <span className="labour-input-label">How many people</span>
              <input
                className="spec-input spec-input--days"
                type="number"
                min="1"
                max="99"
                step="1"
                placeholder="1"
                value={localLabourWorkers}
                onChange={handleLabourWorkersChange}
              />
            </div>
            <span className="labour-unit">@ Rs.&nbsp;3,500 / person / day</span>
          </div>
          <p className="spec-hint">
            {localLabourDays > 0
              ? `${localLabourDays} days × ${localLabourWorkers} people = Rs. ${(localLabourDays * (parseInt(localLabourWorkers) || 1) * 3500).toLocaleString("en-LK")}`
              : "Enter days and number of workers to include labour cost"}
          </p>
        </div>

      </div>
    </div>
  );
}
