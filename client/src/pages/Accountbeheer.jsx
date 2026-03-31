import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteJson, getJson, postJson } from "../api";
import ClientTable from "../components/ClientTable.jsx";

function normalizeAccountUser(user) {
  const rawLastLogin = user?.last_login;
  if (rawLastLogin === null || rawLastLogin === undefined || rawLastLogin === "") {
    return user;
  }

  const parsedDate = new Date(rawLastLogin);
  if (Number.isFinite(parsedDate.getTime()) && parsedDate.getFullYear() <= 1900) {
    return { ...user, last_login: null };
  }

  if (String(rawLastLogin).startsWith("1900-01-01")) {
    return { ...user, last_login: null };
  }

  return user;
}

function normalizeAccountUsers(users) {
  return Array.isArray(users) ? users.map((user) => normalizeAccountUser(user)) : [];
}

export default function Accountbeheer() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modalState, setModalState] = useState({ open: false, user: null });
  const [canManageSuperAdmin, setCanManageSuperAdmin] = useState(false);

  useEffect(() => {
    getJson("/accounts/users")
      .then((data) => setUsers(normalizeAccountUsers(data)))
      .catch(() => setUsers([]));
    getJson("/accounts/roles").then(setRoles).catch(() => setRoles([]));
    getJson("/auth/me")
      .then((me) => setCanManageSuperAdmin(Boolean(me?.is_super_admin)))
      .catch(() => setCanManageSuperAdmin(false));
  }, []);

  const columns = useMemo(
    () => [
      { key: "username", label: "Gebruiker", sortable: true, widthWeight: 1.1, minWidth: "170px" },
      { key: "email", label: "Email", sortable: true, widthWeight: 1.6, minWidth: "230px" },
      { key: "role", label: "Rol", sortable: true, widthWeight: 0.9, minWidth: "150px" },
      { key: "last_login", label: "Laatste login", sortable: true, type: "datetime", widthWeight: 1.2, minWidth: "190px" },
    ],
    []
  );

  const refreshUsers = useCallback(
    () =>
      getJson("/accounts/users")
        .then((data) => setUsers(normalizeAccountUsers(data)))
        .catch(() => setUsers([])),
    []
  );

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Weet je zeker dat je dit account wilt verwijderen?")) {
      return;
    }
    await deleteJson(`/accounts/users/${id}`);
    refreshUsers();
  }, [refreshUsers]);

  useEffect(() => {
    window.editAccountRole = (id, rowData) => setModalState({ open: true, user: { id, ...rowData } });
    window.deleteAccount = (id) => handleDelete(id);
    return () => {
      delete window.editAccountRole;
      delete window.deleteAccount;
    };
  }, [handleDelete]);

  const handleSaveRole = async (event) => {
    event.preventDefault();
    if (!modalState.user?.id) return;
    const form = new FormData(event.target);
    const roleId = form.get("role_id") || null;
    const isSuperAdmin = form.get("is_super_admin") === "on";
    await postJson(`/accounts/users/${modalState.user.id}/role`, {
      role_id: roleId ? Number(roleId) : null,
      ...(canManageSuperAdmin ? { is_super_admin: isSuperAdmin } : {}),
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
            enableRowClickAction
            rowClickActionType="edit"
            horizontalScroll="auto"
            actionsColumnWidth={112}
            enableColumnCustomization
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
              {canManageSuperAdmin && (
                <>
                  <label className="form-label" style={{ marginTop: "12px" }}>
                    Super admin toegang
                  </label>
                  <div className="form-check">
                    <input
                      id="is-super-admin"
                      className="form-check-input"
                      type="checkbox"
                      name="is_super_admin"
                      defaultChecked={Boolean(modalState.user?.is_super_admin)}
                    />
                    <label className="form-check-label" htmlFor="is-super-admin">
                      Toegang tot alle pagina's
                    </label>
                  </div>
                </>
              )}
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
