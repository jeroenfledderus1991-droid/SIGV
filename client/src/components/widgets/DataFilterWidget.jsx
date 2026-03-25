import { useEffect, useMemo, useState } from "react";

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value, caseSensitive = false) {
  const text = String(value ?? "");
  return caseSensitive ? text : text.toLowerCase();
}

function resolveSearchableKeys(data, searchableKeys) {
  const explicitKeys = toSafeArray(searchableKeys).filter(Boolean);
  if (explicitKeys.length > 0) {
    return explicitKeys;
  }

  if (!Array.isArray(data) || data.length === 0 || !data[0] || typeof data[0] !== "object") {
    return [];
  }

  return Object.keys(data[0]);
}

function matchesByMode(haystack, needle, matchMode) {
  if (!needle) {
    return true;
  }

  if (matchMode === "startsWith") {
    return haystack.startsWith(needle);
  }

  if (matchMode === "exact") {
    return haystack === needle;
  }

  return haystack.includes(needle);
}

export function filterDataBySearchQuery(data, searchableKeys, query, { caseSensitive = false, matchMode } = {}) {
  const sourceData = toSafeArray(data);
  const normalizedQuery = normalizeText(query, caseSensitive).trim();
  if (!normalizedQuery) {
    return sourceData;
  }

  const keys = resolveSearchableKeys(sourceData, searchableKeys);
  if (keys.length === 0) {
    return sourceData.filter((row) =>
      normalizeText(JSON.stringify(row), caseSensitive).includes(normalizedQuery)
    );
  }

  return sourceData.filter((row) =>
    keys.some((key) => {
      const cellValue = row && typeof row === "object" ? row[key] : "";
      const normalizedValue = normalizeText(cellValue, caseSensitive);
      return matchesByMode(normalizedValue, normalizedQuery, matchMode);
    })
  );
}

export default function DataFilterWidget({
  data = [],
  searchableKeys = [],
  value,
  onChange,
  onFilteredDataChange,
  placeholder = "Zoeken...",
  className = "widget-data-filter-input",
  matchMode = "contains",
  minChars = 0,
  caseSensitive = false,
  showResultCount = true,
  disabled = false,
  id,
  name,
}) {
  const [internalQuery, setInternalQuery] = useState("");
  const isControlled = value !== undefined;
  const query = isControlled ? value : internalQuery;

  const filteredData = useMemo(() => {
    const rawQuery = String(query ?? "");
    if (rawQuery.trim().length < Number(minChars || 0)) {
      return toSafeArray(data);
    }

    return filterDataBySearchQuery(data, searchableKeys, rawQuery, {
      caseSensitive,
      matchMode,
    });
  }, [data, searchableKeys, query, caseSensitive, matchMode, minChars]);

  useEffect(() => {
    if (typeof onFilteredDataChange === "function") {
      onFilteredDataChange(filteredData);
    }
  }, [filteredData, onFilteredDataChange]);

  const handleQueryChange = (event) => {
    const nextQuery = event.target.value;
    if (!isControlled) {
      setInternalQuery(nextQuery);
    }
    if (typeof onChange === "function") {
      onChange(nextQuery);
    }
  };

  return (
    <div className="widget-data-filter">
      <div className="table-search widget-data-filter-search">
        <input
          id={id}
          name={name}
          type="text"
          value={query ?? ""}
          disabled={disabled}
          className={className}
          placeholder={placeholder}
          autoComplete="off"
          onChange={handleQueryChange}
        />
        <i className="fas fa-search search-icon" />
      </div>
      {showResultCount && (
        <span className="widget-data-filter-count">
          {filteredData.length}/{toSafeArray(data).length}
        </span>
      )}
    </div>
  );
}

