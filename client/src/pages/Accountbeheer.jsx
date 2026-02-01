import { useEffect, useMemo, useState } from "react";
import { deleteJson, getJson, postJson } from "../api";
import ClientTable from "../components/ClientTable.jsx";

export default function Accountbeheer() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modalState, setModalState] = useState({ open: false, user: null });

  useEffect(() => {
    getJson("/accounts/users").then(setUsers).catch(() => setUsers([]));
    getJson("/accounts/roles").then(setRoles).catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    window.editAccountRole = (id, rowData) => setModalState({ open: true, user: { id, ...rowData } });
    window.deleteAccount = (id) => handleDelete(id);
  }, []);

  const columns = useMemo(
    () => [
      { key: "username", label: "Gebruiker", sortable: true },
      { key: "email", label: "Email", sortable: true },
      { key: "role", label: "Rol", sortable: true },
      { key: "is_super_admin", label: "Super admin", sortable: true, type: "boolean" },
      { key: "last_login", label: "Laatste login", sortable: true, type: "datetime" },
    ],
    []
  );

  const refreshUsers = () => getJson("/accounts/users").then(setUsers).catch(() => setUsers([]));

  const handleDelete = async (id) => {
    if (!window.confirm("Weet je zeker dat je dit account wilt verwijderen?")) {
      return;
    }
    await deleteJson(`/accounts/users/${id}`);
    refreshUsers();
  };

  const handleSaveRole = async (event) => {
    event.preventDefault();
    if (!modalState.user?.id) return;
    const form = new FormData(event.target);
    const roleId = form.get("role_id") || null;
    await postJson(`/accounts/users/${modalState.user.id}/role`, {
      role_id: roleId ? Number(roleId) : null,
    });
    setModalState({ open: false, user: null });
    refreshUsers();
  };

  return (
    <div className="page-container">
      <div className="card">
        <div className="card-header">Accountbeheer</div>
        <div className="card-body">
          <ClientTable
            tableId="accountsTable"
            title="Gebruikers overzicht"
            columns={columns}
            data={users}
            actions={[
              { type: "edit", onClick: "editAccountRole" },
              { type: "delete", onClick: "deleteAccount" },
            ]}
            searchEnabled
            enableColumnFilters
            exportEnabled
          />
        </div>
      </div>

      {modalState.open && (
        <div className="modal-backdrop" onClick={() => setModalState({ open: false, user: null })}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Rol aanpassen</div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalState({ open: false, user: null })}
              >
                Sluiten
              </button>
            </div>
            <form onSubmit={handleSaveRole}>
              <label className="form-label">Gebruiker</label>
              <input className="form-control" value={modalState.user?.username || ""} disabled />
              <label className="form-label" style={{ marginTop: "12px" }}>
                Rol
              </label>
              <select className="form-select" name="role_id" defaultValue={modalState.user?.role_id || ""}>
                <option value="">Geen rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.naam}
                  </option>
                ))}
              </select>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalState({ open: false, user: null })}
                >
                  Annuleren
                </button>
                <button type="submit" className="btn btn-primary">
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
