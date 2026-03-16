import { useAuth } from "../context/AuthContext";
import "./DashNav.css";

export default function DashNav({ hasResults, onNewProject, onGoHome }) {
  const { user, logout } = useAuth();

  return (
    <nav className="dash-nav">
      <button className="dash-nav-logo" onClick={onGoHome} aria-label="Go to home">
        <img src="/logo.jpg" alt="TheConstructor AI" className="dash-nav-logo-img" />
      </button>

      <div className="dash-nav-right">
        {user && (
          <span className="dash-nav-user">
            <span className="dash-nav-user-dot" />
            {user.name || user.email}
          </span>
        )}
        {hasResults && (
          <button className="dash-nav-new" onClick={onNewProject}>+ New Project</button>
        )}
        <button className="dash-nav-logout" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}
