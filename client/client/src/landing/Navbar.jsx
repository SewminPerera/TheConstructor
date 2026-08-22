import { useState } from "react";
import "./Navbar.css";

export default function Navbar({ onGetStarted, isLoggedIn, onGoToDashboard }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <nav className="lnav">
      <a className="lnav-logo" href="/" onClick={(e) => e.preventDefault()} aria-label="TheConstructor Home">
        <img src="/logo.jpg" alt="TheConstructor AI" className="lnav-logo-img" />
      </a>

      <div className={`lnav-links${menuOpen ? " open" : ""}`}>
        <button onClick={() => scrollTo("how-it-works")}>How it works</button>
        <button onClick={() => scrollTo("features")}>Features</button>
        {isLoggedIn ? (
          <button className="lnav-cta" onClick={onGoToDashboard}>
            Go to Dashboard →
          </button>
        ) : (
          <button className="lnav-cta" onClick={onGetStarted}>
            Get Started →
          </button>
        )}
      </div>

      <button className="lnav-hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
        {menuOpen ? "✕" : "☰"}
      </button>
    </nav>
  );
}
