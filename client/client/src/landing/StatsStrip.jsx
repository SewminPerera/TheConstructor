import "./StatsStrip.css";
const STATS = [
  { num: "10,000+", label: "Projects Analyzed" },
  { num: "98%",     label: "Estimation Accuracy" },
  { num: "30s",     label: "Average Time to Estimate" },
];
export default function StatsStrip() {
  return (
    <div className="stats-strip">
      {STATS.map((s) => (
        <div className="stat-cell" key={s.label}>
          <div className="stat-num">{s.num}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
