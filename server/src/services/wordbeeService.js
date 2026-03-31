const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_TOKEN_TTL_MS = 25 * 60 * 1000;
const MAX_TEXT_RESPONSE_CHARS = 100000;
const PAGE_SIZE = 200;
const MAX_PAGE_ITERATIONS = 2000;
const MAX_THROTTLE_RETRIES = 1;
const MAX_THROTTLE_WAIT_MS = 2500;
const { MAPPED_COLUMNS } = require("./wordbeeMappingConfig");
const { sleep, parseRetryAfterMs, extractErrorText } = require("./wordbeeHttpUtils");
const { applyMappedFilters, normalizeMappedFilters } = require("./wordbeeMappedFilters");
const { resolveFilterScanLimit, resolveFilterJobScanLimit } = require("./wordbeeScanUtils");
const { enrichOrdersAndResources } = require("./wordbeeOrderResourceEnricher");
const { createMappedRow } = require("./wordbeeMappedRowBuilder");
function resolveAuthMode(mode) {
  return String(mode || "").trim().toLowerCase() === "header" ? "header" : "api2";
}
function deriveAccountIdFromBaseUrl(baseUrl) {
  try {
    const hostname = new URL(baseUrl).hostname || "";
    return (hostname.split(".")[0] || "").trim();
  } catch {
    return "";
  }
}
function resolveAccountId(wordbeeConfig) {
  return (wordbeeConfig?.accountId || deriveAccountIdFromBaseUrl(wordbeeConfig?.baseUrl || "")).trim();
}
function buildTargetUrl(baseUrl, relativePath) {
  const normalizedBaseHref = baseUrl.href.endsWith("/") ? baseUrl.href : `${baseUrl.href}/`;
  const normalizedPath = String(relativePath || "").replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBaseHref);
}
function appendQueryParams(url, query) {
  if (!query || typeof query !== "object") return;
  for (const [key, value] of Object.entries(query)) {
    if (!key || value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          url.searchParams.append(key, String(item));
        }
      });
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}
function withTimeout(timeoutMs) {
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), safeTimeout);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}
function parseRequestBody(body) {
  if (body === undefined || body === null) return undefined;
  return body;
}
function toStringValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    if (typeof value.name === "string" && value.name.trim()) return value.name.trim();
    if (typeof value.label === "string" && value.label.trim()) return value.label.trim();
    if (typeof value.text === "string" && value.text.trim()) return value.text.trim();
    if (typeof value.value === "string" && value.value.trim()) return value.value.trim();
    return "";
  }
  return String(value).trim();
}
function pickFirstValue(...values) {
  for (const value of values) {
    const text = toStringValue(value);
    if (text) return text;
  }
  return "";
}
function toNumeric(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}
function toDateTs(value) {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}
function pickEarlierIso(existingIso, candidateIso) {
  const candidateTs = toDateTs(candidateIso);
  if (candidateTs === null) return existingIso || "";
  const existingTs = toDateTs(existingIso);
  if (existingTs === null || candidateTs < existingTs) return String(candidateIso);
  return existingIso;
}
function formatDateTimeNl(value) {
  const ts = toDateTs(value);
  if (ts === null) return "";
  const d = new Date(ts);
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
}
function normalizeProjectId(value) {
  return toStringValue(value);
}
async function parseResponsePayload(response) {
  const parseJsonishText = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    const first = text[0];
    const looksLikeJson = first === "{" || first === "[" || first === "\"";
    if (!looksLikeJson) {
      return text.length > MAX_TEXT_RESPONSE_CHARS ? `${text.slice(0, MAX_TEXT_RESPONSE_CHARS)}...` : text;
    }
    try {
      let parsed = JSON.parse(text);
      if (typeof parsed === "string" && parsed.trim()) {
        const nestedFirst = parsed.trim()[0];
        if (nestedFirst === "{" || nestedFirst === "[") {
          try {
            parsed = JSON.parse(parsed);
          } catch {}
        }
      }
      return parsed;
    } catch {
      return text.length > MAX_TEXT_RESPONSE_CHARS ? `${text.slice(0, MAX_TEXT_RESPONSE_CHARS)}...` : text;
    }
  };
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const jsonPayload = await response.json().catch(() => ({}));
    return typeof jsonPayload === "string" ? parseJsonishText(jsonPayload) : jsonPayload;
  }
  return parseJsonishText(await response.text());
}
function extractTokenFromPayload(payload) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim().replace(/^"|"$/g, "");
  }
  if (!payload || typeof payload !== "object") return "";
  const candidates = [payload.token, payload.access_token, payload.authToken, payload.value];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}
