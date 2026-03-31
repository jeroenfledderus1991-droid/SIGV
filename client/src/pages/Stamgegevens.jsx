import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteJson, getJson, postJson, putJson } from "../api";
import ClientTable from "../components/ClientTable.jsx";
import ClientTableEditable from "../components/ClientTableEditable.jsx";

const TABS = [
  { key: "statussen", label: "Statussen", icon: "fa-tags" },
  { key: "editable_test", label: "Editable test", icon: "fa-flask" },
];

function Modal({ title, open, onClose, onSubmit, children, submitLabel }) {
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
          {children}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuleren
            </button>
            <button type="submit" className="btn btn-primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Stamgegevens() {
  const [activeTab, setActiveTab] = useState(() => {
    const stored = localStorage.getItem("stamgegevens_tab");
    if (stored && TABS.some((tab) => tab.key === stored)) {
      return stored;
    }
    return "statussen";
  });
  const [statussen, setStatussen] = useState([]);
  const [editableTestRows, setEditableTestRows] = useState([
    {
      id: 1,
      code: "ART-001",
      omschrijving: "Testregel A",
      categorie: "Algemeen",
      prijs: 12.5,
      actief: 1,
      laatst_bijgewerkt: "2026-03-25T10:30:00",
    },
    {
      id: 2,
      code: "ART-002",
      omschrijving: "Testregel B",
      categorie: "Services",
      prijs: 8.0,
      actief: 0,
      laatst_bijgewerkt: "2026-03-25T11:45:00",
    },
    {
      id: 3,
      code: "ART-003",
      omschrijving: "Testregel C",
      categorie: "Product",
      prijs: 19.95,
      actief: 1,
      laatst_bijgewerkt: "2026-03-26T08:10:00",
    },
  ]);
  const [modalState, setModalState] = useState({ type: null, data: null });
  const modalLabel = useMemo(() => {
    if (!modalState.type) return "";
    return { statussen: "status" }[modalState.type] || "";
  }, [modalState.type]);

  useEffect(() => {
    localStorage.setItem("stamgegevens_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    getJson("/stamgegevens/statussen").then(setStatussen).catch(() => setStatussen([]));
  }, []);

  const statussenColumns = useMemo(
    () => [
      { key: "status", label: "Status", sortable: true, widthWeight: 2, minWidth: "220px" },
      { key: "volgorde", label: "Volgorde", sortable: true, widthWeight: 1, minWidth: "130px" },
    ],
    []
  );

  const editableTestColumns = useMemo(
    () => [
      { key: "id", label: "ID", sortable: true, widthWeight: 0.5, minWidth: "80px", editable: false },
      { key: "code", label: "Code", sortable: true, widthWeight: 0.8, minWidth: "130px" },
      { key: "omschrijving", label: "Omschrijving", sortable: true, widthWeight: 1.6, minWidth: "220px" },
      { key: "categorie", label: "Categorie", sortable: true, widthWeight: 1.1, minWidth: "160px" },
      { key: "prijs", label: "Prijs", type: "currency", sortable: true, widthWeight: 0.8, minWidth: "130px" },
      { key: "actief", label: "Actief", type: "boolean", sortable: true, widthWeight: 0.8, minWidth: "120px" },
      {
        key: "laatst_bijgewerkt",
        label: "Laatst bijgewerkt",
        type: "datetime",
        sortable: true,
        widthWeight: 1.2,
        minWidth: "190px",
        editable: false,
      },
    ],
    []
  );

  const refreshType = useCallback((type) => {
    if (type === "statussen") {
      return getJson("/stamgegevens/statussen").then(setStatussen).catch(() => setStatussen([]));
    }
    return Promise.resolve();
  }, []);

  const handleDelete = useCallback(async (type, id) => {
    if (!window.confirm("Weet je zeker dat je dit item wilt verwijderen?")) {
      return;
    }
    await deleteJson(`/stamgegevens/${type}/${id}`);
    refreshType(type);
  }, [refreshType]);

  useEffect(() => {
    window.editStatus = (id, rowData) => setModalState({ type: "statussen", data: { id, ...rowData } });
    window.deleteStatus = (id) => handleDelete("statussen", id);
    window.deleteEditableTestRow = (id) => {
      setEditableTestRows((previousRows) => previousRows.filter((row) => Number(row.id) !== Number(id)));
    };
    return () => {
      delete window.editStatus;
      delete window.deleteStatus;
      delete window.deleteEditableTestRow;
    };
  }, [handleDelete]);

  const handleEditableTestDataChange = useCallback((event) => {
    if (!event || !event.row) return;
    if (event.type === "row_add") {
      setEditableTestRows((previousRows) => [...previousRows, event.row]);
      return;
    }

    const rowId = event.row.id;
    setEditableTestRows((previousRows) =>
      previousRows.map((row) =>
        Number(row.id) === Number(rowId)
          ? { ...event.row, laatst_bijgewerkt: new Date().toISOString() }
          : row
      )
    );
  }, []);

  const handleEditableTestAddRow = useCallback((newRow) => {
    const nextId = editableTestRows.length
      ? Math.max(...editableTestRows.map((row) => Number(row.id) || 0)) + 1
      : 1;
    return {
      ...newRow,
      id: nextId,
      laatst_bijgewerkt: new Date().toISOString(),
    };
  }, [editableTestRows]);

  const handleSave = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const type = modalState.type;
    const payload = Object.fromEntries(form.entries());
    if (modalState.data?.id) {
      await putJson(`/stamgegevens/${type}/${modalState.data.id}`, payload);
    } else {
      await postJson(`/stamgegevens/${type}`, payload);
    }
    setModalState({ type: null, data: null });
    refreshType(type);
  };

  const handleOrder = async (type, newData) => {
    const order = newData.map((item, index) => ({ id: item.id, volgorde: index + 1 }));
    await postJson(`/stamgegevens/${type}/order`, { order });
  };

  const renderTab = () => {
    if (activeTab === "statussen") {
      return (
        <>
          <div className="inline-form" style={{ justifyContent: "space-between", marginBottom: "16px" }}>
            <h3>Statussen overzicht</h3>
            <button className="btn btn-primary" onClick={() => setModalState({ type: "statussen", data: null })}>
              <i className="fas fa-plus" /> Status toevoegen
            </button>
          </div>
          <ClientTable
            tableId="statussenTable"
            title="Statussen beheer"
            columns={statussenColumns}
            data={statussen}
            actions={[
              { type: "edit", onClick: "editStatus" },
              { type: "delete", onClick: "deleteStatus" },
            ]}
            enableDragDrop
            enableColumnFilters
            exportEnabled
            horizontalScroll="auto"
            actionsColumnWidth={108}
            enableColumnCustomization
            onRowReorder={(newData) => handleOrder("statussen", newData)}
          />
        </>
      );
    }
    if (activeTab === "editable_test") {
      return (
        <>
          <div className="inline-form" style={{ justifyContent: "space-between", marginBottom: "16px" }}>
            <h3>Editable ClientTable test (tijdelijk)</h3>
          </div>
          <ClientTableEditable
            tableId="editableTestTable"
            title="Editable test tabel"
            columns={editableTestColumns}
            data={editableTestRows}
            actions={[{ type: "delete", onClick: "deleteEditableTestRow" }]}
            editableColumns={{
              id: false,
              code: true,
              omschrijving: true,
              categorie: true,
              prijs: true,
              actief: true,
              laatst_bijgewerkt: false,
            }}
            newRowDefaults={{
              code: "",
              omschrijving: "",
              categorie: "Algemeen",
              prijs: 0,
              actief: 1,
            }}
            onDataChange={handleEditableTestDataChange}
            onAddRow={handleEditableTestAddRow}
            enableColumnFilters
            exportEnabled
            searchEnabled
            horizontalScroll="auto"
            actionsColumnWidth={112}
            enableColumnCustomization
            noDataMessage="Nog geen testregels. Voeg hierboven een regel toe."
          />
        </>
      );
    }
    return null;

  };

  return (
    <div className="page-container">
      <div className="tab-row">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <i className={`fas ${tab.icon}`} style={{ marginRight: "6px" }} />
            {tab.label}
          </button>
        ))}
      </div>
      {renderTab()}

      <Modal
        title={modalState.type ? `${modalState.data?.id ? "Bewerk" : "Nieuwe"} ${modalLabel}` : ""}
        open={Boolean(modalState.type)}
        onClose={() => setModalState({ type: null, data: null })}
        onSubmit={handleSave}
        submitLabel="Opslaan"
      >
        {modalState.type === "statussen" && (
          <>
            <label className="form-label">Status</label>
            <input
              className="form-control"
              name="status"
              autoFocus
              defaultValue={modalState.data?.status || ""}
              required
            />
          </>
        )}
      </Modal>
    </div>
  );
}
