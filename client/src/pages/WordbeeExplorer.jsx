import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson, postBlob, postJson } from "../api";
import ClientTable from "../components/ClientTable.jsx";
import { readTablePreferences, writeTablePreferences } from "../components/client-table/preferences.js";
import {
  getCachedDirectoryHandle,
  getCachedDirectoryName,
  getCurrentUserCacheSegment,
  setCachedDirectoryHandle,
  setCachedDirectoryName,
} from "../utils/reportDirectoryCache.js";
import {
  arraysEqual,
  buildColumns,
  DEFAULT_ROWS_PER_PAGE,
  ensureWritableDirectoryHandle,
  formatDuration,
  getReportPickerId,
  IMPORT_PHASES,
  MONTH_OPTIONS,
  normalizePersistedOrder,
  normalizeRows,
  orderKeysByPreference,
  PREFERRED_COLUMN_ORDER,
  TABLE_ID,
  toMessage,
  triggerBrowserDownload,
} from "./wordbee/wordbeeExplorerUtils.js";
import WordbeeComplaintModal from "./wordbee/WordbeeComplaintModal.jsx";

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function WordbeeExplorer() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const yearOptions = useMemo(
    () => Array.from({ length: 8 }, (_, index) => currentYear - 3 + index),
    [currentYear]
  );

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [savingComplaint, setSavingComplaint] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [reportDirectoryLabel, setReportDirectoryLabel] = useState("");
  const [loadedInfo, setLoadedInfo] = useState("");
  const [importStartedAt, setImportStartedAt] = useState(null);
  const [importElapsedSeconds, setImportElapsedSeconds] = useState(0);
  const [complaintModalState, setComplaintModalState] = useState({
    open: false,
    kenmerk: "",
    complaintText: "",
    complaintDate: getTodayIsoDate(),
    actionsTaken: "",
    resolvedDate: getTodayIsoDate(),
  });

  const columns = useMemo(() => buildColumns(rows), [rows]);
  const userCacheSegment = useMemo(() => getCurrentUserCacheSegment(), []);
  const reportPickerId = useMemo(() => getReportPickerId(userCacheSegment), [userCacheSegment]);

  const mergeRowsWithComplaints = useCallback((rawRows, complaints) => {
    const complaintsByKenmerk = new Map(
      (Array.isArray(complaints) ? complaints : [])
        .filter((item) => item?.kenmerk)
        .map((item) => [String(item.kenmerk).trim(), item])
    );
    return normalizeRows(rawRows).map((row) => {
      const complaint = complaintsByKenmerk.get(String(row?.Kenmerk || "").trim());
      return {
        ...row,
        __complaint_id: complaint?.id || null,
        __complaint_text: complaint?.complaintText || "",
        __complaint_date: complaint?.complaintDate || "",
        __complaint_actions_taken: complaint?.actionsTaken || "",
        __complaint_resolved_date: complaint?.resolvedDate || "",
        __complaint_updated_at: complaint?.updatedAt || null,
        Klacht: complaint?.complaintText || "",
      };
    });
  }, []);

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    setLoadedInfo("");
    try {
      const [rowsPayload, complaintsPayload] = await Promise.all([
        getJson("/wordbee/imported-rows"),
        getJson("/wordbee/complaints"),
      ]);
      const mergedRows = mergeRowsWithComplaints(rowsPayload?.rows || [], complaintsPayload?.complaints || []);
      setRows(mergedRows);
      setLoadedInfo(`${mergedRows.length} regels geladen (alle periodes).`);
    } catch (loadError) {
      setRows([]);
      setError(toMessage(loadError));
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);
  useEffect(() => {
    setReportDirectoryLabel(getCachedDirectoryName(userCacheSegment));
  }, [userCacheSegment]);
  useEffect(() => {
    if (!importing || !importStartedAt) return undefined;
    const intervalId = window.setInterval(() => {
      setImportElapsedSeconds(Math.max(0, Math.floor((Date.now() - importStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [importing, importStartedAt]);

  useEffect(() => {
    window.openWordbeeComplaint = (rowId, rowData) => {
      const kenmerk = String(rowData?.Kenmerk || "").trim();
      setComplaintModalState({
        open: true,
        kenmerk,
        complaintText: String(rowData?.__complaint_text || ""),
        complaintDate: String(rowData?.__complaint_date || getTodayIsoDate()),
        actionsTaken: String(rowData?.__complaint_actions_taken || ""),
        resolvedDate: String(rowData?.__complaint_resolved_date || getTodayIsoDate()),
      });
    };
    return () => {
      delete window.openWordbeeComplaint;
    };
  }, []);

  const handleGenerate = async () => {
    setImporting(true);
    setImportStartedAt(Date.now());
    setImportElapsedSeconds(0);
    setError("");
    setStatus("API-data ophalen gestart...");
    try {
      const payload = await postJson("/wordbee/import-period", {
        year: Number(selectedYear),
        month: Number(selectedMonth),
      });
      const sync = payload?.sync || {};
      const periodTag = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      const warning = payload?.mayBeIncomplete
        ? ` Let op: snelle scan gebruikt (${payload?.scanLimit || 0} projecten), mogelijk niet volledig.`
        : "";
      setStatus(
        `API-data ${periodTag} opgehaald. Nieuw: ${sync.inserted || 0}, bijgewerkt: ${sync.updated || 0}, ongewijzigd: ${sync.unchanged || 0}.${warning}`
      );
      await loadRows();
    } catch (importError) {
      setStatus("");
      setError(toMessage(importError));
    } finally {
      setImporting(false);
      setImportStartedAt(null);
    }
  };

  const handleGenerateReportPdf = async () => {
    setReportGenerating(true);
    setError("");
    setReportStatus("PDF rapport wordt gegenereerd...");
    try {
      const response = await postBlob("/wordbee/report-pdf", {
        year: Number(selectedYear),
        month: Number(selectedMonth),
      });
      const blob = response?.blob;
      const fileName = response?.fileName || `Voorbeeldrapportage-opdrachtgever-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.pdf`;
      if (!(blob instanceof Blob)) {
        throw new Error("Leeg rapport ontvangen.");
      }

      if (!("showDirectoryPicker" in window)) {
        triggerBrowserDownload(blob, fileName);
        setReportStatus(`PDF gedownload als ${fileName}.`);
        return;
      }

      let directoryHandle = await getCachedDirectoryHandle(userCacheSegment);
      if (directoryHandle) {
        const hasPermission = await ensureWritableDirectoryHandle(directoryHandle);
        if (!hasPermission) directoryHandle = null;
      }

      if (!directoryHandle) {
        directoryHandle = await window.showDirectoryPicker({
          id: reportPickerId,
          mode: "readwrite",
        });
        if (!directoryHandle) {
          setReportStatus("Opslaan geannuleerd.");
          return;
        }
        await setCachedDirectoryHandle(userCacheSegment, directoryHandle);
      }

      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      const directoryName = String(directoryHandle.name || "").trim();
      if (directoryName) {
        setCachedDirectoryName(userCacheSegment, directoryName);
        setReportDirectoryLabel(directoryName);
      }
      setReportStatus(`PDF opgeslagen als ${fileName}${directoryName ? ` in map '${directoryName}'` : ""}.`);
    } catch (reportError) {
      if (reportError?.name === "AbortError") {
        setReportStatus("Opslaan geannuleerd.");
      } else {
        setReportStatus("");
        setError(toMessage(reportError));
      }
    } finally {
      setReportGenerating(false);
    }
  };
  const importPhaseIndex = Math.min(Math.floor(importElapsedSeconds / 12), IMPORT_PHASES.length - 1);
  const activeImportPhase = IMPORT_PHASES[importPhaseIndex];
  const tableId = TABLE_ID;

  const handleComplaintSave = useCallback(async (event) => {
    event.preventDefault();
    if (!complaintModalState.kenmerk) return;
    setSavingComplaint(true);
    setError("");
    try {
      const payload = await postJson("/wordbee/complaints", {
        kenmerk: complaintModalState.kenmerk,
        complaintText: complaintModalState.complaintText,
        complaintDate: complaintModalState.complaintDate,
        actionsTaken: complaintModalState.actionsTaken,
        resolvedDate: complaintModalState.resolvedDate,
      });
      const savedComplaint = payload?.complaint || null;
      setRows((previousRows) =>
        previousRows.map((row) => {
          if (String(row?.Kenmerk || "").trim() !== complaintModalState.kenmerk) {
            return row;
          }
          return {
            ...row,
            __complaint_id: savedComplaint?.id || null,
            __complaint_text: savedComplaint?.complaintText || "",
            __complaint_date: savedComplaint?.complaintDate || "",
            __complaint_actions_taken: savedComplaint?.actionsTaken || "",
            __complaint_resolved_date: savedComplaint?.resolvedDate || "",
            __complaint_updated_at: savedComplaint?.updatedAt || null,
            Klacht: savedComplaint?.complaintText || "",
          };
        })
      );
      setComplaintModalState({
        open: false,
        kenmerk: "",
        complaintText: "",
        complaintDate: getTodayIsoDate(),
        actionsTaken: "",
        resolvedDate: getTodayIsoDate(),
      });
      setStatus(savedComplaint ? "Klacht opgeslagen." : "Klacht verwijderd.");
    } catch (saveError) {
      setError(`Opslaan van klacht mislukt: ${toMessage(saveError)}`);
    } finally {
      setSavingComplaint(false);
    }
  }, [complaintModalState]);

  useEffect(() => {
    if (!columns.length) return;
    const preferences = readTablePreferences(tableId);
    if (!preferences || !Array.isArray(preferences.columnOrder)) return;
    const availableKeys = columns.map((column) => column.key);
    const normalizedPersisted = normalizePersistedOrder(preferences.columnOrder, availableKeys);
    const oldDefaultOrderWithoutKenmerkFirst = orderKeysByPreference(availableKeys, [
      ...PREFERRED_COLUMN_ORDER.filter((key) => key !== "Kenmerk"),
      "Kenmerk",
    ]);
    if (!arraysEqual(normalizedPersisted, oldDefaultOrderWithoutKenmerkFirst)) return;
    const newDefaultOrder = orderKeysByPreference(availableKeys, PREFERRED_COLUMN_ORDER);
    writeTablePreferences(tableId, {
      ...preferences,
      columnOrder: newDefaultOrder,
    });
  }, [columns, tableId]);

  return (
    <div className="page-container wordbee-page">
      <div className="wordbee-grid">
        <section className="wordbee-card wordbee-card-wide">
          <h3 className="wordbee-title">WordBee API</h3>
          <div className="wordbee-actions">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              disabled={importing}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
              disabled={importing}
            >
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={importing}>
              {importing ? "Ophalen..." : "API-data ophalen"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleGenerateReportPdf}
              disabled={importing || reportGenerating}
            >
              {reportGenerating ? "PDF genereren..." : "Genereer PDF rapport"}
            </button>
          </div>
          <p className="wordbee-muted">
            Er wordt altijd het hele jaar opgehaald t/m de gekozen maand. Bestaande handmatige klachten blijven gekoppeld.
          </p>
          {reportDirectoryLabel && (
            <p className="wordbee-muted">PDF-map: {reportDirectoryLabel}</p>
          )}
          {importing && (
            <div className="wordbee-progress" role="status" aria-live="polite">
              <div className="wordbee-progress-header">
                <span>{activeImportPhase}</span>
                <span>{formatDuration(importElapsedSeconds)}</span>
              </div>
              <div className="wordbee-progress-track">
                <div className="wordbee-progress-bar" />
              </div>
            </div>
          )}
          {status && <p className="wordbee-success">{status}</p>}
          {reportStatus && <p className="wordbee-info">{reportStatus}</p>}
          {loadedInfo && <p className="wordbee-info">{loadedInfo}</p>}
          {error && <p className="wordbee-error">{error}</p>}
        </section>

        <section className="wordbee-card wordbee-card-wide">
          <h3 className="wordbee-title">WordBee Tabel</h3>
          {loadingRows ? (
            <p className="wordbee-muted">Data laden...</p>
          ) : !rows.length ? (
            <p className="wordbee-muted">Nog geen regels beschikbaar. Klik op API-data ophalen.</p>
          ) : (
            <ClientTable
              tableId={tableId}
              title=""
              columns={columns}
              data={rows}
              actions={[
                { type: "edit", label: "Klacht beheren", icon: "comment", onClick: "openWordbeeComplaint" },
              ]}
              enableColumnFilters
              exportEnabled
              searchEnabled
              rowsPerPage={DEFAULT_ROWS_PER_PAGE}
              horizontalScroll="auto"
              actionsColumnWidth={96}
              enableColumnCustomization
              noDataMessage="Geen data beschikbaar."
            />
          )}
        </section>
      </div>
      <WordbeeComplaintModal
        open={complaintModalState.open}
        title="Klacht bij Kenmerk"
        kenmerk={complaintModalState.kenmerk}
        complaintText={complaintModalState.complaintText}
        complaintDate={complaintModalState.complaintDate}
        actionsTaken={complaintModalState.actionsTaken}
        resolvedDate={complaintModalState.resolvedDate}
        saving={savingComplaint}
        onClose={() =>
          setComplaintModalState({
            open: false,
            kenmerk: "",
            complaintText: "",
            complaintDate: getTodayIsoDate(),
            actionsTaken: "",
            resolvedDate: getTodayIsoDate(),
          })
        }
        onComplaintTextChange={(value) =>
          setComplaintModalState((previousState) => ({ ...previousState, complaintText: value }))
        }
        onComplaintDateChange={(value) =>
          setComplaintModalState((previousState) => ({ ...previousState, complaintDate: value }))
        }
        onActionsTakenChange={(value) =>
          setComplaintModalState((previousState) => ({ ...previousState, actionsTaken: value }))
        }
        onResolvedDateChange={(value) =>
          setComplaintModalState((previousState) => ({ ...previousState, resolvedDate: value }))
        }
        onSubmit={handleComplaintSave}
      />
    </div>
  );
}
