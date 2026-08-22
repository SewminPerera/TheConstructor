import { useState } from "react";
import "./ScaleHelper.css";

const TABS = [
  { id: "ratio", label: "Drawing Scale" },
  { id: "dim",   label: "Width / Length" },
  { id: "sqft",  label: "Square Footage" },
  { id: "sqm",   label: "Square Metres"  },
];

const COMMON_SCALES = [
  { label: "1:50",  value: 50  },
  { label: "1:75",  value: 75  },
  { label: "1:100", value: 100 },
  { label: "1:150", value: 150 },
  { label: "1:200", value: 200 },
  { label: "1:250", value: 250 },
  { label: "1:500", value: 500 },
];

export default function ScaleHelper({ onClose, onApply }) {
  const [tab,    setTab]    = useState("ratio");

  // Tab: ratio
  const [scaleRatio,    setScaleRatio]    = useState(100);
  const [customRatio,   setCustomRatio]   = useState("");
  const [measuredMm,    setMeasuredMm]    = useState("");

  // Tab: dim
  const [feet,   setFeet]   = useState("");
  const [inches, setInches] = useState("");

  // Tab: sqft
  const [sqft,   setSqft]   = useState("");

  // Tab: sqm
  const [sqm,    setSqm]    = useState("");

  // ── Computed values ─────────────────────────────────────────────────────────
  let meters = null;
  let note   = "";

  const activeRatio = customRatio ? parseFloat(customRatio) : scaleRatio;

  if (tab === "ratio" && measuredMm && activeRatio > 0) {
    const realMm = parseFloat(measuredMm) * activeRatio;
    meters = (realMm / 1000).toFixed(2);
    note   = `${measuredMm} mm × ${activeRatio} = ${realMm} mm = ${meters} m`;
  }

  if (tab === "dim" && feet) {
    meters = ((parseFloat(feet || 0) + parseFloat(inches || 0) / 12) * 0.3048).toFixed(2);
    note   = "Used directly as reference width";
  }

  if (tab === "sqft" && sqft) {
    // √(sqft) gives approximate side if square; we use it as reference width
    const side = Math.sqrt(parseFloat(sqft));
    meters = (side * 0.3048).toFixed(2);
    note   = `√${sqft} sq ft ≈ ${side.toFixed(1)} ft per side → ${meters} m`;
  }

  if (tab === "sqm" && sqm) {
    const side = Math.sqrt(parseFloat(sqm));
    meters = side.toFixed(2);
    note   = `√${sqm} m² ≈ ${side.toFixed(2)} m per side`;
  }

  const canApply = !!meters && parseFloat(meters) > 0;

  return (
    <div className="sh-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sh-box">
        <button className="sh-close" onClick={onClose}>×</button>
        <h2 className="sh-title">📏 Scale Helper</h2>
        <p className="sh-sub">Convert your plan dimensions to metres for accurate scaling.</p>

        {/* Tab switcher */}
        <div className="sh-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`sh-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Drawing Scale ── */}
        {tab === "ratio" && (
          <>
            <div className="sh-guide">
              <div className="sh-guide-step">How to use this</div>
              <p>Check the bottom of your blueprint for the scale notation, e.g. <strong>1:100</strong> or <strong>Scale 1:50</strong>. Then measure any wall or dimension on the <strong>printed plan</strong> with a ruler in millimetres and enter it below.</p>
            </div>

            <div className="sh-step2">Select the drawing scale</div>
            <div className="sh-scale-presets">
              {COMMON_SCALES.map((s) => (
                <button
                  key={s.value}
                  className={`sh-scale-btn${scaleRatio === s.value && !customRatio ? " active" : ""}`}
                  onClick={() => { setScaleRatio(s.value); setCustomRatio(""); }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="sh-step2" style={{ marginTop: 12 }}>Or enter a custom ratio</div>
            <div className="sh-row sh-row--single">
              <div>
                <label>Scale (e.g. 150 for 1:150)</label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={customRatio}
                  min="1"
                  onChange={(e) => setCustomRatio(e.target.value)}
                />
              </div>
            </div>

            <div className="sh-step2" style={{ marginTop: 12 }}>Measure a wall on the printed plan</div>
            <div className="sh-row sh-row--single">
              <div>
                <label>Measured length on paper (mm)</label>
                <input
                  type="number"
                  placeholder="e.g. 85"
                  value={measuredMm}
                  min="1"
                  onChange={(e) => setMeasuredMm(e.target.value)}
                />
              </div>
            </div>

            {meters && (
              <div className="sh-scale-result-hint">
                📐 {measuredMm} mm on paper × 1:{activeRatio} = <strong>{meters} m</strong> in real life
              </div>
            )}
          </>
        )}

        {/* ── Tab: Width/Length ── */}
        {tab === "dim" && (
          <>
            <div className="sh-guide">
              <div className="sh-guide-step">How to find it</div>
              <p>Look at the top or bottom edge of your blueprint for the total width (e.g. <strong>54' – 0"</strong>).</p>
              <div className="sh-diagram">
                <div className="sh-tick"/><div className="sh-line"/>
                <span className="sh-dim-text">54' – 0"</span>
                <div className="sh-line"/><div className="sh-tick"/>
              </div>
            </div>
            <div className="sh-step2">Enter the values</div>
            <div className="sh-row">
              <div>
                <label>Feet (')</label>
                <input type="number" placeholder="e.g. 54" value={feet}   onChange={(e) => setFeet(e.target.value)}   />
              </div>
              <div>
                <label>Inches (")</label>
                <input type="number" placeholder="e.g. 0"  value={inches} onChange={(e) => setInches(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* ── Tab: Square Footage ── */}
        {tab === "sqft" && (
          <>
            <div className="sh-guide">
              <div className="sh-guide-step">How to use this</div>
              <p>If you only know the total area (e.g. <strong>1,500 sq ft</strong>), enter it below. We calculate the equivalent side length and use it as the reference width.</p>
              <p className="sh-guide-note">⚠️ This assumes a roughly square plan. For rectangular plans, entering the actual width gives better accuracy.</p>
            </div>
            <div className="sh-step2">Enter total area</div>
            <div className="sh-row sh-row--single">
              <div>
                <label>Square Feet (sq ft)</label>
                <input type="number" placeholder="e.g. 1500" value={sqft} onChange={(e) => setSqft(e.target.value)} />
              </div>
            </div>
            <div className="sh-common-areas">
              <span className="sh-ca-label">Common sizes:</span>
              {[800, 1000, 1200, 1500, 2000, 2400].map((s) => (
                <button key={s} className="sh-ca-btn" onClick={() => setSqft(String(s))}>
                  {s.toLocaleString()}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Tab: Square Metres ── */}
        {tab === "sqm" && (
          <>
            <div className="sh-guide">
              <div className="sh-guide-step">How to use this</div>
              <p>If your plan is measured in <strong>square metres</strong> (e.g. 140 m²), enter the total floor area below.</p>
              <p className="sh-guide-note">⚠️ This assumes a roughly square plan. For rectangular plans, entering the actual width gives better accuracy.</p>
            </div>
            <div className="sh-step2">Enter total area</div>
            <div className="sh-row sh-row--single">
              <div>
                <label>Square Metres (m²)</label>
                <input type="number" placeholder="e.g. 140" value={sqm} onChange={(e) => setSqm(e.target.value)} />
              </div>
            </div>
            <div className="sh-common-areas">
              <span className="sh-ca-label">Common sizes:</span>
              {[75, 100, 120, 140, 160, 200].map((s) => (
                <button key={s} className="sh-ca-btn" onClick={() => setSqm(String(s))}>
                  {s} m²
                </button>
              ))}
            </div>
          </>
        )}

        {/* Result */}
        {meters && (
          <div className="sh-result">
            <div className="sh-result-main">✓ Reference width = <strong>{meters} m</strong></div>
            <div className="sh-result-note">{note}</div>
          </div>
        )}

        <button className="sh-apply" disabled={!canApply}
          onClick={() => { onApply(meters); onClose(); }}>
          Apply {meters ? `(${meters} m)` : ""}
        </button>
      </div>
    </div>
  );
}
