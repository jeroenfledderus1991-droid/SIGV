import { useState } from "react";
import { Link } from "react-router-dom";
import { postJson } from "../../api";

export default function Login() {
  const [logoFailed, setLogoFailed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const identifier = formData.get("identifier");
    const password = formData.get("password");
    setError("");
    setLoading(true);
    try {
      await postJson("/auth/login", { identifier, password });
      window.location.assign("/");
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
              <img src="/vite.svg" alt="Logo" onError={() => setLogoFailed(true)} />
            ) : (
              <i className="fas fa-leaf" />
            )}
          </div>
          <h1 className="auth-title">Planningstool</h1>
          <p className="auth-subtitle">Welkom terug</p>
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
