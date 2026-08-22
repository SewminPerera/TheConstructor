import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem("tc_theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("tc_theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      className="btn-ghost"
      onClick={() => setDark((d) => !d)}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ fontSize: "1.1rem", padding: "0.35rem 0.5rem" }}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
