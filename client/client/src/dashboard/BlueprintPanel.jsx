import { useState } from "react";
import "./BlueprintPanel.css";

function ConfidenceBadge({ aiSummary }) {
  const confidence = aiSummary?.confidence;
  const src = aiSummary?.scale_source || "";

  // Use structured confidence data if available (v3+)
  if (confidence && confidence.score !== undefined) {
    const { score, label } = confidence;
    const cls = score >= 75 ? "conf-high" : score >= 55 ? "conf-good" : score >= 35 ? "conf-med" : "conf-low";
    const icon = score >= 55 ? "✓" : score >= 35 ? "~" : "⚠";
    return <span className={`conf-badge ${cls}`}>{icon} {label} · {score}%</span>;
  }

  // Fallback: text-match on scale_source (v2 compat)
  const l = src.toLowerCase();
  if (l.includes("dxf"))
    return <span className="conf-badge conf-high">✓ High · DXF Exact</span>;
  if (l.includes("manual"))
    return <span className="conf-badge conf-good">✓ Good · Manual Scale</span>;
  if (l.includes("door reference") || l.includes("auto-scale"))
    return <span className="conf-badge conf-med">~ Auto · Door Scale</span>;
  return <span className="conf-badge conf-low">⚠ Low · Assumed Scale</span>;
}

function AccuracyWarning({ length_m, scaleSource, onFix }) {
  const isAuto  = !scaleSource.toLowerCase().includes("dxf") &&
                  !scaleSource.toLowerCase().includes("manual") &&
                  !scaleSource.toLowerCase().includes("calibration");
  const tooHigh = parseFloat(length_m) > 120;
  if (!isAuto || !tooHigh) return null;
  return (
    <div className="bp-warning">
      <span className="bp-warning-icon">⚠️</span>
      <div>
        <strong>Wall length may be overestimated</strong>
        <p>Auto-scale detected {length_m}m which seems high. Use scale calibration
          or enter a reference width for accurate results.</p>
        <button className="bp-warning-fix" onClick={onFix}>
          Enter reference width →
        </button>
      </div>
    </div>
  );
}

function MetricsPanel({ metrics }) {
  if (!metrics) return null;
  return (
    <div className="bp-metrics">
      <div className="bp-metric">
        <span className="bp-metric-val">{metrics.raw_segments ?? "—"}</span>
        <span className="bp-metric-key">Raw Segments</span>
      </div>
      <div className="bp-metric">
        <span className="bp-metric-val">{metrics.merged_segments ?? "—"}</span>
        <span className="bp-metric-key">Merged Walls</span>
      </div>
      <div className="bp-metric">
        <span className="bp-metric-val">{metrics.scale_method ?? "—"}</span>
        <span className="bp-metric-key">Scale Method</span>
      </div>
      <div className="bp-metric">
        <span className="bp-metric-val">{metrics.image_size ?? "—"}</span>
        <span className="bp-metric-key">Image Size</span>
      </div>
    </div>
  );
}

export default function BlueprintPanel({
  aiSummary, previewUrl, wallLengthOverride, onWallLengthChange,
  onShowScaleHelper, onShowCalibrator,
}) {
  const { scale_source = "", doors = 0, windows = 0, length_m = 0, rooms, metrics } = aiSummary;
  const isDXF = scale_source.toLowerCase().includes("dxf");

  const effectiveLength = wallLengthOverride !== null && wallLengthOverride !== undefined
    ? wallLengthOverride
    : length_m;

  const [editing, setEditing]         = useState(false);
  const [draft,   setDraft]           = useState("");
  const [showMetrics, setShowMetrics] = useState(false);

  const startEdit = () => {
    setDraft(String(effectiveLength));
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const val = parseFloat(draft);
    if (!isNaN(val) && val > 0 && val !== parseFloat(effectiveLength)) {
      onWallLengthChange?.(val);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <div className="bp-panel">
      <h3 className="bp-panel-title">Blueprint Analysis</h3>
      <p className="bp-panel-sub">AI-detected geometry and structure</p>

      <div className="bp-badges">
        <ConfidenceBadge aiSummary={aiSummary} />
        {wallLengthOverride !== null && wallLengthOverride !== undefined && (
          <span className="conf-badge conf-override">✎ Length overridden</span>
        )}
        {!isDXF && onShowCalibrator && (
          <button className="conf-badge conf-calibrate" onClick={onShowCalibrator}>
            ⊕ Calibrate Scale
          </button>
        )}
      </div>

      <AccuracyWarning
        length_m={length_m}
        scaleSource={scale_source}
        onFix={onShowScaleHelper}
      />

      <div className="bp-frame">
        {previewUrl ? (
          <img src={previewUrl} alt="Blueprint" className="bp-img"
            onError={(e) => e.currentTarget.style.display = "none"} />
        ) : isDXF ? (
          <div className="bp-ph">
            <div className="bp-ph-icon">📄</div>
            <h4>DXF Processed</h4>
            <p>Geometry extracted from structural layers</p>
          </div>
        ) : (
          <div className="bp-ph">
            <div className="bp-ph-icon">🖼️</div>
            <h4>No preview available</h4>
            <p>Preview renders after upload</p>
          </div>
        )}
      </div>

      <div className="bp-detect-grid">
        <div className="bp-dc">
          <span className="bp-de">🚪</span>
          <span className="bp-dv">{doors}</span>
          <span className="bp-dk">Doors</span>
        </div>
        <div className="bp-dc">
          <span className="bp-de">🪟</span>
          <span className="bp-dv">{windows}</span>
          <span className="bp-dk">Windows</span>
        </div>

        {/* Editable wall length */}
        <div className="bp-dc highlight" onClick={!editing ? startEdit : undefined}
             title="Click to override wall length">
          <span className="bp-de">📏</span>
          {editing ? (
            <div className="bp-wall-edit" onClick={(e) => e.stopPropagation()}>
              <input
                className="bp-wall-input"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                type="number"
                min="1"
                step="0.1"
              />
              <span className="bp-wall-unit">m</span>
            </div>
          ) : (
            <span className="bp-dv bp-dv-editable">
              {effectiveLength}m
              <svg className="bp-edit-icon" width="11" height="11" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </span>
          )}
          <span className="bp-dk">
            Wall Length
            {!editing && <span className="bp-edit-hint"> · click to edit</span>}
          </span>
        </div>

        {/* Room detection */}
        {rooms && rooms.room_count > 0 && (
          <div className="bp-dc">
            <span className="bp-de">🏠</span>
            <span className="bp-dv">{rooms.room_count}</span>
            <span className="bp-dk">Rooms · {rooms.total_floor_area_m2} m²</span>
          </div>
        )}
      </div>

      {/* Expandable metrics */}
      {metrics && (
        <>
          <button
            className="bp-metrics-toggle"
            onClick={() => setShowMetrics((v) => !v)}
          >
            {showMetrics ? "Hide" : "Show"} analysis metrics {showMetrics ? "▲" : "▼"}
          </button>
          {showMetrics && <MetricsPanel metrics={metrics} />}
        </>
      )}
    </div>
  );
}
