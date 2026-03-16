import { useRef, useState } from "react";
import "./UploadView.css";
export default function UploadView({ loading, onFileSelect }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const handleDrop = (e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFileSelect(f); };
  return (
    <div className="uv-wrapper">
      <div className="uv-header"><h1 className="uv-title">Upload Your Blueprint</h1><p className="uv-sub">AI wall detection + DXF precision parsing — choose either format.</p></div>
      <div className={`uv-dropzone${drag ? " drag" : ""}${loading ? " busy" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={handleDrop} onClick={() => !loading && inputRef.current?.click()}>
        <div className="uv-dz-icon">{loading ? "⏳" : "📐"}</div>
        <h2>{loading ? "Analyzing your blueprint..." : "Drop your blueprint here"}</h2>
        <p>{loading ? "AI is measuring walls and calculating costs" : "or click to browse your files"}</p>
        {loading ? <div className="spinner" /> : <button className="uv-browse-btn" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>📎 Choose File</button>}
        <span className="uv-formats">JPG · PNG · DXF | Max 10 MB</span>
        <input ref={inputRef} type="file" accept="image/*,.dxf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
      </div>
      <div className="uv-cards">
        {[{ icon: "🤖", bg: "#FEF3C7", title: "AI Vision", desc: "YOLO detects walls, doors & windows" }, { icon: "📐", bg: "#DBEAFE", title: "DXF Precision", desc: "Exact structural layer parsing" }, { icon: "🇱🇰", bg: "#DCFCE7", title: "LKR Pricing", desc: "Sri Lankan supplier rates built in" }].map((c) => (
          <div className="uv-card" key={c.title}><div className="uv-card-icon" style={{ background: c.bg }}>{c.icon}</div><h4>{c.title}</h4><p>{c.desc}</p></div>
        ))}
      </div>

      <div className="uv-tips">
        <div className="uv-tips-header">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Tips for better results
        </div>
        <div className="uv-tips-grid">
          {[
            { icon: "✓", color: "#16A34A", bg: "#DCFCE7", title: "Use DXF for highest accuracy", desc: "CAD files give mathematically exact wall lengths — no image interpretation needed." },
            { icon: "✓", color: "#16A34A", bg: "#DCFCE7", title: "Upload clear JPEG or PNG", desc: "High-resolution scans (150+ DPI) with solid wall lines give the best AI detection results." },
            { icon: "✓", color: "#16A34A", bg: "#DCFCE7", title: "Include a dimension or scale bar", desc: "A visible measurement on the plan lets you set an accurate real-world scale in the next step." },
            { icon: "✓", color: "#16A34A", bg: "#DCFCE7", title: "One floor plan per upload", desc: "Upload ground floor and upper floor separately — mixed plans confuse wall detection." },
            { icon: "✗", color: "#DC2626", bg: "#FEE2E2", title: "Avoid rotated or skewed images", desc: "Keep the blueprint upright. Heavily rotated images reduce AI wall detection accuracy." },
            { icon: "✗", color: "#DC2626", bg: "#FEE2E2", title: "Avoid dashed or hatched walls", desc: "AI works best with solid, continuous wall lines. Heavily hatched fills may cause misdetection." },
          ].map((t) => (
            <div className="uv-tip" key={t.title}>
              <div className="uv-tip-icon" style={{ background: t.bg, color: t.color }}>{t.icon}</div>
              <div className="uv-tip-body">
                <div className="uv-tip-title">{t.title}</div>
                <div className="uv-tip-desc">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
