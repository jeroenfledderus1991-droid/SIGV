import { useState } from "react";
import { Link } from "react-router-dom";
import { postJson } from "../../api";
import { BRAND_LOGO_SRC, BRAND_NAME } from "../../config/branding.js";

export default function ForgotPassword() {
  const [logoFailed, setLogoFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const identifier = formData.get("identifier");
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await postJson("/auth/forgot-password", { identifier });
      if (response?.resetToken) {
        setMessage(`Reset token (dev): ${response.resetToken}`);
      } else {
        setMessage("Als het account bestaat, ontvang je zo een reset link.");
      }
      form.reset();
    } catch (err) {
      setError(err.message || "Reset link versturen mislukt.");
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
              <img src={BRAND_LOGO_SRC} alt={BRAND_NAME} onError={() => setLogoFailed(true)} />
            ) : (
              <i className="fas fa-key" />
            )}
          </div>
          <h1 className="auth-title">Wachtwoord Vergeten</h1>
          <p className="auth-subtitle">
            Vul je e-mailadres in. Je ontvangt een reset link die 24 uur geldig is.
          </p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error">
            <i className="fas fa-exclamation-circle" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="auth-alert auth-alert-success">
            <i className="fas fa-check-circle" />
            <span>{message}</span>
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="auth-field">
            <label htmlFor="forgot-email">E-mailadres</label>
            <div className="auth-input-wrapper">
              <input
                id="forgot-email"
                name="identifier"
                type="email"
                className="auth-input"
                placeholder="naam@bedrijf.nl"
                required
              />
              <i className="fas fa-envelope auth-input-icon" />
            </div>
            <div className="auth-note">
              <i className="fas fa-shield-alt" />
              <span>Om veiligheidsredenen tonen we geen indicatie of een account bestaat.</span>
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Bezig..." : "Verstuur reset link"} <i className="fas fa-paper-plane" />
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
