import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { postJson } from "../../api";
import { loadBootstrap } from "../../bootstrap";

export default function Login() {
  const [logoFailed, setLogoFailed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const appOrigin = import.meta.env.VITE_APP_ORIGIN || "";
  const navigate = useNavigate();

  const applyThemeSettings = (settings) => {
    if (!settings) return;
    const root = document.documentElement;
    const body = document.body;
    const theme = settings.theme || "light";
    const accentColor = settings.accentColor || "#2c5f41";
    const accentTextColor = settings.accentTextColor || "#ffffff";
    const gradientIntensity = Number.isFinite(settings.gradientIntensity) ? settings.gradientIntensity : 30;
    const hexToRgb = (hex) => {
      const clean = hex.replace("#", "");
      if (clean.length !== 6) return [44, 95, 65];
      return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
    };
    const mixWithBlack = (hex, intensity) => {
      const ratio = Math.min(100, Math.max(0, intensity)) / 100;
      const boosted = Math.pow(ratio, 0.65);
      const [r, g, b] = hexToRgb(hex);
      const mixed = [r, g, b].map((value) => Math.round(value * (1 - boosted)));
      return `rgb(${mixed.join(",")})`;
    };
    root.dataset.theme = theme;
    root.classList.remove("theme-light", "theme-dark", "theme-auto");
    root.classList.add(`theme-${theme}`);
    body.dataset.theme = theme;
    root.style.setProperty("--accent-color", accentColor);
    root.style.setProperty("--accent-text-color", accentTextColor);
    root.style.setProperty("--accent-color-rgb", hexToRgb(accentColor).join(","));
    root.style.setProperty("--accent-hover", `${accentColor}E6`);
    root.style.setProperty("--sidebar-accent-second", mixWithBlack(accentColor, gradientIntensity));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const identifier = formData.get("identifier");
    const password = formData.get("password");
    setError("");
    setLoading(true);
    try {
      const response = await postJson("/auth/login", { identifier, password });
      if (response?.themeSettings) {
        localStorage.setItem("themeSettings", JSON.stringify(response.themeSettings));
        applyThemeSettings(response.themeSettings);
      }
      const bootstrap = await loadBootstrap({ force: true }).catch(() => null);
      if (!bootstrap?.user) {
        throw new Error("Inloggen gelukt, maar sessie is nog niet beschikbaar. Probeer opnieuw.");
      }
      const target = appOrigin ? `${appOrigin}/` : "/";
      if (appOrigin && window.location.origin !== appOrigin) {
        window.location.assign(target);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.message || "Inloggen mislukt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className={`auth-logo ${logoFailed ? "auth-logo-circle" : "auth-logo-image"}`}>
            {!logoFailed ? (
              <img src="/expert_excel_logo.png" alt="Expert Excel" onError={() => setLogoFailed(true)} />
            ) : (
              <i className="fas fa-leaf" />
            )}
          </div>
          <h1 className="auth-title">Planningstool</h1>
          <p className="auth-subtitle">Meld je aan om door te gaan</p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error">
            <i className="fas fa-exclamation-circle" />
            <span>{error}</span>
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="auth-field">
            <label htmlFor="login-email">E-mailadres</label>
            <div className="auth-input-wrapper">
              <input
                id="login-email"
                name="identifier"
                type="email"
                className="auth-input"
                placeholder="Voer je e-mailadres in"
                required
              />
              <i className="fas fa-envelope auth-input-icon" />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Wachtwoord</label>
            <div className="auth-input-wrapper">
              <input
                id="login-password"
                name="password"
                type="password"
                className="auth-input"
                placeholder="Voer je wachtwoord in"
                required
              />
              <i className="fas fa-lock auth-input-icon" />
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Bezig..." : "Inloggen"} <i className="fas fa-arrow-right" />
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/register">Nog geen account? Registreer hier</Link>
          <Link to="/wachtwoord-vergeten">Wachtwoord vergeten?</Link>
        </div>
      </div>
    </div>
  );
}
