import { useEffect, useMemo, useState } from "react";
import useThemeSettings from "../hooks/useThemeSettings";
import {
  CONTAINER_TINT_PRESETS,
  DEFAULT_CONTAINER_TINT,
  DEFAULT_TABLE_TINT,
  TABLE_TINT_PRESETS,
  isCustomTint,
  normalizeContainerTint,
  normalizeTableTint,
  resolveContainerTintSwatch,
  resolveTableTintSwatch,
} from "../tableTintPresets";

const DEFAULT_ACCENT = "#2c5f41";
const THEME_OPTIONS = [
  { value: "light", label: "Licht", icon: "fa-sun", demoClass: "light-demo" },
  { value: "dark", label: "Donker", icon: "fa-moon", demoClass: "dark-demo" },
  { value: "auto", label: "Auto", icon: "fa-adjust", demoClass: "auto-demo" },
];
const SIDEBAR_OPTIONS = [
  { value: "accent-gradient", label: "Gradient", icon: "fa-fill" },
  { value: "accent-solid", label: "Solide", icon: "fa-square" },
  { value: "white", label: "Wit", icon: "fa-border-all" },
];

function normalizeHex(value) {
  if (!value) return "";
  return value.startsWith("#") ? value : `#${value}`;
}

function isValidHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function getTintInputDefault(value, normalizeTint, resolveTintSwatch) {
  const normalized = normalizeTint(value);
  if (normalized.startsWith("#")) return normalized;
  return resolveTintSwatch(normalized);
}