function isWordbeeConfigured(wordbeeConfig) {
  const authMode = resolveAuthMode(wordbeeConfig?.authMode);
  const hasBaseUrl = Boolean(wordbeeConfig?.baseUrl);
  const hasApiKey = Boolean(wordbeeConfig?.apiKey);
  const hasAccountId = Boolean(resolveAccountId(wordbeeConfig));
  if (authMode === "header") return hasBaseUrl && hasApiKey;
  return hasBaseUrl && hasApiKey && hasAccountId;
}
function getWordbeeConfigStatus(wordbeeConfig) {
  const accountId = resolveAccountId(wordbeeConfig);
  return {
    configured: isWordbeeConfigured(wordbeeConfig),
    authMode: resolveAuthMode(wordbeeConfig?.authMode),
    baseUrl: wordbeeConfig?.baseUrl || "",
    hasApiKey: Boolean(wordbeeConfig?.apiKey),
    hasAccountId: Boolean(accountId),
    accountId,
    timeoutMs: wordbeeConfig?.timeoutMs || DEFAULT_TIMEOUT_MS,
  };
}
function buildNotConfiguredError(wordbeeConfig) {
  const authMode = resolveAuthMode(wordbeeConfig?.authMode);
  if (!wordbeeConfig?.baseUrl || !wordbeeConfig?.apiKey) {
    return "WordBee is niet geconfigureerd. Zet WORDBEE_API_BASE_URL en WORDBEE_API_KEY in .env.";
  }
  if (authMode === "api2" && !resolveAccountId(wordbeeConfig)) {
    return "WORDBEE_AUTH_MODE=api2 vereist ook WORDBEE_API_ACCOUNT_ID in .env.";
  }
  return "WordBee configuratie is niet volledig.";
}
function initJobAggregate() {
  return {
    firstProposalIso: "",
    firstAcceptedIso: "",
    firstInProgressIso: "",
    firstDoneIso: "",
    totalWords: 0,
    hasWordData: false,
  };
}
function updateJobAggregate(store, jobRow) {
  const projectId = normalizeProjectId(jobRow?.pid);
  if (!projectId) return;
  const current = store.get(projectId) || initJobAggregate();
  current.firstProposalIso = pickEarlierIso(current.firstProposalIso, jobRow?.dtpassign);
  current.firstAcceptedIso = pickEarlierIso(current.firstAcceptedIso, jobRow?.dtcassign);
  current.firstInProgressIso = pickEarlierIso(current.firstInProgressIso, jobRow?.dtstart);
  current.firstDoneIso = pickEarlierIso(current.firstDoneIso, jobRow?.dtend);
  const openingsSource = jobRow?.openings;
  const segmentsSource = jobRow?.segments;
  const openingsRaw = Number(openingsSource);
  const segmentsRaw = Number(segmentsSource);
  const hasOpenings =
    openingsSource !== null && openingsSource !== undefined && openingsSource !== "" && Number.isFinite(openingsRaw);
  const hasSegments =
    segmentsSource !== null && segmentsSource !== undefined && segmentsSource !== "" && Number.isFinite(segmentsRaw);
  if (hasOpenings || hasSegments) {
    current.hasWordData = true;
    current.totalWords += Math.max(hasOpenings ? openingsRaw : 0, hasSegments ? segmentsRaw : 0);
  }
  store.set(projectId, current);
}
function extractRowsFromPayload(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload)) return payload;
  return [];
}
function createWordbeeService(config) {
  const tokenCache = { token: "", expiresAt: 0 };
  const wordbeeConfig = config?.wordbee || {};
  async function fetchApi2Token(baseUrl) {
    if (tokenCache.token && tokenCache.expiresAt > Date.now()) return tokenCache.token;
    const timeout = withTimeout(wordbeeConfig.timeoutMs);
    try {
      const tokenUrl = buildTargetUrl(baseUrl, "auth/token");
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          accountid: resolveAccountId(wordbeeConfig),
          key: wordbeeConfig.apiKey,
        }),
        signal: timeout.signal,
      });
      const payload = await parseResponsePayload(response);
      if (!response.ok) {
        throw new Error(`Token aanvraag mislukt (${response.status} ${response.statusText || "Unknown"}).`);
      }
      const token = extractTokenFromPayload(payload);
      if (!token) throw new Error("Token ontvangen maar niet parsebaar.");
      tokenCache.token = token;
      tokenCache.expiresAt = Date.now() + DEFAULT_TOKEN_TTL_MS;
      return token;
    } finally {
      timeout.clear();
    }
  }
  async function buildAuthHeaders(baseUrl) {
    if (resolveAuthMode(wordbeeConfig.authMode) === "header") {
      const prefix = wordbeeConfig.apiKeyPrefix ?? "Bearer ";
      const headerName = wordbeeConfig.apiKeyHeader || "Authorization";
      return { [headerName]: `${prefix}${wordbeeConfig.apiKey || ""}` };
    }
    const token = await fetchApi2Token(baseUrl);
    return {
      "X-Auth-Token": token,
      "X-Auth-AccountId": resolveAccountId(wordbeeConfig),
    };
  }
  async function executeRequest({ method, rawPath, query, body, headers: customHeaders }) {
    const resolvedBaseUrl = new URL(wordbeeConfig.baseUrl);
    const authHeaders = await buildAuthHeaders(resolvedBaseUrl);
    const targetUrl = buildTargetUrl(resolvedBaseUrl, rawPath);
    appendQueryParams(targetUrl, query);
    const headers = {
      Accept: "application/json",
      ...(customHeaders && typeof customHeaders === "object" ? customHeaders : {}),
      ...authHeaders,
    };
    const requestBody = parseRequestBody(body);
    if (requestBody !== undefined && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }
    const timeout = withTimeout(wordbeeConfig.timeoutMs);
    try {
      const startedAt = Date.now();
      const response = await fetch(targetUrl, {
        method,
        headers,
        body: requestBody !== undefined ? JSON.stringify(requestBody) : undefined,
        signal: timeout.signal,
      });
      const data = await parseResponsePayload(response);
      if (response.status === 401) {
        tokenCache.token = "";
        tokenCache.expiresAt = 0;
      }
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText || (response.ok ? "OK" : "Unknown"),
        retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
        durationMs: Date.now() - startedAt,
        requestPath: rawPath,
        requestUrl: `${targetUrl.pathname}${targetUrl.search}`,
        data,
      };
    } finally {
      timeout.clear();
    }
  }
  async function iteratePagedRows({ endpoint, maxRows, onRows }) {
    const resolvedMaxRows = Number.isFinite(maxRows) && maxRows > 0 ? maxRows : 0;
    let skip = 0;
    let processed = 0;
    let previousFirstKey = "";
    let page = 0;
    let throttleRetries = 0;
    while (page < MAX_PAGE_ITERATIONS) {
      if (resolvedMaxRows > 0 && processed >= resolvedMaxRows) break;
      const pageSize = resolvedMaxRows > 0 ? Math.min(PAGE_SIZE, resolvedMaxRows - processed) : PAGE_SIZE;
      const response = await executeRequest({
        method: "POST",
        rawPath: endpoint,
        body: { skip, take: pageSize },
      });
      if (!response?.ok) {
        if (response?.status === 429 && throttleRetries < MAX_THROTTLE_RETRIES) {
          const waitMs = Math.min(response?.retryAfterMs || 500, MAX_THROTTLE_WAIT_MS);
          throttleRetries += 1;
          await sleep(waitMs);
          continue;
        }
        const errorText = extractErrorText(response?.data);
        throw new Error(
          `Endpoint '${endpoint}' faalde (${response?.status || "?"} ${response?.statusText || "Unknown"}). ${errorText}`.trim()
        );
      }
      throttleRetries = 0;
      const rows = extractRowsFromPayload(response?.data);
      if (!rows.length) break;
      const shouldStop = await onRows(rows);
      if (shouldStop === true) break;
      processed += rows.length;
      const firstRow = rows[0] || {};
      const firstKey = pickFirstValue(firstRow.id, firstRow.jobid, firstRow.personid, firstRow.companyid, skip);
      if (firstKey && firstKey === previousFirstKey) break;
      previousFirstKey = firstKey;
      const total = Number(response?.data?.total);
      if (Number.isFinite(total) && skip + rows.length >= total) break;
      if (rows.length < pageSize) break;
      skip += rows.length;
      page += 1;
    }
  }
  async function fetchMappedData(maxRows, filters) {
    const maxRowsValue = Number.isFinite(maxRows) && maxRows > 0 ? Math.floor(maxRows) : 0;
    const normalizedFilters = normalizeMappedFilters(filters);
    const hasFilters = normalizedFilters.length > 0;
    const projectFetchLimit = hasFilters ? resolveFilterScanLimit(maxRowsValue) : maxRowsValue;
    const personById = new Map();
    const companyById = new Map();
    const jobsByProjectId = new Map();
    const projects = [];
    await iteratePagedRows({
      endpoint: "projects/list/full",
      maxRows: projectFetchLimit,
      onRows: (rows) => {
        rows.forEach((project) => projects.push(project));
      },
    });
    const projectIdSet = new Set();
    const projectReferenceSet = new Set();
    const neededPersonIds = new Set();
    const neededCompanyIds = new Set();
    projects.forEach((project) => {
      const projectId = normalizeProjectId(project?.id);
      const projectReference = toStringValue(project?.reference);
      const companyId = normalizeProjectId(project?.outCompanyId || project?.clientid);
      const personId = normalizeProjectId(project?.outPersonId);
      if (projectId) projectIdSet.add(projectId);
      if (projectReference) projectReferenceSet.add(projectReference);
      if (companyId) neededCompanyIds.add(companyId);
      if (personId) neededPersonIds.add(personId);
    });
    if (neededPersonIds.size) {
      await iteratePagedRows({
        endpoint: "persons/list/full",
        maxRows: 0,
        onRows: (rows) => {
          rows.forEach((row) => {
            const id = normalizeProjectId(row?.personid);
            if (!id || !neededPersonIds.has(id) || personById.has(id)) return;
            personById.set(id, row);
          });
          return personById.size >= neededPersonIds.size;
        },
      });
    }
    if (neededCompanyIds.size) {
      await iteratePagedRows({
        endpoint: "companies/list/full",
        maxRows: 0,
        onRows: (rows) => {
          rows.forEach((row) => {
            const id = normalizeProjectId(row?.companyid);
            if (!id || !neededCompanyIds.has(id) || companyById.has(id)) return;
            companyById.set(id, row);
          });
          return companyById.size >= neededCompanyIds.size;
        },
      });
    }
    await iteratePagedRows({
      endpoint: "jobs/list/full",
      maxRows: hasFilters ? resolveFilterJobScanLimit(projectFetchLimit) : (maxRowsValue > 0 ? Math.max(maxRowsValue * 4, 1000) : 0),
      onRows: (rows) => {
        rows.forEach((row) => {
          const projectId = normalizeProjectId(row?.pid);
          if (!projectId || !projectIdSet.has(projectId)) return;
          updateJobAggregate(jobsByProjectId, row);
        });
      },
    });
    const { orderByProjectId, resourceById } = await enrichOrdersAndResources({
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
    });
    const mappedRows = projects.map((project) => {
      const projectId = normalizeProjectId(project?.id);
      const companyId = normalizeProjectId(project?.outCompanyId || project?.clientid);
      const personId = normalizeProjectId(project?.outPersonId);
      const order = orderByProjectId.get(projectId);
      const resourceId = normalizeProjectId(order?.projectResourceId);
      return createMappedRow({
        project,
        company: companyById.get(companyId),
        person: personById.get(personId),
        jobs: jobsByProjectId.get(projectId),
        order,
        resource: resourceById.get(resourceId),
        pickFirstValue,
        toStringValue,
        formatDateTimeNl,
      });
    });
    const filtered = applyMappedFilters(mappedRows, normalizedFilters);
    const totalAfterFilter = filtered.rows.length;
    const limitedRows =
      hasFilters && maxRowsValue > 0
        ? filtered.rows.slice(0, maxRowsValue)
        : filtered.rows;
    const mayBeIncomplete = hasFilters && projects.length >= projectFetchLimit;
    return {
      columns: MAPPED_COLUMNS,
      count: limitedRows.length,
      totalBeforeFilter: filtered.totalBeforeFilter,
      totalAfterFilter,
      filtersApplied: filtered.filtersApplied,
      mayBeIncomplete,
      scanLimit: projectFetchLimit,
      rows: limitedRows,
    };
  }
  return {
    isConfigured: () => isWordbeeConfigured(wordbeeConfig),
    getConfigStatus: () => getWordbeeConfigStatus(wordbeeConfig),
    getNotConfiguredError: () => buildNotConfiguredError(wordbeeConfig),
    executeRequest,
    fetchMappedData,
  };
}
module.exports = { createWordbeeService };
