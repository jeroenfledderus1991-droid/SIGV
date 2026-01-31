import { useEffect, useState } from "react";
import { getJson } from "../api";

const DEFAULT_USER = {
  email: "admin@example.com",
  username: "Template Admin",
};

export default function Profile() {
  const [user, setUser] = useState(DEFAULT_USER);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getJson("/profile")
      .then((data) => {
        setUser({
          email: data.email || data.name || DEFAULT_USER.email,
          username: data.username || data.name || DEFAULT_USER.username,
        });
      })
      .catch(() => null);
  }, []);

  const showToast = (message, tone = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleSubmit = (event, message) => {
    event.preventDefault();
    showToast(message);
  };

  return (
    <div className="page-container profile-page">
      <div className="profile-card">
        <div className="profile-info">
          <div className="info-group">
            <label>Email</label>
            <p>{user.email}</p>
          </div>
          <div className="info-group">
            <label>Gebruikersnaam</label>
            <p>{user.username}</p>
          </div>
        </div>

        <hr />

        <div className="profile-section">
          <h5>
            <i className="fas fa-edit" /> Gebruikersnaam wijzigen
          </h5>
          <form onSubmit={(event) => handleSubmit(event, "Profiel bijgewerkt")}>
            <label className="form-label" htmlFor="profile-username">
              Gebruikersnaam
            </label>
            <input
              id="profile-username"
              className="form-control"
              type="text"
              defaultValue={user.username}
              minLength={3}
              required
            />
            <button type="submit" className="btn btn-primary">
              <i className="fas fa-save" /> Opslaan
            </button>
          </form>
        </div>

        <hr />

        <div className="profile-section">
          <h5>
            <i className="fas fa-envelope" /> Email wijzigen
          </h5>
          <div className="profile-alert">
            <i className="fas fa-exclamation-triangle" />
            <span>
              Let op: bij een emailwijziging wordt je automatisch uitgelogd.
            </span>
          </div>
          <form onSubmit={(event) => handleSubmit(event, "Email update verstuurd")}>
            <label className="form-label" htmlFor="email-password">
              Huidig wachtwoord
            </label>
            <input id="email-password" className="form-control" type="password" required />
            <label className="form-label" htmlFor="email-new">
              Nieuw emailadres
            </label>
            <input id="email-new" className="form-control" type="email" required />
            <button type="submit" className="btn btn-warning">
              <i className="fas fa-sync-alt" /> Email wijzigen
            </button>
          </form>
        </div>

        <hr />

        <div className="profile-section">
          <h5>
            <i className="fas fa-key" /> Wachtwoord wijzigen
          </h5>
          <form onSubmit={(event) => handleSubmit(event, "Wachtwoord aangepast")}>
            <label className="form-label" htmlFor="password-current">
              Huidig wachtwoord
            </label>
            <input id="password-current" className="form-control" type="password" required />
            <label className="form-label" htmlFor="password-new">
              Nieuw wachtwoord
            </label>
            <input id="password-new" className="form-control" type="password" minLength={8} required />
            <label className="form-label" htmlFor="password-confirm">
              Bevestig nieuw wachtwoord
            </label>
            <input id="password-confirm" className="form-control" type="password" minLength={8} required />
            <button type="submit" className="btn btn-primary">
              <i className="fas fa-lock" /> Wachtwoord wijzigen
            </button>
          </form>
        </div>
      </div>

      {toast && (
        <div className={`profile-toast ${toast.tone === "error" ? "error" : "success"}`}>
          <i className={`fas ${toast.tone === "error" ? "fa-times" : "fa-check"}`} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
