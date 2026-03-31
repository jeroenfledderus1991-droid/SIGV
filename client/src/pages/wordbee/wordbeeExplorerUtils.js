export const MONTH_OPTIONS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maart" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Augustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export const PREFERRED_COLUMN_ORDER = [
  "Kenmerk",
  "Aanvraagnummer",
  "Status",
  "Brontaal",
  "Datum van ontvangst",
  "Deadline",
  "Aanmaakdatum",
  "Datum van voorstel",
  "Aanvaarde datum",
  "Proposal (Initial) Date",
  "In Progress (Initial) Date",
  "Nummer Rbtv",
  "Aantal vertaalde woorden",
  "Voorstel ander deadline",
  "Klacht",
];

export const IMPORT_PHASES = [
  "Projecten ophalen...",
  "Orders ophalen...",
  "Jobs ophalen...",
  "Resources ophalen...",
  "Data verwerken en opslaan in SQL...",
];

export const DEFAULT_ROWS_PER_PAGE = 50;
export const TABLE_ID = "wordbee-all-v1";
const REPORT_PICKER_ID_PREFIX = "wordbee-report";

export function toMessage(error) {
  if (!error) return "Onbekende fout.";
  return error.message || String(error);
}

export function formatDuration(seconds) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function parseDateLikeToTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;

  const nlMatch = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (nlMatch) {
    const [, day, month, year, hour, minute, second] = nlMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour || 0),
      Number(minute || 0),
      Number(second || 0)
    );
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const isoTs = Date.parse(text);
  return Number.isFinite(isoTs) ? isoTs : null;
}

function inferColumnType(rows, key) {
  const values = rows
    .map((row) => row?.[key])
    .filter((value) => value !== "" && value !== null && value !== undefined);
  if (!values.length) return "text";

  const numberLike = values.every((value) => Number.isFinite(Number(value)));
  if (numberLike) return "number";

  const dateLikeCount = values.filter((value) => parseDateLikeToTimestamp(value) !== null).length;
  if (dateLikeCount > 0 && dateLikeCount >= Math.ceil(values.length * 0.8)) {
    const hasTime = values.some((value) => /\d{2}:\d{2}/.test(String(value || "")));
    return hasTime ? "datetime" : "date";
  }
  return "text";
}

export function orderKeysByPreference(keys, preferenceOrder) {
  return [...keys].sort((left, right) => {
    const leftIndex = preferenceOrder.indexOf(left);
    const rightIndex = preferenceOrder.indexOf(right);
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.localeCompare(right, "nl");
  });
}

export function buildColumns(rows) {
  const keys = new Set();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!key.startsWith("__")) keys.add(key);
    });
  });

  const orderedKeys = orderKeysByPreference(Array.from(keys), PREFERRED_COLUMN_ORDER);
  return orderedKeys.map((key) => ({
    key,
    label: key,
    sortable: true,
    minWidth: "140px",
    widthWeight: 1,
    type: inferColumnType(rows, key),
  }));
}

export function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    ...row,
    "Voorstel ander deadline":
      row?.["Voorstel ander deadline"] === "{\"xp\":0,\"cnt\":0}" ? "" : row?.["Voorstel ander deadline"],
    __row_id: row?.__row_id || row?.id || `row_${index + 1}`,
  }));
}

export function normalizePersistedOrder(columnOrder, availableKeys) {
  const normalized = Array.isArray(columnOrder)
    ? columnOrder.filter((key) => availableKeys.includes(key))
    : [];
  const missing = availableKeys.filter((key) => !normalized.includes(key));
  return [...normalized, ...missing];
}

export function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function getReportPickerId(userSegment) {
  return `${REPORT_PICKER_ID_PREFIX}-${String(userSegment || "anonymous")}`;
}

export async function ensureWritableDirectoryHandle(handle) {
  if (!handle) return false;
  const permissionOptions = { mode: "readwrite" };

  if (typeof handle.queryPermission === "function") {
    const currentPermission = await handle.queryPermission(permissionOptions);
    if (currentPermission === "granted") return true;
  }
  if (typeof handle.requestPermission === "function") {
    const requested = await handle.requestPermission(permissionOptions);
    return requested === "granted";
  }
  return false;
}

export function triggerBrowserDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName || "WordBee-rapportage.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
