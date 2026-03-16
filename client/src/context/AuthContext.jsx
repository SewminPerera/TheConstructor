/**
 * context/AuthContext.jsx
 * -----------------------
 * Global authentication state.
 * Wraps the whole app so any component can call useAuth().
 *
 * Provides:
 *   user      — current user object or null
 *   loading   — true while checking localStorage on first load
 *   login()   — saves token + user, updates state
 *   logout()  — clears token + user
 */
import { createContext, useContext, useEffect, useState } from "react";
import { getMe } from "../services/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tc_token");
    if (!token) { setLoading(false); return; }
    getMe()
      .then((u) => setUser(u))
      .catch(() => localStorage.removeItem("tc_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("tc_token", token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("tc_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
