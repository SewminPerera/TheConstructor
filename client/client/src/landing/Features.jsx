import "./Features.css";

const FEATS = [
  { icon: "⚡", bg: "#FEF3C7", label: "Lightning Fast",       desc: "YOLO v8 wall detection + skeleton tracing. Results in under 30 seconds." },
  { icon: "📐", bg: "#EDE9FE", label: "DXF Precision Mode",   desc: "CAD file parsing extracts exact structural layer geometry — no guesswork." },
  { icon: "🇱🇰", bg: "#DCFCE7", label: "Local Market Prices", desc: "Calibrated to Sri Lankan suppliers — Tokyo Super, Lanwa, ICC and more." },
  { icon: "🔄", bg: "#FEE2E2", label: "Live Recalculation",   desc: "Change brand or thickness — the entire BOQ updates instantly." },
  { icon: "🔒", bg: "#DBEAFE", label: "Secure & Private",     desc: "Blueprints are deleted immediately after analysis. Your IP is safe." },
  { icon: "📊", bg: "#F3F4F6", label: "CIDA-Aligned Ratios",  desc: "Material constants follow CIDA strip footing guidelines." },
];

export default function Features() {
  return (
    <div className="feat-bg" id="features">
      <section className="feat-section">
        <div className="section-eyebrow feat-eyebrow">Features</div>
        <h2 className="section-title feat-title">Built for Sri Lankan construction professionals</h2>
        <p className="section-sub feat-sub">Every detail engineered for accuracy, speed, and local relevance.</p>
        <div className="feat-grid">
          {FEATS.map((f) => (
            <div className="feat-card" key={f.label}>
              <div className="feat-icon" style={{ background: f.bg }}>{f.icon}</div>
              <h3>{f.label}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
