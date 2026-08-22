import { useState, useEffect } from "react";
import { getProject } from "../services/blueprintApi";
import { useToast } from "../components/Toast";
import "./CompareView.css";

const parseAmount = (str) => parseFloat((str || "0").replace(/[^0-9.]/g, "")) || 0;

function CostRow({ label, costA, costB }) {
  const a = parseAmount(costA);
  const b = parseAmount(costB);
  if (a === 0 && b === 0) return null;
  const diff = b - a;
  const pct = a > 0 ? ((diff / a) * 100).toFixed(1) : "—";
  return (
    <div className="cmp-cost-row">
      <span className="cmp-cost-label">{label}</span>
      <span className="cmp-cost-val">{costA || "—"}</span>
      <span className="cmp-cost-val">{costB || "—"}</span>
      <span className={`cmp-cost-diff${diff > 0 ? " up" : diff < 0 ? " down" : ""}`}>
        {diff !== 0 ? `${diff > 0 ? "+" : ""}${pct}%` : "—"}
      </span>
    </div>
  );
}

export default function CompareView({ projectIds, onClose }) {
  const { showToast } = useToast();
  const [projects, setProjects] = useState([null, null]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectIds || projectIds.length < 2) return;
    Promise.all(projectIds.map((id) => getProject(id)))
      .then((results) => setProjects(results))
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [projectIds, showToast]);

  if (loading) {
    return (
      <div className="cmp-overlay">
        <div className="cmp-modal">
          <div className="cmp-loading"><div className="spinner" /></div>
        </div>
      </div>
    );
  }

  const [pA, pB] = projects;
  if (!pA || !pB) {
    return (
      <div className="cmp-overlay">
        <div className="cmp-modal">
          <p>Could not load one or both projects.</p>
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const qA = pA.quotation || {};
  const qB = pB.quotation || {};
  const cA = qA.costs_lkr || {};
  const cB = qB.costs_lkr || {};
  const aiA = pA.ai_summary || {};
  const aiB = pB.ai_summary || {};

  const costKeys = [
    ["Cement", "cement"],
    ["Sand", "sand"],
    ["Metal / Aggregate", "metal"],
    ["Tor Steel", "steel"],
    ["Rubble Stone", "rubble_masonry"],
    ["Wall Masonry", "wall_masonry"],
    ["Lintels", "lintels"],
    ["Plastering", "plastering"],
    ["Flooring", "flooring"],
    ["Roofing", "roofing"],
    ["Painting", "painting"],
    ["Labour", "labour"],
  ];

  return (
    <div className="cmp-overlay" onClick={onClose}>
      <div className="cmp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmp-header">
          <h2 className="cmp-title">Project Comparison</h2>
          <button className="cmp-close" onClick={onClose}>×</button>
        </div>

        {/* Project names */}
        <div className="cmp-names">
          <div className="cmp-name-col" />
          <div className="cmp-name-col cmp-name-a">{pA.filename || "Project A"}</div>
          <div className="cmp-name-col cmp-name-b">{pB.filename || "Project B"}</div>
          <div className="cmp-name-col cmp-name-diff">Difference</div>
        </div>

        {/* Blueprint stats */}
        <div className="cmp-section-label">Blueprint Analysis</div>
        <div className="cmp-stat-grid">
          <div className="cmp-stat-row">
            <span>Wall Length</span>
            <span>{aiA.length_m ?? "—"} m</span>
            <span>{aiB.length_m ?? "—"} m</span>
          </div>
          <div className="cmp-stat-row">
            <span>Doors</span>
            <span>{aiA.doors ?? 0}</span>
            <span>{aiB.doors ?? 0}</span>
          </div>
          <div className="cmp-stat-row">
            <span>Windows</span>
            <span>{aiA.windows ?? 0}</span>
            <span>{aiB.windows ?? 0}</span>
          </div>
          <div className="cmp-stat-row">
            <span>Scale Source</span>
            <span>{aiA.scale_source || "—"}</span>
            <span>{aiB.scale_source || "—"}</span>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="cmp-section-label">Cost Breakdown</div>
        <div className="cmp-cost-grid">
          {costKeys.map(([label, key]) => (
            <CostRow key={key} label={label} costA={cA[key]} costB={cB[key]} />
          ))}
        </div>

        {/* Totals */}
        <div className="cmp-totals">
          <CostRow label="GRAND TOTAL" costA={cA.GRAND_TOTAL} costB={cB.GRAND_TOTAL} />
        </div>
      </div>
    </div>
  );
}
