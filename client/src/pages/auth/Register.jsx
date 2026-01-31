import { useState } from "react";
import { Link } from "react-router-dom";
import { postJson } from "../../api";

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = formData.get("username");
    const email = formData.get("email");
    const password = formData.get("password");
    const passwordConfirm = formData.get("password_confirm");

    setError("");
    setSuccess("");

    if (password !== passwordConfirm) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }

    setLoading(true);
    try {
      await postJson("/auth/register", { username, email, password });
      setSuccess("Account aangemaakt. Je kunt nu inloggen.");
      form.reset();
    } catch (err) {
      setError(err.message || "Registreren mislukt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="auth-logo auth-logo-circle">
            <i className="fas fa-user-plus" />
          </div>
          <h1 className="auth-title">Account Aanmaken</h1>
          <p className="auth-subtitle">Registreer voor Expert Excel</p>
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
            <label htmlFor="register-username">Gebruikersnaam</label>
            <div className="auth-input-wrapper">
              <input
                id="register-username"
                name="username"
                type="text"
                className="auth-input"
                placeholder="Kies een gebruikersnaam"
                minLength={3}
                required
              />
              <i className="fas fa-user auth-input-icon" />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">E-mailadres</label>
            <div className="auth-input-wrapper">
              <input
                id="register-email"
                name="email"
                type="email"
                className="auth-input"
                placeholder="naam@bedrijf.nl"
                required
              />
              <i className="fas fa-envelope auth-input-icon" />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">Wachtwoord</label>
            <div className="auth-input-wrapper">
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="auth-input"
                placeholder="Minimaal 6 tekens"
                minLength={6}
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
          </div>

          <div className="auth-field">
            <label htmlFor="register-password-confirm">Bevestig wachtwoord</label>
            <div className="auth-input-wrapper">
              <input
                id="register-password-confirm"
                name="password_confirm"
                type={showConfirm ? "text" : "password"}
                className="auth-input"
                placeholder="Herhaal je wachtwoord"
                minLength={6}
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
            {loading ? "Bezig..." : "Account aanmaken"} <i className="fas fa-arrow-right" />
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
