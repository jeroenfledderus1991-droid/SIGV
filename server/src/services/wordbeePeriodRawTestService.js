const { sleep, extractErrorText } = require("./wordbeeHttpUtils");

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_ITERATIONS = 2000;
const MAX_THROTTLE_RETRIES = 2;
const RESOURCE_ID_CHUNK_SIZE = 100;

function normalizePageSize(input) {
  const pageSize = Number(input);
  if (!Number.isFinite(pageSize)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.floor(pageSize), 50), 200);
}

function toRows(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload)) return payload;
  return [];
}

function toStatusText(response) {
  return response?.statusText || (response?.ok ? "OK" : "Unknown");
}

function toId(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function chunkArray(values, chunkSize) {
  const safeChunkSize = Math.max(1, Number(chunkSize) || 1);
  const result = [];
  for (let i = 0; i < values.length; i += safeChunkSize) {
    result.push(values.slice(i, i + safeChunkSize));
  }
  return result;
}

function monthWindowUtc(year, month) {
  // YTD range: from Jan 1st until the start of the next selected month.
  const min = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const max = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { min, max };
}

function buildDateRangeQuery(dateField, minIso, maxIso) {
  return `{${dateField}}.Matches("${minIso}", ">=", "${maxIso}", "<")`;
}

async function fetchPagedByQuery(wordbeeService, endpoint, queryExpr, pageSize) {
  const rows = [];
  let skip = 0;
  let page = 0;
  let throttleRetries = 0;
  let previousFirstKey = "";

  while (page < MAX_PAGE_ITERATIONS) {
    const response = await wordbeeService.executeRequest({
      method: "POST",
      rawPath: endpoint,
      body: {
        skip,
        take: pageSize,
        query: queryExpr,
      },
    });

    if (!response?.ok) {
      if (response?.status === 429 && throttleRetries < MAX_THROTTLE_RETRIES) {
        throttleRetries += 1;
        const waitMs = Math.max(500, Number(response?.retryAfterMs || 1000));
        await sleep(waitMs);
        continue;
      }
      const errorText = extractErrorText(response?.data);
      throw new Error(
        `Endpoint '${endpoint}' faalde (${response?.status || "?"} ${toStatusText(response)}). ${errorText}`.trim()
      );
    }

    throttleRetries = 0;
    const pageRows = toRows(response?.data);
    if (!pageRows.length) break;
    rows.push(...pageRows);

    const firstRow = pageRows[0] || {};
    const firstKey = String(firstRow.id ?? firstRow.jobid ?? firstRow.personid ?? firstRow.companyid ?? skip);
    if (firstKey && firstKey === previousFirstKey) break;
    previousFirstKey = firstKey;

    const total = Number(response?.data?.total);
    if (Number.isFinite(total) && skip + pageRows.length >= total) break;
    if (pageRows.length < pageSize) break;
    skip += pageRows.length;
    page += 1;
  }

  return rows;
}

async function fetchResourcesByIds(wordbeeService, resourceIds) {
  const ids = Array.from(resourceIds).filter(Boolean);
  if (!ids.length) return [];

  const allRows = [];
  const chunks = chunkArray(ids, RESOURCE_ID_CHUNK_SIZE);
  for (const chunk of chunks) {
    const requestIds = chunk.map((id) => {
      const asNumber = Number(id);
      return Number.isFinite(asNumber) && Number.isInteger(asNumber) ? asNumber : String(id);
    });
    const response = await wordbeeService.executeRequest({
      method: "POST",
      rawPath: "resources/list/full",
      body: { ids: requestIds },
    });
    if (!response?.ok) {
      const errorText = extractErrorText(response?.data);
      throw new Error(
        `Endpoint 'resources/list/full' faalde (${response?.status || "?"} ${toStatusText(response)}). ${errorText}`.trim()
      );
    }
    allRows.push(...toRows(response?.data));
  }

  return allRows;
}

function createWordbeePeriodRawTestService({ wordbeeService, rawStore }) {
  async function runPeriodRawTest(periodYear, periodMonth, options = {}) {
    const year = Number(periodYear);
    const month = Number(periodMonth);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error("Ongeldige periode voor WordBee raw test.");
    }
    const pageSize = normalizePageSize(options.pageSize);
    const startedAt = Date.now();

    const { min, max } = monthWindowUtc(year, month);
    const minIso = min.toISOString();
    const maxIso = max.toISOString();
    const createdQuery = buildDateRangeQuery("created", minIso, maxIso);

    const projectsRows = await fetchPagedByQuery(wordbeeService, "projects/list/full", createdQuery, pageSize);
    const ordersRows = await fetchPagedByQuery(wordbeeService, "orders/list/full", createdQuery, pageSize);
    const jobsRows = await fetchPagedByQuery(wordbeeService, "jobs/list/full", createdQuery, pageSize);

    const resourceIds = new Set();
    ordersRows.forEach((row) => {
      const resourceId = toId(row?.projectResourceId || row?.resourceId);
      if (resourceId) resourceIds.add(resourceId);
    });
    const resourcesRows = await fetchResourcesByIds(wordbeeService, resourceIds);

    const writes = [];
    writes.push(await rawStore.replaceDatasetRows("projects", projectsRows));
    writes.push(await rawStore.replaceDatasetRows("orders", ordersRows));
    writes.push(await rawStore.replaceDatasetRows("jobs", jobsRows));
    writes.push(await rawStore.replaceDatasetRows("resources", resourcesRows));

    return {
      period: { year, month },
      pageSize,
      query: createdQuery,
      apiRows: {
        projects: projectsRows.length,
        orders: ordersRows.length,
        jobs: jobsRows.length,
        resources: resourcesRows.length,
      },
      writes,
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    runPeriodRawTest,
  };
}

module.exports = {
  createWordbeePeriodRawTestService,
};
