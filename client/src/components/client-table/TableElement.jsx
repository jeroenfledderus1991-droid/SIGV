import ColumnsControl from "./ColumnsControl.jsx";

export default function TableElement({
  tableId,
  displayColumns,
  columnWidthStyles,
  actions,
  actionsColumnWidthCss,
  enableColumnFilters,
  enableColumnResize,
  startColumnResize,
  resetSingleColumnWidth,
  enableColumnCustomization,
  columnState,
  visibleColumnCount,
  hasColumnPreferenceChanges,
  onToggleColumnVisibility,
  onMoveColumnBefore,
  onResetPreferences,
}) {
  return (
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
                {enableColumnCustomization && (
                  <ColumnsControl
                    tableId={tableId}
                    compact
                    columnState={columnState}
                    visibleColumnCount={visibleColumnCount}
                    hasColumnPreferenceChanges={hasColumnPreferenceChanges}
                    onToggleColumnVisibility={onToggleColumnVisibility}
                    onMoveColumnBefore={onMoveColumnBefore}
                    onResetPreferences={onResetPreferences}
                  />
                )}
              </div>
            </th>
          )}
        </tr>
      </thead>
      <tbody />
    </table>
  );
}
