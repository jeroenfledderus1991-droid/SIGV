const MONTH_MAP = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maart: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  mei: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  aug: 8,
  augustus: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  october: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
const ALLOWED_OPS = new Set(["contains", "equals", "month"]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeMappedFilters(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      column: normalizeText(item?.column),
      op: ALLOWED_OPS.has(normalizeLower(item?.op)) ? normalizeLower(item?.op) : "contains",
      value: normalizeText(item?.value),
    }))
    .filter((item) => item.column && item.value);
}

function parseDateParts(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const dmy = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (dmy) {
    return { year: Number(dmy[3]), month: Number(dmy[2]) };
  }

  const ymd = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymd) {
    return { year: Number(ymd[1]), month: Number(ymd[2]) };
  }

  const ts = Date.parse(text);
  if (!Number.isFinite(ts)) return null;
  const date = new Date(ts);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function parseMonthCriteria(rawValue) {
  const text = normalizeLower(rawValue);
  if (!text) return null;

  const yearMonth = text.match(/^(\d{4})-(\d{1,2})$/);
  if (yearMonth) {
    const month = Number(yearMonth[2]);
    if (month >= 1 && month <= 12) return { year: Number(yearMonth[1]), month };
  }

  const monthYear = text.match(/^([a-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTH_MAP[monthYear[1]];
    if (month) return { year: Number(monthYear[2]), month };
  }

  const numericMonth = Number(text);
  if (Number.isFinite(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
    return { year: null, month: numericMonth };
  }

  const namedMonth = MONTH_MAP[text];
  if (namedMonth) return { year: null, month: namedMonth };
  return null;
}

function matchesFilter(row, filter) {
  const rowValue = normalizeText(row?.[filter.column]);
  const rowLower = normalizeLower(rowValue);
  const filterLower = normalizeLower(filter.value);

  if (filter.op === "equals") return rowLower === filterLower;
  if (filter.op === "month") {
    const criteria = parseMonthCriteria(filter.value);
    if (!criteria) return false;
    const dateParts = parseDateParts(rowValue);
    if (!dateParts) return false;
    if (criteria.year !== null && dateParts.year !== criteria.year) return false;
    return dateParts.month === criteria.month;
  }
  return rowLower.includes(filterLower);
}

function applyMappedFilters(rows, rawFilters) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const filters = normalizeMappedFilters(rawFilters);
  if (!filters.length) {
    return {
      rows: sourceRows,
      totalBeforeFilter: sourceRows.length,
      filtersApplied: [],
    };
  }
  const filteredRows = sourceRows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
  return {
    rows: filteredRows,
    totalBeforeFilter: sourceRows.length,
    filtersApplied: filters,
  };
}

module.exports = {
  applyMappedFilters,
  normalizeMappedFilters,
};
