import { useEffect, useMemo, useState } from "react";
import useThemeSettings from "../hooks/useThemeSettings";

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

export default function Settings() {
  const { settings, updateSettings } = useThemeSettings();
  const [accentInput, setAccentInput] = useState(settings.accentColor);

  useEffect(() => {
    setAccentInput(settings.accentColor);
  }, [settings.accentColor]);

  const showGradientControls = settings.sidebarVariant === "accent-gradient";
  const gradientValue = useMemo(() => Number(settings.gradientIntensity || 0), [settings.gradientIntensity]);

  const handleAccentChange = (value) => {
    const normalized = normalizeHex(value.trim());
    setAccentInput(normalized);
    if (isValidHex(normalized)) {
      updateSettings({ accentColor: normalized, accentTextColor: "#ffffff" });
    }
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
