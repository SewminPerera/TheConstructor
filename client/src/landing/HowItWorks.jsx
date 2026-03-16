import "./HowItWorks.css";

const STEPS = [
  { icon: "📤", bg: "#FEF3C7", label: "Upload Blueprint",  desc: "Drop your floor plan (JPG, PNG) or precision CAD file (.DXF) into the analyser." },
  { icon: "📏", bg: "#EDE9FE", label: "Set the Scale",     desc: "Enter the real-world width shown on the plan. ScaleHelper converts feet & inches instantly." },
  { icon: "💰", bg: "#DCFCE7", label: "Get Your Estimate", desc: "Receive a full Bill of Quantities — cement, sand, aggregate, and steel with current LKR prices." },
];

const TRUST = [
  { icon: "🎯", value: "95%",     label: "DXF Accuracy",        note: "Mathematically exact from CAD coordinates" },
  { icon: "⚡", value: "<30s",     label: "Analysis Time",        note: "YOLO v8 wall detection pipeline" },
  { icon: "🏗️", value: "1:2:4",   label: "CIDA Mix Ratio",       note: "Standard strip footing specification" },
  { icon: "🇱🇰", value: "4+",     label: "Local Suppliers",      note: "Tokyo Super, Lanwa, ICC, Maga & more" },
];

export default function HowItWorks({ onGetStarted }) {
  return (
    <section className="hiw-section" id="how-it-works">
      <div className="hiw-inner">
        <div className="section-eyebrow">How It Works</div>
        <h2 className="section-title">From blueprint to budget in three steps</h2>
        <p className="section-sub">No manual measuring. No spreadsheets. Just upload and get results.</p>

        <div className="hiw-grid">
          {STEPS.map((s, i) => (
            <div className="hiw-step" key={i}>
              <div className="hiw-num">0{i+1}</div>
              <div className="hiw-icon" style={{ background: s.bg }}>{s.icon}</div>
              <h3>{s.label}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Trust / accuracy strip */}
        <div className="hiw-trust">
          <div className="hiw-trust-label">Why engineers trust TheConstructor AI</div>
          <div className="hiw-trust-grid">
            {TRUST.map((t) => (
              <div className="hiw-trust-card" key={t.label}>
                <span className="hiw-trust-icon">{t.icon}</span>
                <span className="hiw-trust-value">{t.value}</span>
                <span className="hiw-trust-name">{t.label}</span>
                <span className="hiw-trust-note">{t.note}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
