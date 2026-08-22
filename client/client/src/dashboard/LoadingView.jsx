import { useState, useEffect } from "react";
import "./LoadingView.css";

const STEPS = [
  { label: "Reading file & detecting walls...",        duration: 2000 },
  { label: "Measuring skeleton path lengths...",       duration: 3000 },
  { label: "Scaling to real-world dimensions...",      duration: 2500 },
  { label: "Detecting rooms & openings...",            duration: 2000 },
  { label: "Calculating Bill of Quantities...",        duration: 1500 },
];

export default function LoadingView() {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const totalDuration = STEPS.reduce((sum, s) => sum + s.duration, 0);
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 50;
      const pct = Math.min((elapsed / totalDuration) * 100, 95);
      setProgress(pct);

      let cumulative = 0;
      for (let i = 0; i < STEPS.length; i++) {
        cumulative += STEPS[i].duration;
        if (elapsed < cumulative) { setStep(i); break; }
        if (i === STEPS.length - 1) setStep(i);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="lv-screen">
      <div className="lv-spinner-wrap">
        <div className="lv-ring" />
        <div className="lv-ring-inner" />
      </div>

      <h2 className="lv-title">Analyzing Blueprint</h2>
      <p className="lv-sub">This usually takes 10 – 30 seconds</p>

      {/* Progress bar */}
      <div className="lv-progress-track">
        <div className="lv-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="lv-progress-pct">{Math.round(progress)}%</span>

      <div className="lv-steps">
        {STEPS.map((s, i) => (
          <div key={i} className={`lv-step${i < step ? " done" : i === step ? " active" : ""}`}>
            <span className="lv-step-icon">
              {i < step ? "✓" : i === step ? "▶" : i + 1}
            </span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
