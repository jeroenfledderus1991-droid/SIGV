import { useEffect, useMemo, useRef, useState } from "react";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesQuery(option, query, matchMode) {
  const label = normalizeText(option?.label);
  const needle = normalizeText(query);
  if (!needle) return true;
  if (matchMode === "startsWith") return label.startsWith(needle);
  return label.includes(needle);
}

export default function ComboboxPartialMatchingWidget({
  value,
  onChange,
  options = [],
  placeholder = "-- Selecteer --",
  required = false,
  disabled = false,
  className = "form-control",
  noResultsText = "Geen resultaten",
  maxResults = 250,
  matchMode = "contains",
  id,
  name,
}) {
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value]
  );

  useEffect(() => {
    setQuery(selectedOption?.label || "");
  }, [selectedOption?.label]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter((option) => matchesQuery(option, query, matchMode)).slice(0, maxResults);
  }, [options, query, matchMode, maxResults]);

  const selectOption = (option) => {
    onChange(String(option.value));
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleInputChange = (event) => {
    const next = event.target.value;
    setQuery(next);
    setOpen(true);
    setActiveIndex(-1);
    const exact = options.find((option) => normalizeText(option.label) === normalizeText(next));
    onChange(exact ? String(exact.value) : "");
  };

  const handleInputKeyDown = (event) => {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!filteredOptions.length) return;
      setActiveIndex((prev) => (prev + 1 >= filteredOptions.length ? 0 : prev + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!filteredOptions.length) return;
      setActiveIndex((prev) => (prev <= 0 ? filteredOptions.length - 1 : prev - 1));
      return;
    }
    if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      if (!filteredOptions.length) return;
      const nextIndex = activeIndex >= 0 ? activeIndex : 0;
      selectOption(filteredOptions[nextIndex]);
    }
  };

  return (
    <div ref={wrapperRef} className="partial-match-select">
      <input
        id={id}
        name={name}
        className={className === "form-select" ? "form-control" : className}
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
      />
      {required && <input type="hidden" value={value || ""} required readOnly />}
      {open && !disabled && (
        <div className="partial-match-select-menu" role="listbox">
          {filteredOptions.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className={`partial-match-select-option ${index === activeIndex ? "active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              {option.label}
            </button>
          ))}
          {!filteredOptions.length && <div className="partial-match-select-empty">{noResultsText}</div>}
        </div>
      )}
    </div>
  );
}
