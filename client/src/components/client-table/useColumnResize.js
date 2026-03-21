import { useCallback, useEffect, useRef } from "react";
import { normalizeWidthValue, parseWidthToPixels } from "./columnWidth.js";

function isPrimaryPointerButton(event) {
  return event.button === 0;
}

export function useColumnResize({
  tableId,
  hasColumnWidthOverrides,
  setColumnWidthOverrides,
}) {
  const resizeSessionRef = useRef(null);

  const stopColumnResize = useCallback(() => {
    const session = resizeSessionRef.current;
    if (!session) {
      return;
    }

    window.removeEventListener("mousemove", session.onMouseMove);
    window.removeEventListener("mouseup", session.onMouseUp);
    document.body.classList.remove("column-resizing");
    resizeSessionRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopColumnResize();
    };
  }, [stopColumnResize]);

  const resetSingleColumnWidth = useCallback(
    (columnKey, event) => {
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
    },
    [setColumnWidthOverrides]
  );

  const startColumnResize = useCallback(
    (column, event) => {
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
      const maxWidthPx =
        parseWidthToPixels(normalizeWidthValue(column.maxWidth)) || Number.POSITIVE_INFINITY;
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
    },
    [hasColumnWidthOverrides, setColumnWidthOverrides, stopColumnResize, tableId]
  );

  return {
    startColumnResize,
    resetSingleColumnWidth,
  };
}
