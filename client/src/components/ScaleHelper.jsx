import { useState } from "react";
import "./ScaleHelper.css";

const TABS = [
  { id: "dim",  label: "Width / Length" },
  { id: "sqft", label: "Square Footage" },
  { id: "sqm",  label: "Square Metres"  },
];

export default function ScaleHelper({ onClose, onApply }) {
  const [tab,    setTab]    = useState("dim");

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
