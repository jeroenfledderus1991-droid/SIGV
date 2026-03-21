import { useCallback, useEffect, useRef, useState } from "react";

export default function ColumnsControl({
  tableId,
  compact = false,
  columnState,
  visibleColumnCount,
  hasColumnPreferenceChanges,
  onToggleColumnVisibility,
  onMoveColumnBefore,
  onResetPreferences,
}) {
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [columnMenuStyle, setColumnMenuStyle] = useState({});
  const [draggingColumnKey, setDraggingColumnKey] = useState(null);
  const columnMenuAnchorRef = useRef(null);

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
    const top = placeBelow ? rect.bottom + 6 : Math.max(viewportPadding, rect.top - estimatedHeight - 6);

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

    const handleClickOutside = (event) => {
      if (!event.target.closest(`#${tableId}-columns-menu`) && !event.target.closest(`#${tableId}-columns-toggle`)) {
        setShowColumnMenu(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showColumnMenu, tableId]);

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

  return (
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
        {compact ? (
          <i className={`fas ${showColumnMenu ? "fa-chevron-up" : "fa-chevron-down"}`} />
        ) : (
          <>
            <i className="fas fa-columns" /> <span>Kolommen</span>
          </>
        )}
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
              <button type="button" className="columns-reset-all-btn" onClick={onResetPreferences}>
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
                onMoveColumnBefore(draggedKey, item.column.key);
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
                  onChange={() => onToggleColumnVisibility(item.column.key)}
                />
                <span>{item.column.label}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
