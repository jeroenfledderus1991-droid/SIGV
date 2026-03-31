function chunkArray(values, chunkSize) {
  const size = Math.max(1, Number(chunkSize) || 1);
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function toRequestId(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const asNumber = Number(text);
  if (Number.isFinite(asNumber) && Number.isInteger(asNumber)) {
    return asNumber;
  }
  return text;
}
function scoreOrderRow(row, toStringValue, normalizeProjectId) {
  let score = 0;
  if (toStringValue(row?.cford2)) score += 2;
  if (toStringValue(row?.cford1) || toStringValue(row?.lblord613)) score += 2;
  if (toStringValue(row?.dtproposal)) score += 2;
  if (normalizeProjectId(row?.projectResourceId)) score += 2;
  if (toStringValue(row?.reference)) score += 1;
  return score;
}

async function enrichOrdersAndResources({
  iteratePagedRows,
  executeRequest,
  extractRowsFromPayload,
  hasFilters,
  projectFetchLimit,
  maxRowsValue,
  resolveFilterJobScanLimit,
  normalizeProjectId,
  toStringValue,
  projectIdSet,
  projectReferenceSet,
}) {
  const orderByProjectId = new Map();
  const resourceById = new Map();
  const neededResourceIds = new Set();

  await iteratePagedRows({
    endpoint: "orders/list/full",
    maxRows: hasFilters
      ? resolveFilterJobScanLimit(projectFetchLimit)
      : maxRowsValue > 0
        ? Math.max(maxRowsValue * 4, 1000)
        : 0,
    onRows: (rows) => {
      rows.forEach((row) => {
        const projectId = normalizeProjectId(row?.projectId);
        const orderReference = toStringValue(row?.reference);
        if (!projectId && !orderReference) return;
        if (projectId && !projectIdSet.has(projectId) && !projectReferenceSet.has(orderReference)) return;
        if (projectId) {
          const existing = orderByProjectId.get(projectId);
          if (!existing) {
            orderByProjectId.set(projectId, row);
          } else {
            const nextScore = scoreOrderRow(row, toStringValue, normalizeProjectId);
            const existingScore = scoreOrderRow(existing, toStringValue, normalizeProjectId);
            if (nextScore >= existingScore) {
              orderByProjectId.set(projectId, row);
            }
          }
        }
        const resourceId = normalizeProjectId(row?.projectResourceId);
        if (resourceId) neededResourceIds.add(resourceId);
      });
    },
  });

  if (neededResourceIds.size) {
    const resourceIdChunks = chunkArray(Array.from(neededResourceIds), 100);
    for (const idChunk of resourceIdChunks) {
      const requestIds = idChunk.map(toRequestId).filter((id) => id !== null);
      if (!requestIds.length) continue;
      const resourceResponse = await executeRequest({
        method: "POST",
        rawPath: "resources/list/full",
        body: { ids: requestIds },
      });
      if (!resourceResponse?.ok) {
        throw new Error(
          `Endpoint 'resources/list/full' faalde (${resourceResponse?.status || "?"} ${resourceResponse?.statusText || "Unknown"}).`
        );
      }
      const resourceRows = extractRowsFromPayload(resourceResponse?.data);
      resourceRows.forEach((resourceRow) => {
        const resourceId = normalizeProjectId(resourceRow?.id);
        if (resourceId) resourceById.set(resourceId, resourceRow);
      });
    }
  }

  return {
    orderByProjectId,
    resourceById,
  };
}

module.exports = {
  enrichOrdersAndResources,
};
