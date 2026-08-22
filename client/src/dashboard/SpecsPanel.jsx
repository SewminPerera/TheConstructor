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

const WALL_HEIGHT_OPTIONS = [
  { value: "2.7", label: "2.7 m (Low Ceiling)" },
  { value: "3.0", label: "3.0 m (Standard)" },
  { value: "3.3", label: "3.3 m (High Ceiling)" },
  { value: "3.6", label: "3.6 m (Double Height)" },
];

const ROOF_OPTIONS = [
  { value: "none",         label: "Not Included" },
  { value: "flat_slab",    label: "Flat Concrete Slab" },
  { value: "timber_tile",  label: "Timber + Clay Tiles" },
  { value: "timber_sheet", label: "Timber + Metal Sheet" },
];

export default function SpecsPanel({
  cementBrand, wallThickness, metalBrand, steelBrand,
  planWidth, soilType, wastagePct, plinthHeight, plinths, labourDays, labourWorkers,
  wallHeight, numberOfFloors, floorArea, roofType, brickType, plasterType, paintType, floorFinish,
  isDXF, onShowScaleHelper, onShowCalibrator, onRecalculate,
}) {
  const [localWastage,       setLocalWastage]       = useState(wastagePct);
  const [localLabourDays,    setLocalLabourDays]    = useState(labourDays    ?? "0");
  const [localLabourWorkers, setLocalLabourWorkers] = useState(labourWorkers ?? "1");
  const [localFloorArea,     setLocalFloorArea]     = useState(floorArea     ?? "0");
  const [localPlinths,       setLocalPlinths]       = useState(Array.isArray(plinths) ? plinths : []);
  const debounceRef       = useRef(null);
  const labourDebounceRef = useRef(null);
  const areaDebounceRef   = useRef(null);
  const plinthDebounceRef = useRef(null);

  const pushPlinths = (list) => {
    setLocalPlinths(list);
    clearTimeout(plinthDebounceRef.current);
    plinthDebounceRef.current = setTimeout(() => {
      onRecalculate({ plinths: list });
    }, 350);
  };

  const handleAddPlinth = () => {
    pushPlinths([...localPlinths, { length_m: "1.0", width_m: "1.0", height_m: "0.45" }]);
  };

  const handleRemovePlinth = (idx) => {
    pushPlinths(localPlinths.filter((_, i) => i !== idx));
  };

  const handlePlinthChange = (idx, field, value) => {
    const next = localPlinths.map((p, i) =>
      i === idx ? { ...p, [field]: value } : p
    );
    pushPlinths(next);
  };

  const totalPlinthVolume = localPlinths.reduce((sum, p) => {
    const l = parseFloat(p.length_m) || 0;
    const w = parseFloat(p.width_m)  || 0;
    const h = parseFloat(p.height_m) || 0;
    return sum + (l * w * h);
  }, 0);

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

  const handleFloorAreaChange = (e) => {
    const val = e.target.value;
    setLocalFloorArea(val);
    clearTimeout(areaDebounceRef.current);
    areaDebounceRef.current = setTimeout(() => {
      onRecalculate({ floorArea: val });
    }, 300);
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
            {!isDXF && onShowCalibrator && <button className="scale-link" onClick={onShowCalibrator}>Calibrate</button>}
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
      <div className="specs-divider"><span>Accuracy Parameters</span></div>

      {/* ── Row 2: Accuracy ── */}
      <div className="specs-grid specs-grid--accuracy">

        <div className="spec-field">
          <label>Soil Type <span className="spec-accuracy-tag">Accuracy</span></label>
          <select className="spec-select spec-select--highlight" value={soilType} onChange={(e) => onRecalculate({ soilType: e.target.value })}>
            {SOIL_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label} ({s.note})</option>
            ))}
          </select>
          <p className="spec-hint">Affects footing depth and width calculation</p>
        </div>

        <div className="spec-field">
          <label>Plinth Height <span className="spec-accuracy-tag">Accuracy</span></label>
          <select className="spec-select spec-select--highlight" value={plinthHeight} onChange={(e) => onRecalculate({ plinthHeight: e.target.value })}>
            {PLINTH_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <p className="spec-hint">Height from ground to floor level</p>
        </div>

        <div className="spec-field">
          <label>Wastage % <span className="spec-accuracy-tag">Accuracy</span></label>
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

      <div className="specs-divider"><span>Extra Plinths (Optional)</span></div>

      <div className="plinths-section">
        <div className="plinths-header">
          <div>
            <div className="plinths-title">Additional plinths in the house</div>
            <div className="plinths-sub">
              Add separate plinths for verandahs, garden walls, pillars, or raised platforms.
              {localPlinths.length > 0 && (
                <span className="plinths-summary">
                  {" "}{localPlinths.length} plinth{localPlinths.length === 1 ? "" : "s"} · Total volume {totalPlinthVolume.toFixed(2)} m³
                </span>
              )}
            </div>
          </div>
          <button type="button" className="plinth-add-btn" onClick={handleAddPlinth}>
            + Add Plinth
          </button>
        </div>

        {localPlinths.length === 0 && (
          <div className="plinths-empty">No extra plinths added. The standard foundation plinth (above) is included by default.</div>
        )}

        {localPlinths.length > 0 && (
          <div className="plinths-list">
            {localPlinths.map((p, idx) => {
              const vol = ((parseFloat(p.length_m) || 0) *
                           (parseFloat(p.width_m)  || 0) *
                           (parseFloat(p.height_m) || 0)).toFixed(2);
              return (
                <div key={idx} className="plinth-row">
                  <div className="plinth-index">#{idx + 1}</div>
                  <div className="plinth-fields">
                    <div className="plinth-field">
                      <label>Length (m)</label>
                      <input
                        className="spec-input"
                        type="number" min="0" step="0.05"
                        value={p.length_m}
                        onChange={(e) => handlePlinthChange(idx, "length_m", e.target.value)}
                      />
                    </div>
                    <span className="plinth-x">×</span>
                    <div className="plinth-field">
                      <label>Width (m)</label>
                      <input
                        className="spec-input"
                        type="number" min="0" step="0.05"
                        value={p.width_m}
                        onChange={(e) => handlePlinthChange(idx, "width_m", e.target.value)}
                      />
                    </div>
                    <span className="plinth-x">×</span>
                    <div className="plinth-field">
                      <label>Height (m)</label>
                      <input
                        className="spec-input"
                        type="number" min="0" step="0.05"
                        value={p.height_m}
                        onChange={(e) => handlePlinthChange(idx, "height_m", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="plinth-volume">{vol} m³</div>
                  <button type="button" className="plinth-remove-btn"
                          onClick={() => handleRemovePlinth(idx)}
                          aria-label="Remove plinth">×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Divider: Superstructure ── */}
      <div className="specs-divider"><span>Superstructure</span></div>

      <div className="specs-grid specs-grid--super">

        <div className="spec-field">
          <label>Wall Height</label>
          <select className="spec-select" value={wallHeight} onChange={(e) => onRecalculate({ wallHeight: e.target.value })}>
            {WALL_HEIGHT_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>

        <div className="spec-field">
          <label>Number of Floors</label>
          <select className="spec-select" value={numberOfFloors} onChange={(e) => onRecalculate({ numberOfFloors: e.target.value })}>
            <option value="1">1 Floor (Single Storey)</option>
            <option value="2">2 Floors</option>
            <option value="3">3 Floors</option>
          </select>
        </div>

        <div className="spec-field">
          <label>Floor Area (m²)</label>
          <input
            className="spec-input"
            type="number" min="0" step="1"
            placeholder="Auto-detected or enter manually"
            value={localFloorArea > 0 ? localFloorArea : ""}
            onChange={handleFloorAreaChange}
          />
          <p className="spec-hint">Used for flooring, roofing, and painting estimates</p>
        </div>

        <div className="spec-field">
          <label>Block / Brick Type</label>
          <select className="spec-select" value={brickType} onChange={(e) => onRecalculate({ brickType: e.target.value })}>
            <option value="cement_block">Cement Block (200mm)</option>
            <option value="clay_brick">Clay Brick (110mm)</option>
          </select>
        </div>

        <div className="spec-field">
          <label>Roof Type</label>
          <select className="spec-select" value={roofType} onChange={(e) => onRecalculate({ roofType: e.target.value })}>
            {ROOF_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="spec-field">
          <label>Plastering</label>
          <select className="spec-select" value={plasterType} onChange={(e) => onRecalculate({ plasterType: e.target.value })}>
            <option value="none">Not Included</option>
            <option value="internal">Internal Only</option>
            <option value="external">External Only</option>
            <option value="both">Both Sides</option>
          </select>
        </div>

        <div className="spec-field">
          <label>Paint Type</label>
          <select className="spec-select" value={paintType} onChange={(e) => onRecalculate({ paintType: e.target.value })}>
            <option value="none">Not Included</option>
            <option value="emulsion">Emulsion</option>
            <option value="weathercoat">Weathercoat</option>
          </select>
        </div>

        <div className="spec-field">
          <label>Floor Finish</label>
          <select className="spec-select" value={floorFinish} onChange={(e) => onRecalculate({ floorFinish: e.target.value })}>
            <option value="cement">Cement Screed</option>
            <option value="tile">Ceramic Tiles</option>
          </select>
        </div>

      </div>

      {/* ── Divider: Labour ── */}
      <div className="specs-divider"><span>Labour</span></div>

      <div className="specs-grid specs-grid--labour">
        <div className="spec-field spec-field--labour">
          <label>Labour Fee <span className="spec-accuracy-tag">Cost</span></label>
          <div className="labour-input-row">
            <div className="labour-input-group">
              <span className="labour-input-label">How many days</span>
              <input
                className="spec-input spec-input--days"
                type="number" min="0" max="999" step="1"
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
                type="number" min="1" max="99" step="1"
                placeholder="1"
                value={localLabourWorkers}
                onChange={handleLabourWorkersChange}
              />
            </div>
            <span className="labour-unit">@ Rs.&nbsp;4,000 / person / day</span>
          </div>
          <p className="spec-hint">
            {localLabourDays > 0
              ? `${localLabourDays} days × ${localLabourWorkers} people = Rs. ${(localLabourDays * (parseInt(localLabourWorkers) || 1) * 4000).toLocaleString("en-LK")}`
              : "Enter days and number of workers to include labour cost"}
          </p>
        </div>
      </div>
    </div>
  );
}
