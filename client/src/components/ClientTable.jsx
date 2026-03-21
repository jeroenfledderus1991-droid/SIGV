import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClientTable from "../vendor/client-table.js";

const AUTH_STORAGE_KEY = "authUser";
const TABLE_PREFERENCES_STORAGE_PREFIX = "clientTablePreferences:v1";
const ALL_ROWS_OPTION = "alle";
const ALL_ROWS_FALLBACK_LIMIT = 999999;

function safeParseJson(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getCurrentUserStorageSegment() {
  if (typeof window === "undefined") {
    return "anonymous";
  }

  const bootstrapUser = window.__BOOTSTRAP__?.user;
  const bootstrapUserId = bootstrapUser?.id ?? bootstrapUser?.user_id;
  if (bootstrapUserId !== undefined && bootstrapUserId !== null) {
    return String(bootstrapUserId);
  }

  const authUser = safeParseJson(window.localStorage.getItem(AUTH_STORAGE_KEY));
  const authUserId = authUser?.id ?? authUser?.user_id;
  if (authUserId !== undefined && authUserId !== null) {
    return String(authUserId);
  }

  if (authUser?.username) {
    return String(authUser.username);
  }

  if (authUser?.email) {
    return String(authUser.email).toLowerCase();
  }

  return "anonymous";
}

function getTablePreferencesStorageKey(tableId) {
  return `${TABLE_PREFERENCES_STORAGE_PREFIX}:${getCurrentUserStorageSegment()}:${tableId}`;
}

function readTablePreferences(tableId) {
  if (typeof window === "undefined" || !tableId) {
    return null;
  }

  const parsed = safeParseJson(window.localStorage.getItem(getTablePreferencesStorageKey(tableId)));
  return parsed && typeof parsed === "object" ? parsed : null;
}

function writeTablePreferences(tableId, preferences) {
  if (typeof window === "undefined" || !tableId) {
    return;
  }

  try {
    window.localStorage.setItem(getTablePreferencesStorageKey(tableId), JSON.stringify(preferences));
  } catch {
    return;
  }
}

function normalizeRowsOption(value) {
  if (value === ALL_ROWS_OPTION) {
    return ALL_ROWS_OPTION;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

function normalizeWidthValue(widthValue) {
  if (typeof widthValue === "number" && Number.isFinite(widthValue)) {
    return `${widthValue}px`;
  }
  if (typeof widthValue === "string" && widthValue.trim()) {
    return widthValue.trim();
  }
  return null;
}

function parseWidthToPixels(widthValue) {
  if (typeof widthValue === "number" && Number.isFinite(widthValue)) {
    return widthValue;
  }
  if (typeof widthValue !== "string") {
    return null;
  }
  const trimmed = widthValue.trim().toLowerCase();
  if (trimmed.endsWith("px")) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isPrimaryPointerButton(event) {
  return event.button === 0;
}

function estimateColumnWidth(column) {
  const normalizedWidth = normalizeWidthValue(column.width);
  const explicitWidthPx = parseWidthToPixels(normalizedWidth);
  if (explicitWidthPx !== null) {
    return explicitWidthPx;
  }

  const normalizedMinWidth = normalizeWidthValue(column.minWidth);
  const minimumWidthPx = parseWidthToPixels(normalizedMinWidth);
  if (minimumWidthPx !== null) {
    return minimumWidthPx;
  }

  const labelLength = String(column.label || column.key || "").length;
  const widthWeight = Number(column.widthWeight);
  const weightMultiplier = Number.isFinite(widthWeight) && widthWeight > 0 ? widthWeight : 1;
  const estimated = (64 + labelLength * 9) * weightMultiplier;
  return Math.max(120, Math.min(420, estimated));
}

function getColumnMinimumWidth(column) {
  const normalizedWidth = normalizeWidthValue(column.width);
  const explicitWidthPx = parseWidthToPixels(normalizedWidth);
  if (explicitWidthPx !== null) {
    return explicitWidthPx;
  }

  const normalizedMinWidth = normalizeWidthValue(column.minWidth);
  const minimumWidthPx = parseWidthToPixels(normalizedMinWidth);
  if (minimumWidthPx !== null) {
    return minimumWidthPx;
  }

  return Math.max(
    48,
    Math.min(
      240,
      estimateColumnWidth({
        ...column,
        width: undefined,
        minWidth: undefined,
        widthWeight: 1,
      })
    )
  );
}

function getColumnPreferredWidth(column) {
  const normalizedWidth = normalizeWidthValue(column.width);
  const explicitWidthPx = parseWidthToPixels(normalizedWidth);
  if (explicitWidthPx !== null) {
    return explicitWidthPx;
  }

  return Math.max(getColumnMinimumWidth(column), estimateColumnWidth(column));
}

function calculateMinimumTableWidth(columns, actionsWidthPx = 0) {
  const minimumColumnsWidth = columns.reduce((total, column) => total + getColumnPreferredWidth(column), 0);
  return Math.max(640, minimumColumnsWidth + (actionsWidthPx || 0));
}

function shouldEnableHorizontalScroll(minimumTableWidth, columns, containerWidth) {
  if (!Number.isFinite(minimumTableWidth)) {
    return columns.length >= 7;
  }

  if (containerWidth > 0) {
    return minimumTableWidth > containerWidth;
  }

  return minimumTableWidth > 1024 || columns.length >= 7;
}

function buildColumnOrder(columnKeys, persistedColumnOrder = []) {
  const keysSet = new Set(columnKeys);
  const normalizedPersistedOrder = Array.isArray(persistedColumnOrder)
    ? persistedColumnOrder.filter((columnKey) => keysSet.has(columnKey))
    : [];
  const normalizedOrderSet = new Set(normalizedPersistedOrder);
  const missingKeys = columnKeys.filter((columnKey) => !normalizedOrderSet.has(columnKey));
  return [...normalizedPersistedOrder, ...missingKeys];
}

function buildHiddenColumns(columnKeys, persistedHiddenColumns = {}) {
  if (!persistedHiddenColumns || typeof persistedHiddenColumns !== "object") {
    return {};
  }

  const keysSet = new Set(columnKeys);
  return Object.entries(persistedHiddenColumns).reduce((acc, [columnKey, isHidden]) => {
    if (keysSet.has(columnKey) && Boolean(isHidden)) {
      acc[columnKey] = true;
    }
    return acc;
  }, {});
}

function buildColumnWidthOverrides(columnKeys, persistedColumnWidthOverrides = {}) {
  if (!persistedColumnWidthOverrides || typeof persistedColumnWidthOverrides !== "object") {
    return {};
  }

  const keysSet = new Set(columnKeys);
  return Object.entries(persistedColumnWidthOverrides).reduce((acc, [columnKey, widthValue]) => {
    if (!keysSet.has(columnKey)) {
      return acc;
    }
    const normalizedWidth = normalizeWidthValue(widthValue);
    const parsedWidth = parseWidthToPixels(normalizedWidth);
    if (parsedWidth !== null && parsedWidth > 0) {
      acc[columnKey] = `${Math.round(parsedWidth)}px`;
    }
    return acc;
  }, {});
}

function resolveRowsPerPageSelection(defaultRowsPerPage, rowsOptions, enableAlle, persistedValue) {
  const normalizedDefault = normalizeRowsOption(defaultRowsPerPage);
  const normalizedPersisted = normalizeRowsOption(persistedValue);
  const normalizedOptions = new Set(rowsOptions.map((option) => normalizeRowsOption(option)));

  if (enableAlle && normalizedPersisted === ALL_ROWS_OPTION) {
    return ALL_ROWS_OPTION;
  }

  if (typeof normalizedPersisted === "number" && normalizedPersisted > 0) {
    if (normalizedOptions.size === 0 || normalizedOptions.has(normalizedPersisted)) {
      return normalizedPersisted;
    }
  }

  if (typeof normalizedDefault === "number" && normalizedDefault > 0) {
    return normalizedDefault;
  }

  if (enableAlle && normalizedDefault === ALL_ROWS_OPTION) {
    return ALL_ROWS_OPTION;
  }

  return rowsOptions.length > 0 ? normalizeRowsOption(rowsOptions[0]) : 10;
}

function buildColumnState(nextColumns, columnOrder = [], hiddenColumns = {}) {
  const orderLookup = new Map(columnOrder.map((key, index) => [key, index]));

  return nextColumns
    .map((column, index) => ({
      column,
      hidden: Boolean(hiddenColumns[column.key]),
      order: orderLookup.has(column.key) ? orderLookup.get(column.key) : columnOrder.length + index,
    }))
    .sort((left, right) => left.order - right.order)
    .map(({ column, hidden }) => ({ column, hidden }));
}

function buildColumnWidthStyles(columns, actionsWidthPx = 0, lockWidths = false) {
  if (lockWidths) {
    return columns.map((column) => {
      const width = normalizeWidthValue(column.width);
      const minWidth = normalizeWidthValue(column.minWidth);
      const widthPx = parseWidthToPixels(width);
      const minimumWidthPx = getColumnMinimumWidth(column);

      if (width) {
        return {
          width,
          minWidth: minWidth || `${Math.round(minimumWidthPx)}px`,
          maxWidth: widthPx !== null ? width : undefined,
        };
      }

      const preferredWidthPx = getColumnPreferredWidth(column);
      const preferredWidthCss = `${Math.round(preferredWidthPx)}px`;

      return {
        width: preferredWidthCss,
        minWidth: minWidth || `${Math.round(minimumWidthPx)}px`,
        maxWidth: preferredWidthCss,
      };
    });
  }

  let reservedWidthPx = actionsWidthPx;
  let totalWeight = 0;

  const normalizedColumns = columns.map((column) => {
    const width = normalizeWidthValue(column.width);
    const minWidth = normalizeWidthValue(column.minWidth);
    const widthPx = parseWidthToPixels(width);
    const isWeighted = !width;
    const weight = Number(column.widthWeight);
    const normalizedWeight = Number.isFinite(weight) && weight > 0 ? weight : 1;
    const minimumWidthPx = getColumnMinimumWidth(column);

    if (widthPx !== null) {
      reservedWidthPx += widthPx;
    } else if (isWeighted) {
      totalWeight += normalizedWeight;
    }

    return {
      width,
      minWidth: minWidth || `${Math.round(minimumWidthPx)}px`,
      isWeighted,
      weight: normalizedWeight,
    };
  });

  return normalizedColumns.map((column) => {
    if (!column.isWeighted) {
      return {
        width: column.width || undefined,
        minWidth: column.minWidth || undefined,
      };
    }

    if (totalWeight <= 0) {
      return {
        width: undefined,
        minWidth: column.minWidth || undefined,
      };
    }

    const ratio = column.weight / totalWeight;
    const distributedWidth =
      reservedWidthPx > 0
        ? `calc((100% - ${Math.round(reservedWidthPx)}px) * ${ratio.toFixed(6)})`
        : `${(ratio * 100).toFixed(4)}%`;

    return {
      width: `max(${column.minWidth}, ${distributedWidth})`,
      minWidth: column.minWidth,
    };
  });
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
  enableRowClickAction = false,
  rowClickActionType = "auto",
  horizontalScroll = "auto",
  actionsColumnWidth = 132,
  enableColumnResize = true,
  enableColumnCustomization = false,
  noDataMessage = "Geen data beschikbaar",
  onRowReorder,
}) {
  const instanceRef = useRef(null);
  const containerRef = useRef(null);
  const resizeSessionRef = useRef(null);

  const columnKeys = useMemo(() => columns.map((column) => column.key), [columns]);

  const initialPreferences = useMemo(() => readTablePreferences(tableId), [tableId]);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [columnMenuStyle, setColumnMenuStyle] = useState({});
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
  const [draggingColumnKey, setDraggingColumnKey] = useState(null);
  const columnMenuAnchorRef = useRef(null);

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
        if (!overrideWidth) {
          return column;
        }
        return { ...column, width: overrideWidth };
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
  const hasColumnWidthOverrides = Object.keys(columnWidthOverrides).length > 0;
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
    () => buildColumnWidthStyles(displayColumns, actions ? actionsColumnWidthPx : 0, hasColumnWidthOverrides),
    [displayColumns, actions, actionsColumnWidthPx, hasColumnWidthOverrides]
  );

  const minimumTableWidth = useMemo(() => {
    return calculateMinimumTableWidth(displayColumns, actions ? actionsColumnWidthPx : 0);
  }, [displayColumns, actions, actionsColumnWidthPx]);

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

  useEffect(() => {
    const normalizedColumnOrder = buildColumnOrder(columnKeys, columnOrder);
    const normalizedHiddenColumns = buildHiddenColumns(columnKeys, hiddenColumns);
    const normalizedColumnWidthOverrides = buildColumnWidthOverrides(columnKeys, columnWidthOverrides);

    writeTablePreferences(tableId, {
      columnOrder: normalizedColumnOrder,
      hiddenColumns: normalizedHiddenColumns,
      columnWidthOverrides: normalizedColumnWidthOverrides,
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

  const tableResponsiveStyle = useMemo(() => {
    return {
      "--actions-column-width": actionsColumnWidthCss,
      "--table-min-scroll-width": `${Math.round(minimumTableWidth)}px`,
    };
  }, [minimumTableWidth, actionsColumnWidthCss]);

  useEffect(() => {
    const options = {
      columns: displayColumns,
      actions: actions || null,
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
    displayColumns,
    actions,
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
      if (!event.target.closest(`#${tableId}-columns-menu`) && !event.target.closest(`#${tableId}-columns-toggle`)) {
        setShowColumnMenu(false);
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [tableId]);

  const positionColumnsMenu = useCallback(() => {
    const anchor = columnMenuAnchorRef.current;
    if (!anchor || typeof window === "undefined") {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const desiredWidth = 280;
    const menuWidth = Math.max(220, Math.min(desiredWidth, window.innerWidth - viewportPadding * 2));
    const estimatedHeight = 320;

    const placeBelow = rect.bottom + estimatedHeight <= window.innerHeight - viewportPadding;
    const top = placeBelow
      ? rect.bottom + 6
      : Math.max(viewportPadding, rect.top - estimatedHeight - 6);

    const left = Math.min(
      window.innerWidth - viewportPadding - menuWidth,
      Math.max(viewportPadding, rect.right - menuWidth)
    );
    const maxHeight = Math.max(180, window.innerHeight - top - viewportPadding);

    setColumnMenuStyle({
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(menuWidth)}px`,
      maxHeight: `${Math.round(maxHeight)}px`,
      position: "fixed",
      overflowY: "auto",
    });
  }, []);

  useEffect(() => {
    if (!showColumnMenu) {
      return undefined;
    }

    const reposition = () => positionColumnsMenu();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [showColumnMenu, positionColumnsMenu]);

  const handleRowsChange = (value) => {
    const normalizedValue = normalizeRowsOption(value);
    setRowsPerPageSelection(normalizedValue);

    const instance = instanceRef.current;
    if (!instance) return;
    instance.handleRowsChange(normalizedValue);
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

  const visibleColumnCount = columnState.filter((item) => !item.hidden).length;

  const stopColumnResize = () => {
    const session = resizeSessionRef.current;
    if (!session) {
      return;
    }
    window.removeEventListener("mousemove", session.onMouseMove);
    window.removeEventListener("mouseup", session.onMouseUp);
    document.body.classList.remove("column-resizing");
    resizeSessionRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopColumnResize();
    };
  }, []);

  const handleColumnVisibilityChange = (columnKey) => {
    const target = columnState.find((item) => item.column.key === columnKey);
    if (!target) {
      return;
    }

    if (!target.hidden && visibleColumnCount <= 1) {
      return;
    }

    setHiddenColumns((previousHidden) => {
      const nextHidden = { ...previousHidden, [columnKey]: !target.hidden };
      if (!nextHidden[columnKey]) {
        delete nextHidden[columnKey];
      }
      return nextHidden;
    });
  };

  const moveColumnBefore = (draggedKey, targetKey) => {
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
  };

  const resetColumnPreferences = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setColumnOrder(columnKeys);
    setHiddenColumns({});
    setColumnWidthOverrides({});
  };

  const resetSingleColumnWidth = (columnKey, event) => {
    event.preventDefault();
    event.stopPropagation();
    setColumnWidthOverrides((previousWidths) => {
      if (!Object.prototype.hasOwnProperty.call(previousWidths, columnKey)) {
        return previousWidths;
      }
      const nextWidths = { ...previousWidths };
      delete nextWidths[columnKey];
      return nextWidths;
    });
  };

  const startColumnResize = (column, event) => {
    if (!isPrimaryPointerButton(event)) {
      return;
    }

    const headerCell = event.currentTarget.closest("th");
    if (!headerCell) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    stopColumnResize();

    if (!hasColumnWidthOverrides) {
      setColumnWidthOverrides((previousWidths) => {
        if (Object.keys(previousWidths).length > 0) {
          return previousWidths;
        }

        const lockedWidths = {};
        const headerCells = document.querySelectorAll(`#${tableId} thead th[data-column]`);
        headerCells.forEach((header) => {
          const key = header.getAttribute("data-column");
          if (!key) {
            return;
          }
          const width = Math.round(header.getBoundingClientRect().width);
          if (width > 0) {
            lockedWidths[key] = `${width}px`;
          }
        });

        return Object.keys(lockedWidths).length > 0 ? lockedWidths : previousWidths;
      });
    }

    const startWidthPx = Math.round(headerCell.getBoundingClientRect().width);
    const minWidthPx = parseWidthToPixels(normalizeWidthValue(column.minWidth)) || 48;
    const maxWidthPx = parseWidthToPixels(normalizeWidthValue(column.maxWidth)) || Number.POSITIVE_INFINITY;
    const startX = event.clientX;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const rawWidth = Math.round(startWidthPx + delta);
      const nextWidthPx = Math.max(minWidthPx, Math.min(maxWidthPx, rawWidth));
      const nextWidthCss = `${nextWidthPx}px`;

      setColumnWidthOverrides((previousWidths) => {
        if (previousWidths[column.key] === nextWidthCss) {
          return previousWidths;
        }
        return {
          ...previousWidths,
          [column.key]: nextWidthCss,
        };
      });
    };

    const onMouseUp = () => {
      stopColumnResize();
    };

    resizeSessionRef.current = {
      onMouseMove,
      onMouseUp,
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.classList.add("column-resizing");
  };

  const renderColumnsControl = (compact = false) => (
    <div className={`table-columns-control ${compact ? "table-columns-control--compact" : ""}`}>
      <button
        type="button"
        className={compact ? "columns-toggle-icon" : "columns-dropdown-btn"}
        id={`${tableId}-columns-toggle`}
        title="Kolommen"
        aria-label="Kolommen"
        onClick={(event) => {
          const nextVisible = !showColumnMenu;
          if (nextVisible) {
            columnMenuAnchorRef.current = event.currentTarget;
            positionColumnsMenu();
          }
          setShowColumnMenu(nextVisible);
        }}
      >
        {compact ? <i className={`fas ${showColumnMenu ? "fa-chevron-up" : "fa-chevron-down"}`} /> : <><i className="fas fa-columns" /> <span>Kolommen</span></>}
      </button>
      <div
        className="columns-menu"
        id={`${tableId}-columns-menu`}
        style={{ display: showColumnMenu ? "block" : "none", ...columnMenuStyle }}
      >
        <div className="columns-menu-header">
          <span>Toon/verberg en sleep voor volgorde</span>
          <div className="columns-menu-header-actions">
            {hasColumnPreferenceChanges && (
              <button type="button" className="columns-reset-all-btn" onClick={resetColumnPreferences}>
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="columns-menu-list">
          {columnState.map((item) => (
            <div
              key={`${tableId}-column-option-${item.column.key}`}
              className={`columns-menu-item ${draggingColumnKey === item.column.key ? "dragging" : ""}`}
              draggable
              onDragStart={(event) => {
                setDraggingColumnKey(item.column.key);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.column.key);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragEnd={() => setDraggingColumnKey(null)}
              onDrop={(event) => {
                event.preventDefault();
                const draggedKey = event.dataTransfer.getData("text/plain") || draggingColumnKey;
                moveColumnBefore(draggedKey, item.column.key);
                setDraggingColumnKey(null);
              }}
            >
              <span className="columns-drag-handle" title="Sleep voor volgorde">
                <i className="fas fa-grip-vertical" />
              </span>
              <label className="columns-menu-label">
                <input
                  type="checkbox"
                  checked={!item.hidden}
                  disabled={!item.hidden && visibleColumnCount <= 1}
                  onChange={() => handleColumnVisibilityChange(item.column.key)}
                />
                <span>{item.column.label}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="table-container" id={`${tableId}-container`} ref={containerRef}>
      {(title || searchEnabled || exportEnabled || enableColumnCustomization) && (
        <div className="table-header">
          {title && <h2 className="table-title">{title}</h2>}
          <div className="table-controls">
            {enableColumnCustomization && !actions && renderColumnsControl()}

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
                      className={`custom-option ${normalizeRowsOption(option) === rowsPerPageSelection ? "active" : ""}`}
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
        className={`table-responsive ${horizontalScrollEnabled ? "table-responsive--scroll" : "table-responsive--no-scroll"}`}
        style={tableResponsiveStyle}
      >
        <table className="standard-table" id={tableId}>
          <colgroup>
            {displayColumns.map((column, index) => (
              <col key={`${tableId}-col-${column.key}`} style={columnWidthStyles[index] || undefined} />
            ))}
            {actions && <col className="table-filler-col" />}
            {actions && (
              <col
                style={{
                  width: actionsColumnWidthCss,
                  minWidth: actionsColumnWidthCss,
                  maxWidth: actionsColumnWidthCss,
                }}
              />
            )}
          </colgroup>
          <thead>
            <tr>
              {displayColumns.map((column) => (
                <th
                  key={`${tableId}-${column.key}`}
                  className={column.sortable ? "sortable" : undefined}
                  data-column={column.key}
                >
                  <div className="th-content">
                    <div className="th-label">
                      <span className="th-text">{column.label}</span>
                      <div className="th-actions">
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
                    {enableColumnResize && (
                      <button
                        type="button"
                        className="column-resize-handle"
                        title="Sleep om kolombreedte te wijzigen (dubbelklik om te resetten)"
                        onMouseDown={(event) => startColumnResize(column, event)}
                        onDoubleClick={(event) => resetSingleColumnWidth(column.key, event)}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      />
                    )}
                  </div>
                </th>
              ))}
              {actions && <th className="table-filler-header" aria-hidden="true" />}
              {actions && (
                <th className="actions-header">
                  <div className="actions-header-content">
                    <span>Acties</span>
                    {enableColumnCustomization && renderColumnsControl(true)}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
      <div className="table-pagination" id={`${tableId}-pagination`} />
    </div>
  );
}
