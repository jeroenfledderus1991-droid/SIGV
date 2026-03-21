import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Accountbeheer from "./pages/Accountbeheer.jsx";
import Rollen from "./pages/Rollen.jsx";
import Stamgegevens from "./pages/Stamgegevens.jsx";
import FeatureFlags from "./pages/FeatureFlags.jsx";
import { SettingsView } from "./pages/Settings.jsx";
import Profile from "./pages/Profile.jsx";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import useThemeSettings from "./hooks/useThemeSettings.js";
import useAppSettings from "./hooks/useAppSettings.js";
import useAuth from "./hooks/useAuth.js";
import usePermissions from "./hooks/usePermissions.js";
import { loadBootstrap } from "./bootstrap.js";

const SIDEBAR_KEY = "sidebarCollapsed";

const navItems = [
  { to: "/", label: "Home", icon: "fa-home", end: true, permissions: ["/home*"] },
  { to: "/accounts", label: "Accountbeheer", icon: "fa-users-cog", permissions: ["/accounts*"] },
  { to: "/rollen", label: "Rolbeheer", icon: "fa-user-shield", permissions: ["/rollen*"] },
  { to: "/stamgegevens", label: "Stamgegevens", icon: "fa-database", permissions: ["/stamgegevens*"] },
  { to: "/feature-flags", label: "Feature flags", icon: "fa-flag", permissions: ["/feature-flags*"] },
];

