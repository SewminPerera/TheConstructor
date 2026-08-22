import { useState, useEffect } from "react";
import { useAuth }      from "./context/AuthContext";
import LandingPage      from "./pages/LandingPage";
import DashboardPage    from "./pages/DashboardPage";
import AdminPage        from "./pages/AdminPage";
import ProjectsPage     from "./pages/ProjectsPage";
import LoginModal       from "./components/LoginModal";
import { ToastProvider } from "./components/Toast";
import "./styles/tokens.css";
import "./styles/common.css";

function AppContent() {
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const [page, setPage] = useState(() => {
    return sessionStorage.getItem("tc_page") || "landing";
  });

  useEffect(() => {
    sessionStorage.setItem("tc_page", page);
  }, [page]);

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

  if (!user) {
    return (
      <>
        <LandingPage onOpenLogin={() => setShowModal(true)} />
        {showModal && <LoginModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  if (page === "landing") {
    return (
      <LandingPage
        onOpenLogin={() => setPage("dashboard")}
        onGoToDashboard={() => setPage("dashboard")}
        isLoggedIn={true}
      />
    );
  }

  if (page === "admin") {
    return <AdminPage onGoHome={() => setPage("dashboard")} />;
  }

  if (page === "projects") {
    return <ProjectsPage onGoHome={() => setPage("dashboard")} />;
  }

  return (
    <DashboardPage
      onGoHome={() => setPage("landing")}
      onGoAdmin={() => setPage("admin")}
      onGoProjects={() => setPage("projects")}
    />
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
