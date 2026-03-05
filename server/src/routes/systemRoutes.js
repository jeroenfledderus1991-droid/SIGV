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
      const {
        theme = DEFAULT_SETTINGS.theme,
        display_mode = DEFAULT_SETTINGS.display_mode,
        accent_color = DEFAULT_SETTINGS.accent_color,
        accent_text_color = DEFAULT_SETTINGS.accent_text_color,
        sidebar_variant = DEFAULT_SETTINGS.sidebar_variant,
        gradient_intensity = DEFAULT_SETTINGS.gradient_intensity,
      } = req.body || {};
      const pool = await db.getPool();
      const request = pool.request();
      request.input("user_id", req.user.user_id);
      request.input("theme", theme);
      request.input("display_mode", display_mode);
      request.input("accent_color", accent_color);
      request.input("accent_text_color", accent_text_color);
      request.input("sidebar_variant", sidebar_variant);
      request.input("gradient_intensity", gradient_intensity);
      await request.query(`
        IF EXISTS (SELECT 1 FROM dbo.tbl_user_settings WHERE user_id = @user_id)
          UPDATE dbo.tbl_user_settings
          SET theme=@theme,
              display_mode=@display_mode,
              accent_color=@accent_color,
              accent_text_color=@accent_text_color,
              sidebar_variant=@sidebar_variant,
              gradient_intensity=@gradient_intensity
          WHERE user_id=@user_id
        ELSE
          INSERT INTO dbo.tbl_user_settings (user_id, theme, display_mode, accent_color, accent_text_color, sidebar_variant, gradient_intensity)
          VALUES (@user_id, @theme, @display_mode, @accent_color, @accent_text_color, @sidebar_variant, @gradient_intensity)
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save user settings." });
    }
  });
}

module.exports = { registerSystemRoutes };
