function registerFeatureFlagRoutes({
  app,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
}) {
  app.get("/api/feature-flags", requireAuth, requirePermission("/feature-flags*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      const pool = await db.getPool();
      const result = await pool.request().query(`
        IF OBJECT_ID('dbo.vw_feature_flags','V') IS NOT NULL
          SELECT flag_name,
                 enabled,
                 page_key,
                 description
          FROM dbo.vw_feature_flags
          ORDER BY page_key, flag_name
        ELSE
          SELECT flag_name,
                 enabled,
                 page_key,
                 description
          FROM dbo.tbl_feature_flags
          ORDER BY page_key, flag_name
      `);
      const rows = result.recordset.map((row) => ({
        id: row.flag_name,
        name: row.flag_name,
        enabled: Boolean(row.enabled),
        page_key: row.page_key || "GLOBAL",
        description: row.description || "",
      }));
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to load feature flags." });
    }
  });

  app.post("/api/feature-flags/update", requireAuth, requirePermission("/feature-flags*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      const flagName = req.body?.id || req.body?.name;
      const enabled = req.body?.enabled ? 1 : 0;
      if (!flagName) {
        return res.status(400).json({ error: "Flag name is required." });
      }
      const pool = await db.getPool();
      const request = pool.request();
      request.input("flag_name", flagName);
      request.input("enabled", enabled);
      await request.query(`
        UPDATE dbo.tbl_feature_flags
        SET enabled = @enabled, updated_at = SYSDATETIME()
        WHERE flag_name = @flag_name
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update feature flag." });
    }
  });

  app.post("/api/feature-flags/save", requireAuth, requirePermission("/feature-flags*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      const flags = Array.isArray(req.body?.flags) ? req.body.flags : [];
      const pool = await db.getPool();
      for (const flag of flags) {
        if (!flag?.name) continue;
        const request = pool.request();
        request.input("flag_name", flag.name);
        request.input("enabled", flag.enabled ? 1 : 0);
        request.input("page_key", flag.page_key || "GLOBAL");
        request.input("description", flag.description || "");
        await request.query(`
          UPDATE dbo.tbl_feature_flags
          SET enabled = @enabled,
              page_key = @page_key,
              description = @description,
              updated_at = SYSDATETIME()
          WHERE flag_name = @flag_name
        `);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save feature flags." });
    }
  });

}

module.exports = { registerFeatureFlagRoutes };
