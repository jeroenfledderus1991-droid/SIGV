import { normalizeWidthValue, parseWidthToPixels } from "./columnWidth.js";

const AUTH_STORAGE_KEY = "authUser";
const TABLE_PREFERENCES_STORAGE_PREFIX = "clientTablePreferences:v1";

export const ALL_ROWS_OPTION = "alle";
export const ALL_ROWS_FALLBACK_LIMIT = 999999;

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

export function readTablePreferences(tableId) {
  if (typeof window === "undefined" || !tableId) {
    return null;
  }

  const parsed = safeParseJson(window.localStorage.getItem(getTablePreferencesStorageKey(tableId)));
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function writeTablePreferences(tableId, preferences) {
  if (typeof window === "undefined" || !tableId) {
    return;
  }

  try {
    window.localStorage.setItem(getTablePreferencesStorageKey(tableId), JSON.stringify(preferences));
  } catch {
    return;
  }
}

export function normalizeRowsOption(value) {
  if (value === ALL_ROWS_OPTION) {
    return ALL_ROWS_OPTION;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

export function buildColumnOrder(columnKeys, persistedColumnOrder = []) {
  const keysSet = new Set(columnKeys);
  const normalizedPersistedOrder = Array.isArray(persistedColumnOrder)
    ? persistedColumnOrder.filter((columnKey) => keysSet.has(columnKey))
    : [];
  const normalizedOrderSet = new Set(normalizedPersistedOrder);
  const missingKeys = columnKeys.filter((columnKey) => !normalizedOrderSet.has(columnKey));
  return [...normalizedPersistedOrder, ...missingKeys];
}

export function buildHiddenColumns(columnKeys, persistedHiddenColumns = {}) {
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

export function buildColumnWidthOverrides(columnKeys, persistedColumnWidthOverrides = {}) {
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

export function resolveRowsPerPageSelection(defaultRowsPerPage, rowsOptions, enableAlle, persistedValue) {
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

export function buildColumnState(nextColumns, columnOrder = [], hiddenColumns = {}) {
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
