import { useState, useEffect } from "react";
import "./LoadingView.css";
const STEPS = ["Reading file & detecting walls...","Measuring skeleton path lengths...","Scaling to real-world dimensions...","Calculating Bill of Quantities..."];
export default function LoadingView() {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep((s) => Math.min(s+1, STEPS.length-1)), 1800); return () => clearInterval(t); }, []);
  return (
    <div className="lv-screen">
      <div className="lv-spinner-wrap">
        <div className="lv-ring" />
        <div className="lv-ring-inner" />
      </div>
      <h2 className="lv-title">Analyzing Blueprint</h2>
      <p className="lv-sub">This usually takes 10 – 30 seconds</p>
      <div className="lv-steps">
        {STEPS.map((s, i) => (
          <div key={i} className={`lv-step${i < step ? " done" : i === step ? " active" : ""}`}>
            <span className="lv-step-icon">
              {i < step ? "✓" : i === step ? "▶" : i + 1}
            </span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