function MicrosoftAuthBridge() {
  const location = useLocation();

  useEffect(() => {
    const query = location.search || "";
    window.location.replace(`/api/auth/microsoft/callback${query}`);
  }, [location.search]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Aanmelden afronden</h1>
          <p className="auth-subtitle">Even geduld, we ronden de Microsoft-login af...</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuPath, setProfileMenuPath] = useState(null);
  const [authRouteUser, setAuthRouteUser] = useState(null);
  const profileBtnRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const profileOpen = profileMenuPath === location.pathname;
  const isAuthRoute = useMemo(() => {
    const path = location.pathname;
    return (
      path === "/login" ||
      path === "/signin-oidc" ||
      path === "/register" ||
      path === "/wachtwoord-vergeten" ||
      path.startsWith("/reset-password")
    );
  }, [location.pathname]);
  const { user, loading: authLoading, logout, hasCache: authCached, ready: authReady } = useAuth(!isAuthRoute);
  const {
    settings,
    updateSettings,
    loading: themeLoading,
    hasCache: themeCached,
  } = useThemeSettings(!isAuthRoute && Boolean(user));
  const { settings: appSettings, loading: appSettingsLoading, hasCache: appSettingsCached } = useAppSettings();
  const { permissions, loading: permissionsLoading, hasCache: permissionsCached } = usePermissions(Boolean(user));

  const effectiveAllowedPaths = useMemo(() => {
    if (user?.is_super_admin && !permissions.allowedPaths.length) {
      return ["*"];
    }
    return permissions.allowedPaths || [];
  }, [permissions.allowedPaths, user?.is_super_admin]);

  const enableUserProfile = appSettings.featureFlags?.enableUserProfile !== false;
  const enableUserSettings = appSettings.featureFlags?.enableUserSettings !== false;
  const localAuthEnabled = appSettings.localAuthEnabled !== false;

  const isAllowedPath = useMemo(() => {
    const allowed = effectiveAllowedPaths;
    const allowAll = allowed.includes("*") || allowed.includes("ALL");
    const matches = (pattern, path) => {
      if (!pattern) return false;
      if (pattern === "*" || pattern === "ALL") return true;
      if (pattern.endsWith("*")) {
        const base = pattern.slice(0, -1);
        if (path === "/" && base === "/home") return true;
        return path.startsWith(base);
      }
      if (path === "/" && pattern === "/home") return true;
      return path === pattern;
    };
    return (path) => {
      if (!allowed.length) {
        return path === "/" || path.startsWith("/home");
      }
      if (allowAll) return true;
      return allowed.some((pattern) => matches(pattern, path));
    };
  }, [effectiveAllowedPaths]);

  const filteredNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (!enableUserSettings && item.to === "/settings") return false;
      return isAllowedPath(item.to);
    });
  }, [enableUserSettings, isAllowedPath]);

  const firstAllowedPath = filteredNavItems[0]?.to || "/";

  const pageMeta = useMemo(() => {
    const match = filteredNavItems.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    );
    if (!match && location.pathname.startsWith("/profiel")) {
      return {
        title: "Profiel",
        subtitle: "Beheer je persoonlijke gegevens en instellingen",
      };
    }
    const subtitleMap = {
      Home: "Overzicht en snelle toegang",
      Accountbeheer: "Beheer gebruikers en rollen",
      Rolbeheer: "Beheer rollen en permissies",
      Stamgegevens: "Beheer stamgegevens",
      "Feature flags": "Beheer feature toggles",
      Instellingen: "Theme & layout instellingen",
      Profiel: "Beheer je persoonlijke gegevens en instellingen",
    };
    return {
      title: match?.label || "Dashboard",
      subtitle: subtitleMap[match?.label || "Home"] || "Overzicht",
    };
  }, [filteredNavItems, location.pathname]);

  useEffect(() => {
    if (profileOpen && collapsed && profileBtnRef.current) {
      const rect = profileBtnRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        left: rect.right + 10,
        bottom: window.innerHeight - rect.bottom,
        minWidth: 180,
      });
    } else {
      setDropdownStyle({});
    }
  }, [profileOpen, collapsed]);

  useEffect(() => {
    let mounted = true;
    if (!isAuthRoute) {
      return () => {
        mounted = false;
      };
    }
    loadBootstrap({ force: true })
      .then((bootstrap) => {
        if (!mounted) return;
        if (bootstrap?.user) {
          setAuthRouteUser(bootstrap.user);
        } else {
          setAuthRouteUser(null);
        }
      })
      .catch(() => {
        if (mounted) setAuthRouteUser(null);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthRoute]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
  };

  const sidebarHeaderClass = appSettings.featureFlags?.sidebarHeaderWhite ? "header-white" : "header-theme";
  const sidebarClass = `sidebar ${collapsed ? "collapsed" : ""} ${
    mobileOpen ? "mobile-open" : ""
  } variant-${settings.sidebarVariant} ${sidebarHeaderClass}`;

  const appLoading =
    !isAuthRoute &&
    (!authReady ||
      (authLoading && !authCached) ||
      (appSettingsLoading && !appSettingsCached) ||
      (themeLoading && !themeCached) ||
      (permissionsLoading && !permissionsCached));

  if (!isAuthRoute && authReady && !appLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthRoute && (authRouteUser || (authReady && user))) {
    return <Navigate to="/" replace />;
  }

  if (!isAuthRoute && appLoading) {
    return <div className="auth-gate-blank" aria-hidden="true" />;
  }

  if (!isAuthRoute && !appLoading && effectiveAllowedPaths.length) {
    if (!isAllowedPath(location.pathname) && location.pathname !== firstAllowedPath) {
      return <Navigate to={firstAllowedPath} replace />;
    }
  }

  if (isAuthRoute) {
    return (
      <div className="auth-layout">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signin-oidc" element={<MicrosoftAuthBridge />} />
          <Route
            path="/register"
            element={localAuthEnabled ? <Register /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/wachtwoord-vergeten"
            element={localAuthEnabled ? <ForgotPassword /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/reset-password"
            element={localAuthEnabled ? <ResetPassword /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/reset-password/:token"
            element={localAuthEnabled ? <ResetPassword /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/reset-password/*"
            element={localAuthEnabled ? <ResetPassword /> : <Navigate to="/login" replace />}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className={sidebarClass}>
        <div className="sidebar-header">
          <div className="logo">
            <img className="logo-img" alt="Template" src="https://placehold.co/32x32" />
            <h3>Template UI</h3>
          </div>
          <button className="sidebar-toggle" onClick={toggleSidebar} type="button">
            <i className="fas fa-angle-left" />
          </button>
        </div>
        <div className="sidebar-menu">
          <ul className="menu-list">
            {filteredNavItems.map((item) => (
              <li key={item.to} className="menu-item">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? "menu-link active" : "menu-link")}
                  data-tooltip={item.label}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  onClick={() => setMobileOpen(false)}
                >
                  <i className={`fas ${item.icon}`} />
                  <span className="menu-text">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-footer">
          <div className="user-profile-container">
            <button
              ref={profileBtnRef}
              className="user-info"
              type="button"
              onClick={() =>
                setProfileMenuPath((openPath) => (openPath === location.pathname ? null : location.pathname))
              }
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <i className="fas fa-user-circle" />
              <div className="user-details">
                <span className="user-name">{user?.username || "Gebruiker"}</span>
                <span className="user-role">{user?.role || "Gebruiker"}</span>
              </div>
            </button>
            {profileOpen && (
              <div
                className="profile-dropdown"
                role="menu"
                style={collapsed ? dropdownStyle : undefined}
              >
                {enableUserProfile && isAllowedPath("/profiel") && (
                  <NavLink
                    to="/profiel"
                    className="profile-dropdown-item"
                    onClick={() => setProfileMenuPath(null)}
                  >
                    <i className="fas fa-id-badge" />
                    <span>Mijn profiel</span>
                  </NavLink>
                )}
                <button
                  type="button"
                  className="profile-dropdown-item logout-item"
                  onClick={() => {
                    setProfileMenuPath(null);
                    logout().finally(() => navigate("/login", { replace: true }));
                  }}
                >
                  <i className="fas fa-sign-out-alt" />
                  <span>Uitloggen</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={`main-content ${collapsed ? "expanded" : ""}`}>
        <header className="top-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <i className="fas fa-bars" />
            </button>
            <div className="header-left-content">
              <h1 className="page-title">{pageMeta.title}</h1>
              <p className="page-subtitle">{pageMeta.subtitle}</p>
            </div>
          </div>
          <div className="header-right">
            {enableUserSettings && isAllowedPath("/settings") && (
              <NavLink className="settings-icon" to="/settings" aria-label="Instellingen">
                <i className="fas fa-cog" />
              </NavLink>
            )}
          </div>
        </header>

        <div className="content-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/accounts"
              element={isAllowedPath("/accounts") ? <Accountbeheer /> : <Navigate to={firstAllowedPath} replace />}
            />
            <Route
              path="/rollen"
              element={isAllowedPath("/rollen") ? <Rollen /> : <Navigate to={firstAllowedPath} replace />}
            />
            <Route
              path="/stamgegevens"
              element={isAllowedPath("/stamgegevens") ? <Stamgegevens /> : <Navigate to={firstAllowedPath} replace />}
            />
            <Route
              path="/feature-flags"
              element={
                isAllowedPath("/feature-flags") ? <FeatureFlags /> : <Navigate to={firstAllowedPath} replace />
              }
            />
              {enableUserSettings ? (
                <Route
                  path="/settings"
                  element={
                    isAllowedPath("/settings") ? (
                      <SettingsView settings={settings} updateSettings={updateSettings} />
                    ) : (
                      <Navigate to={firstAllowedPath} replace />
                    )
                  }
                />
              ) : (
              <Route path="/settings" element={<Navigate to="/" replace />} />
            )}
            {enableUserProfile ? (
              <Route
                path="/profiel"
                element={isAllowedPath("/profiel") ? <Profile /> : <Navigate to={firstAllowedPath} replace />}
              />
            ) : (
              <Route path="/profiel" element={<Navigate to="/" replace />} />
            )}
          </Routes>
        </div>

        <footer className="app-footer">Template UI | Live DB ready</footer>
      </div>

      <div className={`sidebar-overlay ${mobileOpen ? "active" : ""}`} onClick={() => setMobileOpen(false)} />
    </div>
  );
}

export default App;
