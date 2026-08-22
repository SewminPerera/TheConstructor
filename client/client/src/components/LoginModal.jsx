import { useState } from "react";
import { useAuth }  from "../context/AuthContext";
import { login as apiLogin, register as apiRegister } from "../services/authApi";
import "./LoginModal.css";

export default function LoginModal({ onClose }) {
  const { login } = useAuth();
  const [tab,     setTab]     = useState("login");
  const [form,    setForm]    = useState({ name: "", email: "", password: "", confirm: "" });
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setError("");
  };

  const switchTab = (t) => {
    setTab(t);
    setError("");
    setSuccess("");
    setForm({ name: "", email: "", password: "", confirm: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (tab === "signup") {
      if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
      if (form.password.length < 6)       { setError("Password must be at least 6 characters"); return; }
      if (!form.name.trim())              { setError("Please enter your name"); return; }
    }

    setLoading(true);
    try {
      let result;
      if (tab === "login") {
        result = await apiLogin(form.email.trim(), form.password);
      } else {
        result = await apiRegister(form.name.trim(), form.email.trim(), form.password);
      }
      login(result.token, result.user);
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lm-box">
        <button className="lm-close" onClick={onClose}>×</button>
        <div className="lm-logo">🏗 TheConstructor</div>
        <p className="lm-tagline">Estimate foundation costs in seconds</p>

        <div className="lm-tabs">
          <button className={`lm-tab${tab === "login"  ? " active" : ""}`} onClick={() => switchTab("login")}>Login</button>
          <button className={`lm-tab${tab === "signup" ? " active" : ""}`} onClick={() => switchTab("signup")}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit}>
          {tab === "signup" && (
            <div className="field-group">
              <label className="field-label">Full Name</label>
              <input className="field-input" placeholder="e.g. Kamal Perera" value={form.name} onChange={set("name")} required />
            </div>
          )}
          <div className="field-group">
            <label className="field-label">Email</label>
            <input type="email" className="field-input" placeholder="your@email.com" value={form.email} onChange={set("email")} required />
          </div>
          <div className="field-group">
            <label className="field-label">Password</label>
            <input type="password" className="field-input" placeholder="••••••••" value={form.password} onChange={set("password")} required />
          </div>
          {tab === "signup" && (
            <div className="field-group">
              <label className="field-label">Confirm Password</label>
              <input type="password" className="field-input" placeholder="••••••••" value={form.confirm} onChange={set("confirm")} required />
            </div>
          )}

          {error   && <p className="lm-error">{error}</p>}
          {success && <p className="lm-success">{success}</p>}

          <button type="submit" className="lm-submit" disabled={loading}>
            {loading ? "Please wait..." : tab === "login" ? "Login to Dashboard" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
