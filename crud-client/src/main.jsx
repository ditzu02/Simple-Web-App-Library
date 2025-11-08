import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation
} from "react-router-dom";
import Authors from "./pages/Authors.jsx";
import Publishers from "./pages/Publishers.jsx";
import Books from "./pages/Books.jsx";
import {
  loginAdmin,
  logoutAdmin,
  setAdminToken,
  verifySession
} from "./api.js";
import { getErrorMessage } from "./hooks/useCrudList.js";
import "./index.css";

function Layout() {
  const location = useLocation();
  const [token, setToken] = useState(() => {
    const stored = window.localStorage.getItem("adminToken") || "";
    if (stored) {
      setAdminToken(stored);
    }
    return stored;
  });
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const isAdmin = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  const handleLogout = async ({ silent = false } = {}) => {
    if (authBusy && !silent) return;
    if (!silent) {
      setAuthBusy(true);
      setAuthError("");
    }
    try {
      if (token && !silent) {
        await logoutAdmin();
      }
    } catch (err) {
      if (!silent) {
        setAuthError(getErrorMessage(err, "Unable to log out"));
      }
    } finally {
      setToken("");
      if (!silent) {
        setAuthBusy(false);
      }
    }
  };

  useEffect(() => {
    if (token) {
      setAdminToken(token);
      verifySession().catch(() => {
        handleLogout({ silent: true });
      });
      window.localStorage.setItem("adminToken", token);
    } else {
      setAdminToken("");
      window.localStorage.removeItem("adminToken");
    }
  }, [token]);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const newToken = await loginAdmin(credentials);
      setToken(newToken);
      setCredentials({ username: "", password: "" });
    } catch (err) {
      setAuthError(getErrorMessage(err, "Invalid credentials"));
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <h1 className="app-title">Just a Simple Library</h1>

      <div className="admin-bar">
        {isAdmin ? (
          <div className="admin-status">
            <span className="badge">Administrator mode</span>
            <button
              type="button"
              onClick={() => handleLogout()}
              disabled={authBusy}
            >
              {authBusy ? "Logging out…" : "Log out"}
            </button>
          </div>
        ) : (
          <div className="login-wrapper">
            {showLoginForm ? (
              <form className="login-form" onSubmit={handleLogin}>
                <input
                  type="text"
                  placeholder="Username"
                  autoComplete="username"
                  value={credentials.username}
                  onChange={(e) =>
                    setCredentials((prev) => ({
                      ...prev,
                      username: e.target.value
                    }))
                  }
                  disabled={authBusy}
                />
                <input
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials((prev) => ({
                      ...prev,
                      password: e.target.value
                    }))
                  }
                  disabled={authBusy}
                />
                <div className="login-actions">
                  <button type="submit" disabled={authBusy}>
                    {authBusy ? "Signing in…" : "Login"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginForm(false);
                      setCredentials({ username: "", password: "" });
                      setAuthError("");
                    }}
                    disabled={authBusy}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowLoginForm(true);
                  setAuthError("");
                }}
                disabled={authBusy}
              >
                Login
              </button>
            )}
          </div>
        )}
        {authError && <div className="status error">{authError}</div>}
      </div>

      <nav>
        <NavLink
          to="/authors"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Authors
        </NavLink>
        <NavLink
          to="/publishers"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Publishers
        </NavLink>
        <NavLink
          to="/books"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Books
        </NavLink>
      </nav>
      <hr />
      <Routes>
        <Route path="/authors" element={<Authors isAdmin={isAdmin} />} />
        <Route path="/publishers" element={<Publishers isAdmin={isAdmin} />} />
        <Route path="/books" element={<Books isAdmin={isAdmin} />} />
        <Route path="*" element={<Navigate to="/authors" replace />} />
      </Routes>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Layout />
  </BrowserRouter>
);
