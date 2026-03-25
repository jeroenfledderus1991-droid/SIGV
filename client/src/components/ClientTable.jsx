import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClientTable from "../vendor/client-table.js";
import ColumnsControl from "./client-table/ColumnsControl.jsx";
import TableElement from "./client-table/TableElement.jsx";
import {
  ALL_ROWS_FALLBACK_LIMIT,
  ALL_ROWS_OPTION,
  buildColumnOrder,
  buildColumnState,
  buildColumnWidthOverrides,
  buildHiddenColumns,
  normalizeRowsOption,
  readTablePreferences,
  resolveRowsPerPageSelection,
  writeTablePreferences,
} from "./client-table/preferences.js";
import {
  buildColumnWidthStyles,
  calculateMinimumTableWidth,
  normalizeWidthValue,
  parseWidthToPixels,
  shouldEnableHorizontalScroll,
} from "./client-table/columnWidth.js";
import { useColumnResize } from "./client-table/useColumnResize.js";

export default function ClientTableWrapper({
  tableId,
  title,
  columns,
  data,
  actions = [],
  searchEnabled = true,
  rowsPerPage = 10,
  rowsOptions = [5, 10, 25, 50, 100],
  enableAlle = true,
  exportEnabled = true,
  enableDragDrop = false,
  enableColumnFilters = true,
  enableRowClickAction = false,
  rowClickActionType = "auto",
  horizontalScroll = "auto",
  actionsColumnWidth = 132,
  enableColumnResize = true,
  enableColumnCustomization = true,
  noDataMessage = "Geen data beschikbaar",
  onRowReorder,
}) {
  const instanceRef = useRef(null);
  const activeTableIdRef = useRef(null);
  const containerRef = useRef(null);
  const hasActionsColumn = actions !== false && actions !== null;
  const actionsConfig = useMemo(() => {
    if (!hasActionsColumn) {
      return null;
    }
    return Array.isArray(actions) ? actions : [];
  }, [actions, hasActionsColumn]);

  const columnKeys = useMemo(() => columns.map((column) => column.key), [columns]);
  const initialPreferences = useMemo(() => readTablePreferences(tableId), [tableId]);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [columnOrder, setColumnOrder] = useState(() =>
    buildColumnOrder(columnKeys, initialPreferences?.columnOrder)
  );
  const [hiddenColumns, setHiddenColumns] = useState(() =>
    buildHiddenColumns(columnKeys, initialPreferences?.hiddenColumns)
  );
  const [columnWidthOverrides, setColumnWidthOverrides] = useState(() =>
    buildColumnWidthOverrides(columnKeys, initialPreferences?.columnWidthOverrides)
  );
  const [rowsPerPageSelection, setRowsPerPageSelection] = useState(() =>
    resolveRowsPerPageSelection(rowsPerPage, rowsOptions, enableAlle, initialPreferences?.rowsPerPage)
  );

  const columnState = useMemo(
    () => buildColumnState(columns, columnOrder, hiddenColumns),
    [columns, columnOrder, hiddenColumns]
  );
  const visibleColumns = useMemo(
    () => columnState.filter((item) => !item.hidden).map((item) => item.column),
    [columnState]
  );
  const displayColumns = useMemo(
    () =>
      visibleColumns.map((column) => {
        const overrideWidth = columnWidthOverrides[column.key];
        return overrideWidth ? { ...column, width: overrideWidth } : column;
      }),
    [visibleColumns, columnWidthOverrides]
  );

  const actionsColumnWidthCss = useMemo(
    () => normalizeWidthValue(actionsColumnWidth) || "132px",
    [actionsColumnWidth]
  );
  const actionsColumnWidthPx = useMemo(
    () => parseWidthToPixels(actionsColumnWidthCss) || 132,
    [actionsColumnWidthCss]
  );

  const hasColumnWidthOverrides = useMemo(
    () => Object.keys(columnWidthOverrides).length > 0,
    [columnWidthOverrides]
  );
  const hasHiddenColumns = useMemo(
    () => Object.values(hiddenColumns).some((isHidden) => Boolean(isHidden)),
    [hiddenColumns]
  );
  const hasCustomColumnOrder = useMemo(() => {
    if (columnOrder.length !== columnKeys.length) {
      return true;
    }
    return columnOrder.some((columnKey, index) => columnKey !== columnKeys[index]);
  }, [columnOrder, columnKeys]);
  const hasColumnPreferenceChanges = hasHiddenColumns || hasCustomColumnOrder || hasColumnWidthOverrides;

  const columnWidthStyles = useMemo(
    () =>
      buildColumnWidthStyles(displayColumns, hasActionsColumn ? actionsColumnWidthPx : 0, hasColumnWidthOverrides),
    [displayColumns, hasActionsColumn, actionsColumnWidthPx, hasColumnWidthOverrides]
  );
  const minimumTableWidth = useMemo(
    () => calculateMinimumTableWidth(displayColumns, hasActionsColumn ? actionsColumnWidthPx : 0),
    [displayColumns, hasActionsColumn, actionsColumnWidthPx]
  );

  const effectiveRowsPerPage = useMemo(() => {
    if (rowsPerPageSelection === ALL_ROWS_OPTION) {
      return ALL_ROWS_FALLBACK_LIMIT;
    }

    const parsedRows = Number(rowsPerPageSelection);
    if (Number.isFinite(parsedRows) && parsedRows > 0) {
      return parsedRows;
    }

    const fallbackRows = Number(rowsPerPage);
    return Number.isFinite(fallbackRows) && fallbackRows > 0 ? fallbackRows : 10;
  }, [rowsPerPageSelection, rowsPerPage]);

  const horizontalScrollEnabled = useMemo(() => {
    if (horizontalScroll === true || horizontalScroll === "on") {
      return true;
    }
    if (horizontalScroll === false || horizontalScroll === "off") {
      return false;
    }
    if (hasColumnWidthOverrides) {
      return true;
    }
    return shouldEnableHorizontalScroll(minimumTableWidth, displayColumns, containerWidth);
  }, [horizontalScroll, minimumTableWidth, displayColumns, containerWidth, hasColumnWidthOverrides]);

  const tableResponsiveStyle = useMemo(
    () => ({
      "--actions-column-width": actionsColumnWidthCss,
      "--table-min-scroll-width": `${Math.round(minimumTableWidth)}px`,
    }),
    [minimumTableWidth, actionsColumnWidthCss]
  );

  const { startColumnResize, resetSingleColumnWidth } = useColumnResize({
    tableId,
    hasColumnWidthOverrides,
    setColumnWidthOverrides,
  });

  const visibleColumnCount = useMemo(
    () => columnState.filter((item) => !item.hidden).length,
    [columnState]
  );

  const handleColumnVisibilityChange = useCallback(
    (columnKey) => {
      const target = columnState.find((item) => item.column.key === columnKey);
      if (!target || (!target.hidden && visibleColumnCount <= 1)) {
        return;
      }

      setHiddenColumns((previousHidden) => {
        const nextHidden = { ...previousHidden, [columnKey]: !target.hidden };
        if (!nextHidden[columnKey]) {
          delete nextHidden[columnKey];
        }
        return nextHidden;
      });
    },
    [columnState, visibleColumnCount]
  );

  const moveColumnBefore = useCallback(
    (draggedKey, targetKey) => {
      if (!draggedKey || !targetKey || draggedKey === targetKey) {
        return;
      }

      const orderedKeys = columnState.map((item) => item.column.key);
      const sourceIndex = orderedKeys.indexOf(draggedKey);
      const targetIndex = orderedKeys.indexOf(targetKey);
      if (sourceIndex < 0 || targetIndex < 0) {
        return;
      }

      const reorderedKeys = [...orderedKeys];
      const [movedKey] = reorderedKeys.splice(sourceIndex, 1);
      reorderedKeys.splice(targetIndex, 0, movedKey);
      setColumnOrder(reorderedKeys);
    },
    [columnState]
  );

  const resetColumnPreferences = useCallback(
    (event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      setColumnOrder(columnKeys);
      setHiddenColumns({});
      setColumnWidthOverrides({});
    },
    [columnKeys]
  );

  const handleRowsChange = useCallback(
    (value) => {
      const normalizedValue = normalizeRowsOption(value);
      setRowsPerPageSelection(normalizedValue);

      const instance = instanceRef.current;
      if (instance) {
        instance.handleRowsChange(normalizedValue);
      }
    },
    [setRowsPerPageSelection]
  );

  const handleExport = useCallback((format) => {
    setShowExportMenu(false);
    const instance = instanceRef.current;
    if (!instance) {
      return;
    }

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
  }, []);

  useEffect(() => {
    writeTablePreferences(tableId, {
      columnOrder: buildColumnOrder(columnKeys, columnOrder),
      hiddenColumns: buildHiddenColumns(columnKeys, hiddenColumns),
      columnWidthOverrides: buildColumnWidthOverrides(columnKeys, columnWidthOverrides),
      rowsPerPage: rowsPerPageSelection,
    });
  }, [tableId, columnKeys, columnOrder, hiddenColumns, columnWidthOverrides, rowsPerPageSelection]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const measure = () => {
      setContainerWidth(element.clientWidth || 0);
    };

    measure();

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(element);
    }

    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const options = {
      columns: displayColumns,
      actions: actionsConfig,
      rowsPerPage: effectiveRowsPerPage,
      rowsOptions,
      enableSearch: searchEnabled,
      enableSort: true,
      enablePagination: true,
      enableDragDrop,
      enableColumnFilters,
      enableRowClickAction,
      rowClickActionType,
      noDataMessage,
      onRowReorder: onRowReorder || undefined,
    };

    const previousTableId = activeTableIdRef.current;
    const hasTableIdChanged = Boolean(previousTableId) && previousTableId !== tableId;

    if (hasTableIdChanged && window[`${previousTableId}_instance`]) {
      delete window[`${previousTableId}_instance`];
      instanceRef.current = null;
    }

    if (!instanceRef.current || hasTableIdChanged) {
      instanceRef.current = new ClientTable(tableId, data, options);
      window[`${tableId}_instance`] = instanceRef.current;
      activeTableIdRef.current = tableId;
      return;
    }

    instanceRef.current.config = { ...instanceRef.current.config, ...options };
    instanceRef.current.refresh(data);
  }, [
    tableId,
    data,
    displayColumns,
    actionsConfig,
    effectiveRowsPerPage,
    rowsOptions,
    searchEnabled,
    enableDragDrop,
    enableColumnFilters,
    enableRowClickAction,
    rowClickActionType,
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

  useEffect(() => {
    return () => {
      const currentTableId = activeTableIdRef.current;
      if (currentTableId && window[`${currentTableId}_instance`]) {
        delete window[`${currentTableId}_instance`];
      }
      instanceRef.current = null;
      activeTableIdRef.current = null;
    };
  }, []);

  return (
    <div className="table-container" id={`${tableId}-container`} ref={containerRef}>
      {(title || searchEnabled || exportEnabled || enableColumnCustomization) && (
        <div className="table-header">
          {title && <h2 className="table-title">{title}</h2>}
          <div className="table-controls">
            {enableColumnCustomization && !hasActionsColumn && (
              <ColumnsControl
                tableId={tableId}
                columnState={columnState}
                visibleColumnCount={visibleColumnCount}
                hasColumnPreferenceChanges={hasColumnPreferenceChanges}
                onToggleColumnVisibility={handleColumnVisibilityChange}
                onMoveColumnBefore={moveColumnBefore}
                onResetPreferences={resetColumnPreferences}
              />
            )}

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
                    {rowsPerPageSelection === ALL_ROWS_OPTION ? "Alle" : rowsPerPageSelection}
                  </span>
                  <i className="fas fa-chevron-down" />
                </div>
                <div className="custom-select-options" id={`${tableId}-rows-options`} style={{ display: "none" }}>
                  {rowsOptions.map((option) => (
                    <div
                      key={`rows-${tableId}-${option}`}
                      className={`custom-option ${
                        normalizeRowsOption(option) === rowsPerPageSelection ? "active" : ""
                      }`}
                      data-value={option}
                      onClick={() => handleRowsChange(option)}
                    >
                      {option}
                    </div>
                  ))}
                  {enableAlle && (
                    <div
                      className={`custom-option ${rowsPerPageSelection === ALL_ROWS_OPTION ? "active" : ""}`}
                      data-value={ALL_ROWS_OPTION}
                      onClick={() => handleRowsChange(ALL_ROWS_OPTION)}
                    >
                      Alle
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`table-responsive ${
          horizontalScrollEnabled ? "table-responsive--scroll" : "table-responsive--no-scroll"
        }`}
        style={tableResponsiveStyle}
      >
        <TableElement
          tableId={tableId}
          displayColumns={displayColumns}
          columnWidthStyles={columnWidthStyles}
          actions={hasActionsColumn}
          actionsColumnWidthCss={actionsColumnWidthCss}
          hasColumnWidthOverrides={hasColumnWidthOverrides}
          enableColumnFilters={enableColumnFilters}
          enableColumnResize={enableColumnResize}
          startColumnResize={startColumnResize}
          resetSingleColumnWidth={resetSingleColumnWidth}
          enableColumnCustomization={enableColumnCustomization}
          columnState={columnState}
          visibleColumnCount={visibleColumnCount}
          hasColumnPreferenceChanges={hasColumnPreferenceChanges}
          onToggleColumnVisibility={handleColumnVisibilityChange}
          onMoveColumnBefore={moveColumnBefore}
          onResetPreferences={resetColumnPreferences}
        />
      </div>
      <div className="table-pagination" id={`${tableId}-pagination`} />
    </div>
  );
}
