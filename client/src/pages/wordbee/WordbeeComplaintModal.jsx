export default function WordbeeComplaintModal({
  open,
  title,
  kenmerk,
  complaintText,
  complaintDate,
  actionsTaken,
  resolvedDate,
  saving,
  onClose,
  onComplaintTextChange,
  onComplaintDateChange,
  onActionsTakenChange,
  onResolvedDateChange,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Sluiten
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="wordbee-complaint-grid">
            <div className="wordbee-complaint-field wordbee-complaint-field-wide">
              <label className="form-label" htmlFor="wordbee-complaint-kenmerk">Kenmerk</label>
              <input
                id="wordbee-complaint-kenmerk"
                className="form-control"
                value={kenmerk}
                readOnly
              />
            </div>
            <div className="wordbee-complaint-field">
              <label className="form-label" htmlFor="wordbee-complaint-date">Datum klacht</label>
              <input
                id="wordbee-complaint-date"
                className="form-control"
                type="date"
                value={complaintDate}
                onChange={(event) => onComplaintDateChange(event.target.value)}
              />
            </div>
            <div className="wordbee-complaint-field">
              <label className="form-label" htmlFor="wordbee-resolved-date">Datum opgelost</label>
              <input
                id="wordbee-resolved-date"
                className="form-control"
                type="date"
                value={resolvedDate}
                onChange={(event) => onResolvedDateChange(event.target.value)}
              />
            </div>
            <div className="wordbee-complaint-field wordbee-complaint-field-wide">
              <label className="form-label wordbee-complaint-label" htmlFor="wordbee-complaint-text">
                Klacht
              </label>
              <textarea
                id="wordbee-complaint-text"
                className="form-control"
                value={complaintText}
                onChange={(event) => onComplaintTextChange(event.target.value)}
                rows={5}
                autoFocus
                placeholder="Voeg hier de klacht toe. Laat alle velden leeg om de bestaande klacht te verwijderen."
              />
            </div>
            <div className="wordbee-complaint-field wordbee-complaint-field-wide">
              <label className="form-label wordbee-complaint-label" htmlFor="wordbee-actions-taken">
                Genomen acties
              </label>
              <textarea
                id="wordbee-actions-taken"
                className="form-control"
                value={actionsTaken}
                onChange={(event) => onActionsTakenChange(event.target.value)}
                rows={4}
                placeholder="Beschrijf welke acties zijn genomen."
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Annuleren
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
