import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { getUserProjects, deleteProject } from "../services/blueprintApi";
import ThemeToggle from "../components/ThemeToggle";
import "./ProjectsPage.css";

export default function ProjectsPage({ onGoHome }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [compareSet, setCompareSet] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await getUserProjects();
      setProjects(data || []);
    } catch (err) {
      showToast(err.message || "Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete project "${name || "Untitled"}"?`)) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p._id !== id));
      setCompareSet((prev) => prev.filter((cid) => cid !== id));
      showToast("Project deleted", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const toggleCompare = (id) => {
    setCompareSet((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-LK", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const formatCost = (q) => {
    const total = q?.costs_lkr?.GRAND_TOTAL;
    if (!total) return "—";
    return total;
  };

  const getScope = (q) => {
    if (!q) return "Foundation";
    return (q.schema_version ?? 2) >= 3 ? "Full Estimate" : "Foundation";
  };

  if (loading) {
    return (
      <div className="proj-shell">
        <div className="proj-loading"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="proj-shell">
      <nav className="dash-nav">
        <button className="dash-nav-logo" onClick={onGoHome}>
          <img src="/logo.jpg" alt="TheConstructor AI" className="dash-nav-logo-img" />
        </button>
        <div className="dash-nav-right">
          {user && (
            <span className="dash-nav-user">
              <span className="dash-nav-user-dot" />
              {user.name || user.email}
            </span>
          )}
          <button className="dash-nav-new" onClick={onGoHome}>← Dashboard</button>
          <ThemeToggle />
          <button className="dash-nav-logout" onClick={logout}>Logout</button>
        </div>
      </nav>

      <main className="proj-body">
        <div className="proj-header">
          <div>
            <h1 className="proj-title">My Projects</h1>
            <p className="proj-sub">{projects.length} saved estimation{projects.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="proj-actions">
            <div className="proj-view-toggle">
              <button
                className={`proj-view-btn${viewMode === "grid" ? " active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >⊞</button>
              <button
                className={`proj-view-btn${viewMode === "list" ? " active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
              >☰</button>
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="proj-empty">
            <div className="proj-empty-icon">📋</div>
            <h3>No projects yet</h3>
            <p>Upload a blueprint from the dashboard to create your first estimate.</p>
            <button className="btn-primary" onClick={onGoHome}>Go to Dashboard</button>
          </div>
        ) : (
          <div className={`proj-grid ${viewMode === "list" ? "proj-grid--list" : ""}`}>
            {projects.map((proj) => {
              const q = proj.quotation;
              const ai = proj.ai_summary || {};
              const isSelected = compareSet.includes(proj._id);
              return (
                <div
                  className={`proj-card${isSelected ? " proj-card--selected" : ""}`}
                  key={proj._id}
                >
                  <div className="proj-card-top">
                    <div className="proj-card-badges">
                      <span className="proj-card-badge proj-card-badge--scope">{getScope(q)}</span>
                      {ai.scale_source && (
                        <span className="proj-card-badge proj-card-badge--scale">{ai.scale_source}</span>
                      )}
                    </div>
                    <button
                      className="proj-card-delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(proj._id, proj.filename); }}
                      title="Delete project"
                    >×</button>
                  </div>

                  <h4 className="proj-card-name">{proj.filename || "Untitled"}</h4>
                  <span className="proj-card-date">{formatDate(proj.created_at)}</span>

                  <div className="proj-card-stats">
                    <div className="proj-card-stat">
                      <span className="proj-card-stat-val">{ai.length_m ?? "—"}m</span>
                      <span className="proj-card-stat-key">Wall Length</span>
                    </div>
                    <div className="proj-card-stat">
                      <span className="proj-card-stat-val">{ai.doors ?? 0}</span>
                      <span className="proj-card-stat-key">Doors</span>
                    </div>
                    <div className="proj-card-stat">
                      <span className="proj-card-stat-val">{ai.windows ?? 0}</span>
                      <span className="proj-card-stat-key">Windows</span>
                    </div>
                  </div>

                  <div className="proj-card-cost">
                    <span className="proj-card-cost-label">Estimated Cost</span>
                    <span className="proj-card-cost-val">{formatCost(q)}</span>
                  </div>

                  <div className="proj-card-actions">
                    <button
                      className={`proj-card-compare${isSelected ? " active" : ""}`}
                      onClick={(e) => { e.stopPropagation(); toggleCompare(proj._id); }}
                    >
                      {isSelected ? "✓ Selected" : "Compare"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {compareSet.length === 2 && !showCompare && (
          <div className="proj-compare-bar">
            <span>2 projects selected for comparison</span>
            <button className="btn-amber" onClick={() => setShowCompare(true)}>
              Compare Now →
            </button>
            <button className="proj-compare-clear" onClick={() => { setCompareSet([]); setShowCompare(false); }}>Clear</button>
          </div>
        )}

        {showCompare && compareSet.length === 2 && (
          <ComparePanel
            projects={projects.filter((p) => compareSet.includes(p._id))}
            onClose={() => { setShowCompare(false); setCompareSet([]); }}
          />
        )}
      </main>
    </div>
  );
}

/* ── Inline Compare Panel ── */
function ComparePanel({ projects, onClose }) {
  if (projects.length !== 2) return null;
  const [a, b] = projects;

  const _cost = (q, key) => {
    const val = q?.costs_lkr?.[key];
    if (!val) return 0;
    return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
  };
  const _fmt = (n) => `Rs. ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
  const _diff = (va, vb) => {
    if (va === 0 && vb === 0) return "—";
    const diff = vb - va;
    const pct = va > 0 ? ((diff / va) * 100).toFixed(1) : "—";
    const sign = diff > 0 ? "+" : "";
    return `${sign}${_fmt(diff)} (${sign}${pct}%)`;
  };

  const rows = [
    { label: "Wall Length",       valA: `${a.ai_summary?.length_m ?? 0} m`,  valB: `${b.ai_summary?.length_m ?? 0} m` },
    { label: "Doors",             valA: a.ai_summary?.doors ?? 0,             valB: b.ai_summary?.doors ?? 0 },
    { label: "Windows",           valA: a.ai_summary?.windows ?? 0,           valB: b.ai_summary?.windows ?? 0 },
    { label: "Rooms",             valA: a.ai_summary?.rooms?.room_count ?? 0, valB: b.ai_summary?.rooms?.room_count ?? 0 },
    { label: "Confidence",        valA: `${a.ai_summary?.confidence?.score ?? 0}%`, valB: `${b.ai_summary?.confidence?.score ?? 0}%` },
  ];

  const costRows = [
    { label: "Foundation",      key: "FOUNDATION_SUBTOTAL" },
    { label: "Superstructure",  key: "SUPERSTRUCTURE_SUBTOTAL" },
    { label: "Labour",          key: "LABOUR_SUBTOTAL" },
    { label: "Grand Total",     key: "GRAND_TOTAL" },
  ];

  return (
    <div className="compare-overlay">
      <div className="compare-panel">
        <div className="compare-header">
          <h2>Project Comparison</h2>
          <button className="compare-close" onClick={onClose}>× Close</button>
        </div>

        <table className="compare-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>{a.filename || "Project A"}</th>
              <th>{b.filename || "Project B"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="compare-label">{r.label}</td>
                <td>{r.valA}</td>
                <td>{r.valB}</td>
              </tr>
            ))}
            <tr className="compare-divider"><td colSpan={3}>Cost Comparison</td></tr>
            {costRows.map((r) => {
              const va = _cost(a.quotation, r.key);
              const vb = _cost(b.quotation, r.key);
              return (
                <tr key={r.key} className={r.key === "GRAND_TOTAL" ? "compare-total" : ""}>
                  <td className="compare-label">{r.label}</td>
                  <td>{_fmt(va)}</td>
                  <td>
                    {_fmt(vb)}
                    <span className={`compare-diff ${vb > va ? "compare-diff--up" : vb < va ? "compare-diff--down" : ""}`}>
                      {va > 0 || vb > 0 ? _diff(va, vb) : ""}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
