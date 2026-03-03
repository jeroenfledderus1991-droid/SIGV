import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { postJson } from "../../api";

export default function ResetPassword() {
  const [logoFailed, setLogoFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const params = useParams();

  const token = useMemo(() => {
    const queryToken = new URLSearchParams(location.search).get("token");
    if (queryToken) return queryToken;
    return params.token || location.pathname.split("/reset-password/")[1] || "";
  }, [location.pathname, location.search, params.token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = formData.get("password");
    const confirm = formData.get("password_confirm");
    setError("");
    setSuccess("");

    if (!token) {
      setError("Reset token ontbreekt.");
      return;
    }
    if (password !== confirm) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }

    setLoading(true);
    try {
      await postJson("/auth/reset-password", { token, password });
      setSuccess("Wachtwoord opgeslagen. Je kunt nu inloggen.");
      form.reset();
    } catch (err) {
      setError(err.message || "Wachtwoord resetten mislukt.");
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
              <i className="fas fa-lock-open" />
            )}
          </div>
          <h1 className="auth-title">Nieuw Wachtwoord</h1>
          <p className="auth-subtitle">Kies een sterk wachtwoord en bevestig het hieronder.</p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error">
            <i className="fas fa-exclamation-circle" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="auth-alert auth-alert-success">
            <i className="fas fa-check-circle" />
            <span>{success}</span>
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="auth-field">
            <label htmlFor="reset-password">Nieuw wachtwoord</label>
            <div className="auth-input-wrapper">
              <input
                id="reset-password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="auth-input"
                placeholder="Minimaal 8 karakters"
                minLength={8}
                required
              />
              <i className="fas fa-lock auth-input-icon" />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((value) => !value)}
                aria-label="Toon wachtwoord"
              >
                <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
            <div className="auth-note">
              <i className="fas fa-info-circle" />
              <span>Gebruik minimaal 8 karakters voor een veilig wachtwoord.</span>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reset-password-confirm">Bevestig wachtwoord</label>
            <div className="auth-input-wrapper">
              <input
                id="reset-password-confirm"
                name="password_confirm"
                type={showConfirm ? "text" : "password"}
                className="auth-input"
                placeholder="Herhaal je wachtwoord"
                minLength={8}
                required
              />
              <i className="fas fa-lock auth-input-icon" />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowConfirm((value) => !value)}
                aria-label="Toon bevestigingswachtwoord"
              >
                <i className={`fas ${showConfirm ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            <i className="fas fa-key" />
            {loading ? "Bezig..." : "Wachtwoord Opslaan"}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">
            <i className="fas fa-arrow-left" /> Terug naar inloggen
          </Link>
        </div>
      </div>
    </div>
  );
}
