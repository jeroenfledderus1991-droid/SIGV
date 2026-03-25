export function normalizeWidthValue(widthValue) {
  if (typeof widthValue === "number" && Number.isFinite(widthValue)) {
    return `${widthValue}px`;
  }
  if (typeof widthValue === "string" && widthValue.trim()) {
    return widthValue.trim();
  }
  return null;
}

export function parseWidthToPixels(widthValue) {
  if (typeof widthValue === "number" && Number.isFinite(widthValue)) {
    return widthValue;
  }
  if (typeof widthValue !== "string") {
    return null;
  }

  const trimmed = widthValue.trim().toLowerCase();
  if (!trimmed.endsWith("px")) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function estimateHeaderContentWidth(column) {
  const labelLength = String(column.label || column.key || "").length;
  const charWidth = 8.4;
  const horizontalPadding = 32; // th left/right padding within header cell
  const sortIconRoom = column.sortable === false ? 0 : 20;
  const filterIconRoom = column.filterable === false ? 0 : 20;
  const resizeHandleRoom = 12;
  const safetyGap = 12;

  return Math.max(
    80,
    Math.round(labelLength * charWidth + horizontalPadding + sortIconRoom + filterIconRoom + resizeHandleRoom + safetyGap)
  );
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

  const headerContentWidth = estimateHeaderContentWidth(column);
  const widthWeight = Number(column.widthWeight);
  const weightMultiplier = Number.isFinite(widthWeight) && widthWeight > 0 ? widthWeight : 1;
  const weightedEstimate = headerContentWidth * weightMultiplier;
  return Math.max(headerContentWidth, Math.round(weightedEstimate));
}

function getColumnMinimumWidth(column) {
  const normalizedWidth = normalizeWidthValue(column.width);
  const explicitWidthPx = parseWidthToPixels(normalizedWidth);
  if (explicitWidthPx !== null) {
    return explicitWidthPx;
  }

  const headerContentWidth = estimateHeaderContentWidth(column);
  const normalizedMinWidth = normalizeWidthValue(column.minWidth);
  const minimumWidthPx = parseWidthToPixels(normalizedMinWidth);
  if (minimumWidthPx !== null) {
    return Math.max(headerContentWidth, minimumWidthPx);
  }

  return Math.max(
    48,
    estimateColumnWidth({
      ...column,
      width: undefined,
      minWidth: undefined,
      widthWeight: 1,
    })
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

export function calculateMinimumTableWidth(columns, actionsWidthPx = 0) {
  const minimumColumnsWidth = columns.reduce((total, column) => total + getColumnPreferredWidth(column), 0);
  return Math.max(640, minimumColumnsWidth + (actionsWidthPx || 0));
}

export function shouldEnableHorizontalScroll(minimumTableWidth, columns, containerWidth) {
  if (!Number.isFinite(minimumTableWidth)) {
    return columns.length >= 7;
  }

  if (containerWidth > 0) {
    return minimumTableWidth > containerWidth;
  }

  return minimumTableWidth > 1024 || columns.length >= 7;
}

export function buildColumnWidthStyles(columns, actionsWidthPx = 0, lockWidths = false) {
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
