import { useEffect, useMemo, useRef, useState } from "react";

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value, caseSensitive = false) {
  const text = String(value ?? "").trim();
  return caseSensitive ? text : text.toLowerCase();
}

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function matchesQuery(label, query, { caseSensitive = false, matchMode = "contains" } = {}) {
  const haystack = normalizeText(label, caseSensitive);
  const needle = normalizeText(query, caseSensitive);
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

function buildSelectedLabel(selectedOptions, placeholder, selectedCountLabel) {
  if (selectedOptions.length === 0) {
    return placeholder;
  }
  if (selectedOptions.length <= 2) {
    return selectedOptions.map((option) => option.label).join(", ");
  }
  return selectedCountLabel.replace("{count}", String(selectedOptions.length));
}

export default function ComboboxMultiSelectFilterWidget({
  options = [],
  selectedValues = [],
  onChange,
  data = [],
  filterKey,
  onFilteredDataChange,
  placeholder = "Filter...",
  searchPlaceholder = "Zoek opties...",
  noResultsText = "Geen resultaten",
  selectedCountLabel = "{count} geselecteerd",
  className = "form-control",
  maxVisibleOptions = 250,
  showResultCount = true,
  disabled = false,
  caseSensitive = false,
  matchMode = "contains",
  id,
  name,
}) {
  const wrapperRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [optionQuery, setOptionQuery] = useState("");

  const normalizedSelectedValues = useMemo(
    () => toSafeArray(selectedValues).map((value) => normalizeValue(value)),
    [selectedValues]
  );

  const selectedSet = useMemo(() => new Set(normalizedSelectedValues), [normalizedSelectedValues]);

  const filteredOptions = useMemo(() => {
    return toSafeArray(options)
      .filter((option) => matchesQuery(option?.label ?? option?.value, optionQuery, { caseSensitive, matchMode }))
      .slice(0, Math.max(1, Number(maxVisibleOptions || 250)));
  }, [options, optionQuery, caseSensitive, matchMode, maxVisibleOptions]);

  const selectedOptions = useMemo(() => {
    return toSafeArray(options).filter((option) => selectedSet.has(normalizeValue(option?.value)));
  }, [options, selectedSet]);

  const triggerLabel = useMemo(
    () => buildSelectedLabel(selectedOptions, placeholder, selectedCountLabel),
    [selectedOptions, placeholder, selectedCountLabel]
  );

  const filteredData = useMemo(() => {
    const sourceData = toSafeArray(data);
    if (!filterKey || selectedSet.size === 0) {
      return sourceData;
    }

    return sourceData.filter((row) => selectedSet.has(normalizeValue(row?.[filterKey])));
  }, [data, filterKey, selectedSet]);

  useEffect(() => {
    if (typeof onFilteredDataChange === "function") {
      onFilteredDataChange(filteredData);
    }
  }, [filteredData, onFilteredDataChange]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const emitSelection = (nextValues) => {
    if (typeof onChange === "function") {
      onChange(nextValues);
    }
  };

  const toggleValue = (value) => {
    const normalized = normalizeValue(value);
    const nextSet = new Set(selectedSet);
    if (nextSet.has(normalized)) {
      nextSet.delete(normalized);
    } else {
      nextSet.add(normalized);
    }
    emitSelection(Array.from(nextSet));
  };

  const handleSelectAllVisible = () => {
    const nextSet = new Set(selectedSet);
    filteredOptions.forEach((option) => {
      nextSet.add(normalizeValue(option?.value));
    });
    emitSelection(Array.from(nextSet));
  };

  const handleClearAll = () => {
    emitSelection([]);
  };

  const allVisibleSelected =
    filteredOptions.length > 0 && filteredOptions.every((option) => selectedSet.has(normalizeValue(option?.value)));

  return (
    <div ref={wrapperRef} className="multi-filter-combobox">
      <button
        id={id}
        name={name}
        type="button"
        className={`multi-filter-combobox-trigger ${className === "form-select" ? "form-control" : className}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        title={triggerLabel}
      >
        <span className="multi-filter-combobox-label">{triggerLabel}</span>
        <i className={`fas ${isOpen ? "fa-chevron-up" : "fa-chevron-down"}`} />
      </button>

      {isOpen && !disabled && (
        <div className="multi-filter-combobox-menu">
          <div className="multi-filter-combobox-search">
            <input
              type="text"
              value={optionQuery}
              autoComplete="off"
              placeholder={searchPlaceholder}
              onChange={(event) => setOptionQuery(event.target.value)}
            />
            <i className="fas fa-search search-icon" />
          </div>

          <div className="multi-filter-combobox-actions">
            <button type="button" onClick={handleSelectAllVisible} disabled={allVisibleSelected}>
              Selecteer zichtbaar
            </button>
            <button type="button" onClick={handleClearAll} disabled={selectedSet.size === 0}>
              Reset
            </button>
          </div>

          <div className="multi-filter-combobox-options">
            {filteredOptions.map((option) => {
              const normalized = normalizeValue(option?.value);
              const checked = selectedSet.has(normalized);
              return (
                <label key={normalized} className="multi-filter-combobox-option">
                  <input type="checkbox" checked={checked} onChange={() => toggleValue(option?.value)} />
                  <span>{option?.label ?? normalized}</span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && <div className="multi-filter-combobox-empty">{noResultsText}</div>}
          </div>
        </div>
      )}

      {showResultCount && (
        <span className="multi-filter-combobox-count">
          {selectedSet.size} geselecteerd
          {filterKey ? ` • ${filteredData.length}/${toSafeArray(data).length} rijen` : ""}
        </span>
      )}
    </div>
  );
}