export function SettingsView({ settings, updateSettings }) {
  const [accentInput, setAccentInput] = useState(settings.accentColor);
  const [tableTintInput, setTableTintInput] = useState(() =>
    getTintInputDefault(settings.tableTint || DEFAULT_TABLE_TINT, normalizeTableTint, resolveTableTintSwatch)
  );
  const [containerTintInput, setContainerTintInput] = useState(() =>
    getTintInputDefault(
      settings.containerTint || DEFAULT_CONTAINER_TINT,
      normalizeContainerTint,
      resolveContainerTintSwatch
    )
  );

  useEffect(() => {
    setAccentInput(settings.accentColor);
  }, [settings.accentColor]);

  useEffect(() => {
    setTableTintInput(
      getTintInputDefault(settings.tableTint || DEFAULT_TABLE_TINT, normalizeTableTint, resolveTableTintSwatch)
    );
  }, [settings.tableTint]);

  useEffect(() => {
    setContainerTintInput(
      getTintInputDefault(
        settings.containerTint || DEFAULT_CONTAINER_TINT,
        normalizeContainerTint,
        resolveContainerTintSwatch
      )
    );
  }, [settings.containerTint]);

  const showGradientControls = settings.sidebarVariant === "accent-gradient";
  const gradientValue = useMemo(() => Number(settings.gradientIntensity || 0), [settings.gradientIntensity]);
  const tableTintValue = normalizeTableTint(settings.tableTint || DEFAULT_TABLE_TINT);
  const containerTintValue = normalizeContainerTint(settings.containerTint || DEFAULT_CONTAINER_TINT);
  const tableTintIsCustom = isCustomTint(tableTintValue);
  const containerTintIsCustom = isCustomTint(containerTintValue);

  const normalizedTableTintInput = normalizeHex(tableTintInput.trim());
  const normalizedContainerTintInput = normalizeHex(containerTintInput.trim());
  const tableTintPickerValue = isValidHex(normalizedTableTintInput)
    ? normalizedTableTintInput
    : resolveTableTintSwatch(tableTintValue);
  const containerTintPickerValue = isValidHex(normalizedContainerTintInput)
    ? normalizedContainerTintInput
    : resolveContainerTintSwatch(containerTintValue);

  const handleAccentChange = (value) => {
    const normalized = normalizeHex(value.trim());
    setAccentInput(normalized);
    if (isValidHex(normalized)) {
      updateSettings({ accentColor: normalized, accentTextColor: "#ffffff" });
    }
  };

  const handleTableTintTextChange = (value) => {
    const normalized = normalizeHex(value.trim());
    setTableTintInput(value);
    if (isValidHex(normalized)) {
      setTableTintInput(normalized);
      updateSettings({ tableTint: normalized });
    }
  };

  const handleContainerTintTextChange = (value) => {
    const normalized = normalizeHex(value.trim());
    setContainerTintInput(value);
    if (isValidHex(normalized)) {
      setContainerTintInput(normalized);
      updateSettings({ containerTint: normalized });
    }
  };

  const resetTableTintInput = () => {
    const fallback = getTintInputDefault(
      settings.tableTint || DEFAULT_TABLE_TINT,
      normalizeTableTint,
      resolveTableTintSwatch
    );
    setTableTintInput(fallback);
  };

  const resetContainerTintInput = () => {
    const fallback = getTintInputDefault(
      settings.containerTint || DEFAULT_CONTAINER_TINT,
      normalizeContainerTint,
      resolveContainerTintSwatch
    );
    setContainerTintInput(fallback);
  };

  return (
    <div className="page-container settings-page">
      <div className="settings-container">
        <div className="settings-card">
          <div className="settings-row">
            <div className="setting-group">
              <div className="setting-header">
                <div className="setting-icon">
                  <i className="fas fa-palette" />
                </div>
                <h3 className="setting-title">Thema</h3>
              </div>
              <div className="setting-description">Kies het kleurenschema dat bij jou past</div>
              <div className="options-grid">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`option-card ${settings.theme === option.value ? "active" : ""}`}
                    onClick={() => updateSettings({ theme: option.value })}
                  >
                    <span className="option-icon">
                      <i className={`fas ${option.icon}`} />
                    </span>
                    <span className="option-title">{option.label}</span>
                    <span className={`theme-demo ${option.demoClass}`}>Preview</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group full-width">
              <div className="setting-header">
                <div className="setting-icon">
                  <i className="fas fa-eye-dropper" />
                </div>
                <h3 className="setting-title">Accentkleur</h3>
              </div>
              <div className="setting-description">Kies een primaire accentkleur voor knoppen en highlights</div>
              <div className="accent-row">
                <input
                  className="accent-color-picker"
                  type="color"
                  value={settings.accentColor}
                  onChange={(event) => handleAccentChange(event.target.value)}
                />
                <div className="accent-inputs">
                  <div className="accent-input-row">
                    <input
                      className="accent-hex-input"
                      type="text"
                      value={accentInput}
                      maxLength={7}
                      onChange={(event) => handleAccentChange(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => updateSettings({ accentColor: DEFAULT_ACCENT, accentTextColor: "#ffffff" })}
                    >
                      Reset
                    </button>
                  </div>
                  <small className="accent-help">Hex formaat (#RRGGBB)</small>
                </div>
              </div>

              <div className="setting-divider" />

              <div className="setting-header compact">
                <div className="setting-icon">
                  <i className="fas fa-table" />
                </div>
                <h3 className="setting-title">Tabelkleur</h3>
              </div>
              <div className="setting-description compact">
                Kies een zachte achtergrondkleur voor standaard overzichten
              </div>
              <div className="options-grid table-tint-grid">
                {TABLE_TINT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`option-card table-tint-option ${
                      tableTintValue === preset.value ? "active" : ""
                    }`}
                    onClick={() => {
                      updateSettings({ tableTint: preset.value });
                      setTableTintInput(resolveTableTintSwatch(preset.value));
                    }}
                  >
                    <span className="table-tint-swatch" style={{ backgroundColor: preset.swatch }} />
                    <span className="option-title">{preset.label}</span>
                  </button>
                ))}
              </div>
              <div className={`table-tint-custom ${tableTintIsCustom ? "active" : ""}`}>
                <div className="table-tint-custom-label">Eigen tabelkleur</div>
                <div className="table-tint-custom-controls">
                  <input
                    className="table-tint-custom-picker"
                    type="color"
                    value={tableTintPickerValue}
                    onChange={(event) => {
                      const normalized = normalizeHex(event.target.value);
                      setTableTintInput(normalized);
                      updateSettings({ tableTint: normalized });
                    }}
                  />
                  <input
                    className="table-tint-custom-input"
                    type="text"
                    value={tableTintInput}
                    maxLength={7}
                    onChange={(event) => handleTableTintTextChange(event.target.value)}
                    onBlur={resetTableTintInput}
                    placeholder="#RRGGBB"
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      updateSettings({ tableTint: DEFAULT_TABLE_TINT });
                      setTableTintInput(resolveTableTintSwatch(DEFAULT_TABLE_TINT));
                    }}
                  >
                    Standaard
                  </button>
                </div>
              </div>

              <div className="setting-divider" />

              <div className="setting-header compact">
                <div className="setting-icon">
                  <i className="fas fa-square-full" />
                </div>
                <h3 className="setting-title">Containerkleur</h3>
              </div>
              <div className="setting-description compact">
                Kies een zachte kleur voor kaarten en panelen in de app
              </div>
              <div className="options-grid table-tint-grid">
                {CONTAINER_TINT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`option-card table-tint-option ${
                      containerTintValue === preset.value ? "active" : ""
                    }`}
                    onClick={() => {
                      updateSettings({ containerTint: preset.value });
                      setContainerTintInput(resolveContainerTintSwatch(preset.value));
                    }}
                  >
                    <span className="table-tint-swatch" style={{ backgroundColor: preset.swatch }} />
                    <span className="option-title">{preset.label}</span>
                  </button>
                ))}
              </div>
              <div className={`table-tint-custom ${containerTintIsCustom ? "active" : ""}`}>
                <div className="table-tint-custom-label">Eigen containerkleur</div>
                <div className="table-tint-custom-controls">
                  <input
                    className="table-tint-custom-picker"
                    type="color"
                    value={containerTintPickerValue}
                    onChange={(event) => {
                      const normalized = normalizeHex(event.target.value);
                      setContainerTintInput(normalized);
                      updateSettings({ containerTint: normalized });
                    }}
                  />
                  <input
                    className="table-tint-custom-input"
                    type="text"
                    value={containerTintInput}
                    maxLength={7}
                    onChange={(event) => handleContainerTintTextChange(event.target.value)}
                    onBlur={resetContainerTintInput}
                    placeholder="#RRGGBB"
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      updateSettings({ containerTint: DEFAULT_CONTAINER_TINT });
                      setContainerTintInput(resolveContainerTintSwatch(DEFAULT_CONTAINER_TINT));
                    }}
                  >
                    Standaard
                  </button>
                </div>
              </div>

              <div className="setting-divider" />

              <div className="setting-header compact">
                <div className="setting-icon">
                  <i className="fas fa-columns" />
                </div>
                <h3 className="setting-title">Sidebar stijl</h3>
              </div>
              <div className="setting-description compact">Kies hoe de sidebar wordt weergegeven</div>
              <div className="options-grid">
                {SIDEBAR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`option-card ${settings.sidebarVariant === option.value ? "active" : ""}`}
                    onClick={() => updateSettings({ sidebarVariant: option.value })}
                  >
                    <span className="option-icon">
                      <i className={`fas ${option.icon}`} />
                    </span>
                    <span className="option-title">{option.label}</span>
                  </button>
                ))}
              </div>

              {showGradientControls && (
                <div className="gradient-container">
                  <div className="gradient-header">
                    <label className="gradient-label">Gradient intensiteit</label>
                    <span className="gradient-value">{gradientValue}%</span>
                  </div>
                  <input
                    className="gradient-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={gradientValue}
                    onChange={(event) => updateSettings({ gradientIntensity: Number(event.target.value) })}
                  />
                  <div className="gradient-scale">
                    <span>Licht</span>
                    <span>Donker</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="save-section">
            <span className="status-text">Wijzigingen worden automatisch opgeslagen</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { settings, updateSettings } = useThemeSettings();
  return <SettingsView settings={settings} updateSettings={updateSettings} />;
}
