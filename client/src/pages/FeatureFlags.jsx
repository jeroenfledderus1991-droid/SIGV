import { useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "../api";

const CATEGORY_OPTIONS = [
  "SYSTEM",
  "SECURITY",
  "USER_MGMT",
  "APP_FEATURES",
  "PLANNING",
  "FEEDBACK",
  "CLIENT",
  "DEVELOPMENT",
  "EXPERIMENTAL",
  "INTEGRATIONS",
  "PERFORMANCE",
  "UI_UX",
  "GLOBAL",
];

export default function FeatureFlags() {
  const [flags, setFlags] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");

  const loadFlags = () => {
    getJson("/feature-flags").then(setFlags).catch(() => setFlags([]));
  };

  useEffect(() => {
    loadFlags();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("featureFlagsTab");
    if (stored) setActiveTab(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("featureFlagsTab", activeTab);
  }, [activeTab]);

  const groupedFlags = useMemo(() => {
    const grouped = flags.reduce((acc, flag) => {
      const key = flag.page_key || "GLOBAL";
      if (!acc[key]) acc[key] = [];
      acc[key].push(flag);
      return acc;
    }, {});
    return grouped;
  }, [flags]);

  const tabs = useMemo(() => {
    const keys = Object.keys(groupedFlags).sort();
    return ["ALL", ...keys];
  }, [groupedFlags]);

  const updateFlag = (name, updates) => {
    setFlags((prev) =>
      prev.map((flag) => (flag.name === name ? { ...flag, ...updates } : flag))
    );
  };

  const handleSave = async () => {
    const payload = activeTab === "ALL" ? flags : groupedFlags[activeTab] || [];
    await postJson("/feature-flags/save", { flags: payload });
    loadFlags();
  };

  return (
    <div className="page-container">
      <div className="card">
        <div className="card-header">Feature flags</div>
        <div className="card-body">
          <div className="ff-tab-bar" role="tablist">
            {tabs.map((key) => (
              <button
                key={key}
                type="button"
                className={`ff-tab ${activeTab === key ? "active" : ""}`}
                onClick={() => setActiveTab(key)}
                role="tab"
                aria-selected={activeTab === key}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="ff-panel">
            <div className="ff-tab-panel shown">
              <table className="ff-table">
                <thead>
                  <tr>
                    <th style={{ width: "80px" }}>Actief</th>
                    <th style={{ width: "220px" }}>Naam</th>
                    <th style={{ width: "150px" }}>Categorie</th>
                    <th>Omschrijving</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === "ALL" ? flags : groupedFlags[activeTab] || []).map((flag) => (
                    <tr key={flag.name}>
                      <td>
                        <label className="ff-switch">
                          <input
                            type="checkbox"
                            checked={Boolean(flag.enabled)}
                            onChange={(event) => updateFlag(flag.name, { enabled: event.target.checked })}
                          />
                          <span className="ff-slider" />
                        </label>
                      </td>
                      <td>
                        <code>{flag.name}</code>
                      </td>
                      <td>
                        <select
                          className="ff-select"
                          value={flag.page_key || "GLOBAL"}
                          onChange={(event) =>
                            updateFlag(flag.name, { page_key: event.target.value })
                          }
                        >
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="ff-input"
                          value={flag.description || ""}
                          onChange={(event) =>
                            updateFlag(flag.name, { description: event.target.value })
                          }
                          placeholder="Beschrijf wat deze feature flag doet..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "14px", marginTop: "18px" }}>
                <button type="button" className="btn btn-success" onClick={handleSave}>
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
