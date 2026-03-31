const { createWordbeeService } = require("../services/wordbeeService");
const { createWordbeeImportStoreService } = require("../services/wordbeeImportStoreService");
const { createWordbeeComplaintStoreService } = require("../services/wordbeeComplaintStoreService");
const { createWordbeeRawStoreService } = require("../services/wordbeeRawStoreService");
const { createWordbeePeriodRawTestService } = require("../services/wordbeePeriodRawTestService");
const { createWordbeeReportService } = require("../services/wordbeeReportService");

function isValidPeriod(year, month) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;
}

function registerWordbeeRoutes({
  app,
  config,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
}) {
  const wordbeeService = createWordbeeService(config);
  const importStore = createWordbeeImportStoreService({ db });
  const complaintStore = createWordbeeComplaintStoreService({ db });
  const rawStore = createWordbeeRawStoreService({ db });
  const rawTestService = createWordbeePeriodRawTestService({ wordbeeService, rawStore });
  const reportService = createWordbeeReportService();

  app.post("/api/wordbee/import-period", requireAuth, requirePermission("/settings*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    if (!wordbeeService.isConfigured()) {
      return res.status(400).json({ error: wordbeeService.getNotConfiguredError() });
    }
    const year = Number(req.body?.year);
    const month = Number(req.body?.month);
    if (!isValidPeriod(year, month)) {
      return res.status(400).json({ error: "Ongeldige periode." });
    }
    try {
      const importStartedAt = Date.now();
      const rawSync = await rawTestService.runPeriodRawTest(year, month);
      const mappedRows = await rawStore.getMappedRowsForPeriod(year, month);
      const syncResult = await importStore.upsertImportedRows(year, month, mappedRows || []);
      return res.status(200).json({
        ok: true,
        period: { year, month },
        sync: syncResult,
        complete: true,
        mappedRows: mappedRows.length,
        rawSync,
        durationMs: Date.now() - importStartedAt,
      });
    } catch (error) {
      return res.status(502).json({
        error: `WordBee import voor periode ${year}-${String(month).padStart(2, "0")} mislukt.`,
        details: error?.message || "Unknown error",
      });
    }
  });

  app.post("/api/wordbee/report-pdf", requireAuth, requirePermission("/settings*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    const year = Number(req.body?.year);
    const month = Number(req.body?.month);
    if (!isValidPeriod(year, month)) {
      return res.status(400).json({ error: "Ongeldige periode." });
    }
    try {
      const report = await reportService.generateReportPdf(year, month);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("X-Report-Filename", report.filename);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
      return res.sendFile(report.outputPath);
    } catch (error) {
      return res.status(500).json({
        error: "WordBee rapportage genereren mislukt.",
        details: error?.message || "Unknown error",
      });
    }
  });

  app.get("/api/wordbee/imported-rows", requireAuth, requirePermission("/settings*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      const data = await importStore.listRowsAll();
      return res.status(200).json({
        ok: true,
        count: data.count,
        rows: data.rows,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Ophalen van alle opgeslagen WordBee-rijen mislukt.",
        details: error?.message || "Unknown error",
      });
    }
  });

  app.get("/api/wordbee/complaints", requireAuth, requirePermission("/settings*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      const complaints = await complaintStore.listComplaints();
      return res.status(200).json({
        ok: true,
        count: complaints.length,
        complaints,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Ophalen van WordBee klachten mislukt.",
        details: error?.message || "Unknown error",
      });
    }
  });

  app.post("/api/wordbee/complaints", requireAuth, requirePermission("/settings*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      const complaint = await complaintStore.saveComplaint({
        kenmerk: req.body?.kenmerk,
        complaintText: req.body?.complaintText,
        complaintDate: req.body?.complaintDate,
        actionsTaken: req.body?.actionsTaken,
        resolvedDate: req.body?.resolvedDate,
        user: req.user,
      });
      return res.status(200).json({
        ok: true,
        complaint,
      });
    } catch (error) {
      return res.status(400).json({
        error: "Opslaan van WordBee klacht mislukt.",
        details: error?.message || "Unknown error",
      });
    }
  });

  app.get("/api/wordbee/imported-rows/:year/:month", requireAuth, requirePermission("/settings*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    const year = Number(req.params?.year);
    const month = Number(req.params?.month);
    if (!isValidPeriod(year, month)) {
      return res.status(400).json({ error: "Ongeldige periode." });
    }
    try {
      const data = await importStore.listRows(year, month);
      return res.status(200).json({
        ok: true,
        period: { year, month },
        count: data.count,
        rows: data.rows,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Ophalen van opgeslagen WordBee-rijen mislukt.",
        details: error?.message || "Unknown error",
      });
    }
  });

  app.put("/api/wordbee/imported-rows/:id", requireAuth, requirePermission("/settings*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    const rowId = Number(req.params?.id);
    if (!Number.isInteger(rowId) || rowId <= 0) {
      return res.status(400).json({ error: "Ongeldige row id." });
    }
    try {
      const saved = await importStore.saveManualRow(rowId, req.body?.row || {});
      return res.status(200).json({ ok: true, row: saved });
    } catch (error) {
      return res.status(500).json({
        error: "Opslaan van handmatige wijziging mislukt.",
        details: error?.message || "Unknown error",
      });
    }
  });
}

module.exports = { registerWordbeeRoutes };
