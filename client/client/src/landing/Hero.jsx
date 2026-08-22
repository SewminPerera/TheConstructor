import "./Hero.css";

const BOQ_ROWS = [
  { label: "Cement",       val: "Rs. 74,862",  pct: 55, color: "#F59E0B" },
  { label: "River Sand",   val: "Rs. 52,588",  pct: 38, color: "#EAB308" },
  { label: "Tor Steel",    val: "Rs. 99,489",  pct: 73, color: "#F87171" },
  { label: "Rubble Stone", val: "Rs. 120,464", pct: 88, color: "#A78BFA" },
];

export default function Hero({ onGetStarted, isLoggedIn }) {
  return (
    <section className="hero">
      <div className="hero-inner">

        {/* ── Left ── */}
        <div className="hero-left">
          <div className="hero-badge">
            <span className="hero-badge-pulse" />
            AI-Powered &middot; Sri Lanka&apos;s First
          </div>

          <h1 className="hero-title">
            Foundation Cost<br />
            <span className="hero-title-em">Estimated</span><br />
            in Seconds
          </h1>

          <p className="hero-sub">
            Upload your house blueprint. AI reads the walls, you confirm the
            scale — get an accurate materials &amp; labour cost breakdown instantly.
          </p>

          <div className="hero-cta">
            <button className="hero-btn-primary" onClick={onGetStarted}>
              {isLoggedIn ? "Go to Dashboard" : "Get Free Estimate"}
              <span className="hero-btn-arrow">→</span>
            </button>
            <button
              className="hero-btn-ghost"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              See how it works
            </button>
          </div>

          <div className="hero-trust">
            {["JPG · PNG · DXF", "Sri Lankan LKR prices", "Free to use"].map((t) => (
              <span className="hero-trust-item" key={t}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="6.5" fill="#16A34A" fillOpacity="0.12"/>
                  <path d="M4 6.5l2 2 3.5-3.5" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right — app mockup ── */}
        <div className="hero-right">
          <div className="hero-mockup">

            {/* Window chrome */}
            <div className="hm-chrome">
              <div className="hm-dots">
                <span style={{ background: "#FF5F57" }} />
                <span style={{ background: "#FFBD2E" }} />
                <span style={{ background: "#28C840" }} />
              </div>
              <span className="hm-chrome-title">Foundation Estimate · TheConstructor AI</span>
            </div>

            {/* Title + badge */}
            <div className="hm-header">
              <div>
                <div className="hm-title">Bill of Quantities</div>
                <div className="hm-subtitle">Strip footing · CIDA 1:2:4 · 10% wastage</div>
              </div>
              <span className="hm-badge">Normal Soil</span>
            </div>

            {/* Detection stats */}
            <div className="hm-stats">
              <div className="hm-stat"><span className="hm-stat-val">9</span><span className="hm-stat-key">Doors</span></div>
              <div className="hm-stat-div" />
              <div className="hm-stat"><span className="hm-stat-val">3</span><span className="hm-stat-key">Windows</span></div>
              <div className="hm-stat-div" />
              <div className="hm-stat"><span className="hm-stat-val">78.3m</span><span className="hm-stat-key">Walls</span></div>
            </div>

            {/* Material rows with proportion bars */}
            <div className="hm-rows">
              {BOQ_ROWS.map((r) => (
                <div className="hm-row" key={r.label}>
                  <div className="hm-row-left">
                    <div className="hm-row-dot" style={{ background: r.color + "22", color: r.color }}>
                      {r.label[0]}
                    </div>
                    <div className="hm-row-info">
                      <div className="hm-row-label">{r.label}</div>
                      <div className="hm-row-bar">
                        <div className="hm-row-bar-fill" style={{ width: `${r.pct}%`, background: r.color }} />
                      </div>
                    </div>
                  </div>
                  <div className="hm-row-val">{r.val}</div>
                </div>
              ))}
            </div>

            {/* Grand total */}
            <div className="hm-total">
              <div>
                <div className="hm-total-label">GRAND TOTAL</div>
                <div className="hm-total-note">incl. wastage allowance</div>
              </div>
              <div className="hm-total-amount">Rs. 812,450</div>
            </div>

          </div>

          <div className="hero-mockup-tag">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Live calculation · updates as you type
          </div>
        </div>

      </div>
    </section>
  );
}
