function toText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

const CLIENT_ERROR_IGNORE_PATTERNS = [
  "bootstrap-autofill-overlay.js",
  "autofillfielddata.autocompletetype is null",
  "-moz-osx-font-smoothing",
  "font-smooth",
  "regelset genegeerd vanwege foute selector",
  "request failed with 401",
  "ongeldige inloggegevens",
  "te veel mislukte pogingen",
  "csrf token mismatch",
];

function shouldIgnoreClientError({ message, stackTrace, sourceUrl }) {
  const haystack = `${toText(message)} ${toText(stackTrace)} ${toText(sourceUrl)}`.toLowerCase();
  if (!haystack) return true;
  if (/^(chrome|moz|safari)-extension:\/\//i.test(toText(sourceUrl))) return true;
  return CLIENT_ERROR_IGNORE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function registerSystemRoutes({
  app,
  config,
  db,
  ensureDbConfigured,
  requireAuth,
  requireMicrosoftAuth,
  buildBootstrap,
  buildAppFeatureFlags,
  hasLocalAuth,
  hasMicrosoftAuth,
  fetchUserSettings,
  DEFAULT_SETTINGS,
  normalizeTableTint,
  normalizeContainerTint,
  systemErrorAudit,
}) {
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: config.env });
  });

  app.get("/api/bootstrap", async (req, res) => {
    try {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.set("Surrogate-Control", "no-store");
      const bootstrap = await buildBootstrap(req, res);
      res.json(bootstrap);
    } catch (error) {
      res.status(500).json({ error: "Failed to load bootstrap." });
    }
  });

  app.get("/api/profile", requireAuth, (req, res) => {
    const user = req.user || {};
    const fullName = [user.voornaam, user.achternaam].filter(Boolean).join(" ").trim();
    res.json({
      id: user.user_id,
      username: user.username,
      email: user.email,
      name: fullName || user.username,
      role: user.role || "user",
      status: "Active",
    });
  });

  app.get("/api/secure/profile", requireMicrosoftAuth, (req, res) => {
    res.json({
      id: req.user?.oid || "user-001",
      name: req.user?.name || "Microsoft User",
      role: "Authenticated",
      status: "Active",
    });
  });

  app.get("/api/settings", async (req, res) => {
    const featureFlags = await buildAppFeatureFlags();
    res.json({
      sidebarOrientation: "vertical",
      featureFlags,
      localAuthEnabled: hasLocalAuth,
      hasMicrosoftClient: hasMicrosoftAuth,
    });
  });

  app.get("/api/db/health", async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;

    try {
      const row = await db.queryOne("SELECT 1 AS ok");
      res.json({ ok: row?.ok === 1 });
    } catch (error) {
      res.status(500).json({ error: "Database connection failed." });
    }
  });

  app.get("/api/db/info", async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;

    try {
      const row = await db.queryOne(
        "SELECT DB_NAME() AS databaseName, SUSER_SNAME() AS loginName, @@VERSION AS versionInfo"
      );
      res.json(row);
    } catch (error) {
      res.status(500).json({ error: "Database query failed." });
    }
  });

  app.get("/api/user-settings", requireAuth, async (req, res) => {
    try {
      const settings = await fetchUserSettings(req.user.user_id);
      res.json({ ...DEFAULT_SETTINGS, ...settings });
    } catch (error) {
      res.status(500).json({ error: "Failed to load user settings." });
    }
  });

  app.post("/api/user-settings", requireAuth, async (req, res) => {
    try {
      const payload = req.body || {};
      const {
        theme = DEFAULT_SETTINGS.theme,
        display_mode = DEFAULT_SETTINGS.display_mode,
        accent_color = DEFAULT_SETTINGS.accent_color,
        accent_text_color = DEFAULT_SETTINGS.accent_text_color,
        sidebar_variant = DEFAULT_SETTINGS.sidebar_variant,
        gradient_intensity = DEFAULT_SETTINGS.gradient_intensity,
      } = payload;
      const table_tint = payload.table_tint ?? payload.tableTint ?? DEFAULT_SETTINGS.table_tint;
      const container_tint = payload.container_tint ?? payload.containerTint ?? DEFAULT_SETTINGS.container_tint;
      const normalizedTableTint = normalizeTableTint(table_tint, DEFAULT_SETTINGS.table_tint);
      const normalizedContainerTint = normalizeContainerTint(
        container_tint,
        DEFAULT_SETTINGS.container_tint
      );
      const pool = await db.getPool();
      const request = pool.request();
      request.input("user_id", req.user.user_id);
      request.input("theme", theme);
      request.input("display_mode", display_mode);
      request.input("accent_color", accent_color);
      request.input("accent_text_color", accent_text_color);
      request.input("sidebar_variant", sidebar_variant);
      request.input("gradient_intensity", gradient_intensity);

      const columnsResult = await pool.request().query(`
        SELECT
          CASE WHEN COL_LENGTH('dbo.tbl_user_settings', 'table_tint') IS NULL THEN 0 ELSE 1 END AS has_table_tint,
          CASE WHEN COL_LENGTH('dbo.tbl_user_settings', 'container_tint') IS NULL THEN 0 ELSE 1 END AS has_container_tint
      `);
      const hasTableTint = Boolean(columnsResult.recordset[0]?.has_table_tint);
      const hasContainerTint = Boolean(columnsResult.recordset[0]?.has_container_tint);

      if (hasTableTint) {
        request.input("table_tint", normalizedTableTint);
      }
      if (hasContainerTint) {
        request.input("container_tint", normalizedContainerTint);
      }

      const tableTintUpdateSql = hasTableTint ? ",\n              table_tint=@table_tint" : "";
      const tableTintInsertColumns = hasTableTint ? ", table_tint" : "";
      const tableTintInsertValues = hasTableTint ? ", @table_tint" : "";
      const containerTintUpdateSql = hasContainerTint ? ",\n              container_tint=@container_tint" : "";
      const containerTintInsertColumns = hasContainerTint ? ", container_tint" : "";
      const containerTintInsertValues = hasContainerTint ? ", @container_tint" : "";

      await request.query(`
        IF EXISTS (SELECT 1 FROM dbo.tbl_user_settings WHERE user_id = @user_id)
          UPDATE dbo.tbl_user_settings
          SET theme=@theme,
              display_mode=@display_mode,
              accent_color=@accent_color,
              accent_text_color=@accent_text_color,
              sidebar_variant=@sidebar_variant,
              gradient_intensity=@gradient_intensity${tableTintUpdateSql}${containerTintUpdateSql}
          WHERE user_id=@user_id
        ELSE
          INSERT INTO dbo.tbl_user_settings (user_id, theme, display_mode, accent_color, accent_text_color, sidebar_variant, gradient_intensity${tableTintInsertColumns}${containerTintInsertColumns})
          VALUES (@user_id, @theme, @display_mode, @accent_color, @accent_text_color, @sidebar_variant, @gradient_intensity${tableTintInsertValues}${containerTintInsertValues})
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save user settings." });
    }
  });

  app.post("/api/system-errors/client", async (req, res) => {
    try {
      const payload = req.body || {};
      const message = toText(payload.message).slice(0, 1024);
      const stackTrace = toText(payload.stackTrace).slice(0, 4000);
      const sourceUrl = toText(payload.sourceUrl).slice(0, 1024);
      if (!message) {
        return res.status(400).json({ error: "Message is verplicht." });
      }
      if (shouldIgnoreClientError({ message, stackTrace, sourceUrl })) {
        return res.status(202).json({ logged: false, ignored: true });
      }

      const logged = await systemErrorAudit?.logErrorEvent?.({
        severity: "error",
        source: "client",
        category: toText(payload.category).slice(0, 80) || "client_error",
        message,
        stackTrace,
        requestPath: toText(payload.userPath || req.path).slice(0, 255),
        httpMethod: "CLIENT",
        statusCode: null,
        userId: Number.isInteger(req.user?.user_id) ? req.user.user_id : null,
        username: req.user?.username || null,
        ipAddress: (req.ip || "").trim(),
        userAgent: req.headers["user-agent"] || "",
        metadata: {
          sourceUrl,
          lineNumber: Number.isFinite(payload.lineNumber) ? payload.lineNumber : null,
          columnNumber: Number.isFinite(payload.columnNumber) ? payload.columnNumber : null,
          extra: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : null,
        },
      });
      return res.status(202).json({ logged: Boolean(logged) });
    } catch (error) {
      return res.status(202).json({ logged: false });
    }
  });
}

module.exports = { registerSystemRoutes };
