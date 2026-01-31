import { useEffect, useRef, useState } from "react";
import ClientTable from "../vendor/client-table.js";

function normalizeRowsOption(value) {
  if (value === "alle") {
    return "alle";
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

export default function ClientTableWrapper({
  tableId,
  title,
  columns,
  data,
  actions,
  searchEnabled = true,
  rowsPerPage = 10,
  rowsOptions = [5, 10, 25, 50, 100],
  enableAlle = true,
  exportEnabled = false,
  enableDragDrop = false,
  enableColumnFilters = true,
  noDataMessage = "Geen data beschikbaar",
  onRowReorder,
}) {
  const instanceRef = useRef(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const options = {
      columns,
      actions: actions || null,
      rowsPerPage,
      rowsOptions,
      enableSearch: searchEnabled,
      enableSort: true,
      enablePagination: true,
      enableDragDrop,
      enableColumnFilters,
      noDataMessage,
      onRowReorder: onRowReorder || undefined,
    };

    if (!instanceRef.current) {
      instanceRef.current = new ClientTable(tableId, data, options);
      window[`${tableId}_instance`] = instanceRef.current;
    } else {
      instanceRef.current.config = { ...instanceRef.current.config, ...options };
      instanceRef.current.refresh(data);
    }
  }, [
    tableId,
    data,
    columns,
    actions,
    rowsPerPage,
    rowsOptions,
    searchEnabled,
    enableDragDrop,
    enableColumnFilters,
    noDataMessage,
    onRowReorder,
  ]);

  useEffect(() => {
    const handler = (event) => {
      if (!event.target.closest(`#${tableId}-export-menu`) && !event.target.closest(`#${tableId}-export-toggle`)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [tableId]);

  const handleRowsChange = (value) => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.handleRowsChange(normalizeRowsOption(value));
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    const instance = instanceRef.current;
    if (!instance) return;

    if (format === "csv") {
      instance.exportToCSV();
      return;
    }
    if (format === "xlsx") {
      instance.exportToExcel();
      return;
    }
    if (format === "pdf") {
      instance.exportToPDF();
    }
  };

  return (
    <div className="table-container" id={`${tableId}-container`}>
      {(title || searchEnabled || exportEnabled) && (
        <div className="table-header">
          {title && <h2 className="table-title">{title}</h2>}
          <div className="table-controls">
            {exportEnabled && (
              <div className="table-export">
                <button
                  type="button"
                  className="export-dropdown-btn"
                  id={`${tableId}-export-toggle`}
                  onClick={() => setShowExportMenu((prev) => !prev)}
                >
                  <i className="fas fa-download" /> <span className="export-text">Exporteren</span>
                </button>
                <div
                  className="export-menu"
                  id={`${tableId}-export-menu`}
                  style={{ display: showExportMenu ? "block" : "none" }}
                >
                  <button type="button" className="export-option" onClick={() => handleExport("csv")}>
                    <i className="fas fa-file-csv" /> CSV
                  </button>
                  <button type="button" className="export-option" onClick={() => handleExport("xlsx")}>
                    <i className="fas fa-file-excel" /> Excel
                  </button>
                  <button type="button" className="export-option" onClick={() => handleExport("pdf")}>
                    <i className="fas fa-file-pdf" /> PDF
                  </button>
                </div>
              </div>
            )}
            {searchEnabled && (
              <div className="table-search">
                <input type="text" id={`${tableId}-search`} placeholder="Zoeken..." autoComplete="off" />
                <i className="fas fa-search search-icon" />
              </div>
            )}
            <div className="table-rows-selector" id={`${tableId}-rows-wrapper`}>
              <label>Rijen:</label>
              <div className="custom-select-wrapper">
                <div className="custom-select" id={`${tableId}-rows-dropdown`}>
                  <span className="selected-value" id={`${tableId}-rows-selected`}>
                    {rowsPerPage}
                  </span>
                  <i className="fas fa-chevron-down" />
                </div>
                <div className="custom-select-options" id={`${tableId}-rows-options`} style={{ display: "none" }}>
                  {rowsOptions.map((option) => (
                    <div
                      key={`rows-${tableId}-${option}`}
                      className={`custom-option ${option === rowsPerPage ? "active" : ""}`}
                      data-value={option}
                      onClick={() => handleRowsChange(option)}
                    >
                      {option}
                    </div>
                  ))}
                  {enableAlle && (
                    <div className="custom-option" data-value="alle" onClick={() => handleRowsChange("alle")}>
                      Alle
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="table-responsive">
        <table className="standard-table" id={tableId}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={`${tableId}-${column.key}`}
                  className={column.sortable ? "sortable" : undefined}
                  data-column={column.key}
                >
                  <div className="th-content">
                    <div className="th-label">
                      {column.label}
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        {column.sortable && (
                          <span
                            className="sort-icon"
                            onClick={() => window[`${tableId}_instance`]?.handleSort(column.key)}
                          >
                            <i className="fas fa-sort" />
                          </span>
                        )}
                        {enableColumnFilters && column.filterable !== false && (
                          <>
                            <button
                              className="filter-toggle"
                              data-column={column.key}
                              title="Filter kolom"
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <i className="fas fa-filter" />
                            </button>
                            <div className="filter-dropdown" style={{ display: "none" }} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </th>
              ))}
              {actions && <th className="actions-header">Acties</th>}
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
      <div className="table-pagination" id={`${tableId}-pagination`} />
    </div>
  );
}
