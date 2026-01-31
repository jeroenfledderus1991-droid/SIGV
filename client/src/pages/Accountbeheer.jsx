import { useEffect, useMemo, useState } from "react";
import { getJson } from "../api";
import ClientTable from "../components/ClientTable.jsx";

export default function Accountbeheer() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getJson("/accounts/users").then(setUsers).catch(() => setUsers([]));
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
            searchEnabled
            enableColumnFilters
            exportEnabled
          />
        </div>
      </div>
    </div>
  );
}
