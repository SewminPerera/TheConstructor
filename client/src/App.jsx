import { useState, useEffect } from "react";
import { useAuth }   from "./context/AuthContext";
import LandingPage   from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import LoginModal    from "./components/LoginModal";
import "./styles/tokens.css";
import "./styles/common.css";

export default function App() {
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Read page from sessionStorage so refresh keeps the user on the same page
  const [page, setPage] = useState(() => {
    return sessionStorage.getItem("tc_page") || "landing";
  });

  // Persist page to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem("tc_page", page);
  }, [page]);

  // If user logs out, always go back to landing
  useEffect(() => {
    if (!user && !loading) {
      setPage("landing");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <>
        <LandingPage onOpenLogin={() => setShowModal(true)} />
        {showModal && <LoginModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // Logged in but on landing page
  if (page === "landing") {
    return (
      <LandingPage
        onOpenLogin={() => setPage("dashboard")}
        onGoToDashboard={() => setPage("dashboard")}
        isLoggedIn={true}
      />
    );
  }

  // Logged in — show dashboard
  return <DashboardPage onGoHome={() => setPage("landing")} />;
}
