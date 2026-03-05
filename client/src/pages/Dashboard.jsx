export default function Dashboard() {
  return (
    <div className="page-container">
      <div className="card">
        <div className="card-body">
          <h2>Welkom terug</h2>
          <p className="text-secondary" style={{ marginTop: "6px" }}>
            Dit dashboard volgt de template-stijl en is klaar voor live data.
          </p>
        </div>
      </div>
      <div className="panel-grid">
        <div className="card">
          <div className="card-body">
            <h4>Rollen &amp; rechten</h4>
            <p className="text-secondary">
              Beheer rollen, volgorde en permissies in de matrix.
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h4>Stamgegevens</h4>
            <p className="text-secondary">
              Statussen beheren via standaard tabellen.
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h4>Thema instellingen</h4>
            <p className="text-secondary">
              Accentkleur, sidebar variant en weergavemodus centraal geregeld.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
