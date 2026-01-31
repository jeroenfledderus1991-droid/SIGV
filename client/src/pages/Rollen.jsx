import { useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "../api";

const DEFAULT_PAGE_SIZE = 25;

export default function Rollen() {
  const [roles, setRoles] = useState([]);
  const [pagePatterns, setPagePatterns] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [newRole, setNewRole] = useState("");
  const [dragIndex, setDragIndex] = useState(null);

  const fetchMatrix = () => {
    getJson("/roles/matrix").then((data) => {
      setRoles(data.roles || []);
      setPagePatterns(data.page_patterns || []);
      setPermissions(data.permissions || {});
    });
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const filteredPatterns = useMemo(() => {
    if (!search.trim()) return pagePatterns;
    const q = search.toLowerCase();
    return pagePatterns.filter((pattern) => pattern.name.toLowerCase().includes(q));
  }, [pagePatterns, search]);

  const visiblePatterns = useMemo(() => {
    if (pageSize === "all") return filteredPatterns;
    return filteredPatterns.slice(0, Number(pageSize));
  }, [filteredPatterns, pageSize]);

  const handleToggle = (roleId, pattern) => {
    setPermissions((prev) => {
      const rolePerms = new Set(prev[roleId] || []);
      if (rolePerms.has(pattern)) {
        rolePerms.delete(pattern);
      } else {
        rolePerms.add(pattern);
      }
      return { ...prev, [roleId]: Array.from(rolePerms) };
    });
  };

  const handleSave = async () => {
    await postJson("/roles/permissions", { permissions });
  };

  const handleAddRole = async (event) => {
    event.preventDefault();
    if (!newRole.trim()) return;
    await postJson("/roles", { name: newRole.trim() });
    setNewRole("");
    fetchMatrix();
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm("Weet je zeker dat je deze rol wilt verwijderen?")) {
      return;
    }
    await postJson(`/roles/${roleId}/delete`, {});
    fetchMatrix();
  };

  const handleDragStart = (index) => setDragIndex(index);

  const handleDrop = async (index) => {
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...roles];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setRoles(updated);
    setDragIndex(null);
    await postJson("/roles/order", { role_orders: updated.map((role) => role.id) });
  };

  return (
    <div className="page-container">
      <div className="card">
        <div className="card-header">Rolbeheer</div>
        <div className="card-body">
          <form className="inline-form" onSubmit={handleAddRole}>
            <input
              className="form-control"
              placeholder="Nieuwe rol.."
              value={newRole}
              onChange={(event) => setNewRole(event.target.value)}
            />
            <button className="btn btn-success btn-sm" type="submit">
              <i className="fas fa-plus" /> Toevoegen
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <i className="fas fa-user-shield" style={{ marginRight: "8px" }} />
          Rolpermissies Matrix
        </div>
        <div className="role-matrix-controls">
          <div className="role-search">
            <i className="fas fa-search" />
            <input
              className="form-control"
              placeholder="Zoek in onderdelen..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="inline-form">
            <label className="form-label" style={{ marginBottom: 0 }}>
              Toon:
            </label>
            <select
              className="form-select form-select-sm"
              value={pageSize}
              onChange={(event) =>
                setPageSize(event.target.value === "all" ? "all" : Number(event.target.value))
              }
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">Alle</option>
            </select>
          </div>
          <div className="role-pagination">
            Toont {visiblePatterns.length} van {filteredPatterns.length} onderdelen
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" id="rolesTable">
            <thead>
              <tr>
                <th>Onderdeel</th>
                {roles.map((role, index) => (
                  <th
                    key={role.id}
                    className="role-col draggable-header"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(index)}
                  >
                    <div className="role-header-inner">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDeleteRole(role.id)}
                      >
                        <i className="fas fa-trash" />
                      </button>
                      <span className="vertical-text role-name">{role.naam}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePatterns.map((pattern) => (
                <tr key={pattern.pattern}>
                  <td>
                    {pattern.name} <span className="text-muted">({pattern.pattern})</span>
                  </td>
                  {roles.map((role) => (
                    <td key={`${role.id}-${pattern.pattern}`} className="text-center">
                      <input
                        type="checkbox"
                        checked={(permissions[role.id] || []).includes(pattern.pattern)}
                        onChange={() => handleToggle(role.id, pattern.pattern)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card-body table-actions" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" type="button" onClick={fetchMatrix}>
            <i className="fas fa-undo" /> Reset
          </button>
          <button className="btn btn-primary" type="button" onClick={handleSave}>
            <i className="fas fa-save" /> Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
