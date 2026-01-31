import { useEffect, useMemo, useState } from "react";
import { deleteJson, getJson, postJson, putJson } from "../api";
import ClientTable from "../components/ClientTable.jsx";

const TABS = [
  { key: "statussen", label: "Statussen", icon: "fa-tags" },
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
  const [activeTab, setActiveTab] = useState("statussen");
  const [statussen, setStatussen] = useState([]);
  const [modalState, setModalState] = useState({ type: null, data: null });
  const modalLabel = useMemo(() => {
    if (!modalState.type) return "";
    return { statussen: "status" }[modalState.type] || "";
  }, [modalState.type]);

  useEffect(() => {
    const stored = localStorage.getItem("stamgegevens_tab");
    if (stored && TABS.some((tab) => tab.key === stored)) {
      setActiveTab(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("stamgegevens_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    getJson("/stamgegevens/statussen").then(setStatussen).catch(() => setStatussen([]));
  }, []);

  useEffect(() => {
    window.editStatus = (id, rowData) => setModalState({ type: "statussen", data: { id, ...rowData } });
    window.deleteStatus = (id) => handleDelete("statussen", id);
  }, []);

  const statussenColumns = useMemo(
    () => [
      { key: "status", label: "Status", sortable: true },
      { key: "volgorde", label: "Volgorde", sortable: true },
    ],
    []
  );

  const handleDelete = async (type, id) => {
    if (!window.confirm("Weet je zeker dat je dit item wilt verwijderen?")) {
      return;
    }
    await deleteJson(`/stamgegevens/${type}/${id}`);
    refreshType(type);
  };

  const refreshType = (type) => {
    if (type === "statussen") getJson("/stamgegevens/statussen").then(setStatussen);
  };

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
            onRowReorder={(newData) => handleOrder("statussen", newData)}
          />
        </>
      );
    }
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
