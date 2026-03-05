function createBootstrapService({
  db,
  auth,
  crypto,
  config,
  readCookie,
  setCsrfCookie,
  csrfCookieName,
  defaultSettings,
  hasLocalAuth,
  hasMicrosoftAuth,
  sidebarHeaderWhiteFlag,
  autoLoginFlagNames,
  autoLoginMasterFlag,
  autoLoginAdminFlag,
  autoLoginUserFlag,
  loadPermissions,
}) {
  async function loadFeatureFlags(flagNames) {
    if (!flagNames?.length || !config.db.server) return {};
    const pool = await db.getPool();
    const request = pool.request();
    const placeholders = flagNames.map((flagName, index) => {
      const key = `flag_${index}`;
      request.input(key, flagName);
      return `@${key}`;
    });
    const result = await request.query(`
      IF OBJECT_ID('dbo.vw_feature_flags','V') IS NOT NULL
        SELECT flag_name, enabled
        FROM dbo.vw_feature_flags
        WHERE flag_name IN (${placeholders.join(", ")})
      ELSE IF OBJECT_ID('dbo.tbl_feature_flags','U') IS NOT NULL
        SELECT flag_name, enabled
        FROM dbo.tbl_feature_flags
        WHERE flag_name IN (${placeholders.join(", ")})
      ELSE
        SELECT CAST(NULL AS NVARCHAR(120)) AS flag_name, CAST(0 AS BIT) AS enabled WHERE 1 = 0
    `);
    return result.recordset.reduce((acc, row) => {
      acc[row.flag_name] = Boolean(row.enabled);
      return acc;
    }, {});
  }

  async function buildAppFeatureFlags() {
    const defaults = {
      enableUserSettings: process.env.FEATURE_ENABLE_USER_SETTINGS === "1",
      enableUserProfile: process.env.FEATURE_ENABLE_USER_PROFILE !== "0",
      sidebarHeaderWhite: false,
    };
    try {
      const flags = await loadFeatureFlags([sidebarHeaderWhiteFlag]);
      return {
        ...defaults,
        sidebarHeaderWhite: Boolean(flags[sidebarHeaderWhiteFlag]),
      };
    } catch {
      return defaults;
    }
  }

  async function resolveAutoLoginTarget() {
    const flags = await loadFeatureFlags(autoLoginFlagNames);
    if (!flags[autoLoginMasterFlag]) return null;
    if (flags[autoLoginAdminFlag]) {
      return { email: config.autoLoginAdminEmail, type: "admin" };
    }
    if (flags[autoLoginUserFlag]) {
      return { email: config.autoLoginUserEmail, type: "user" };
    }
    return null;
  }

  async function ensureAutoLoginSession(req, res) {
    const target = await resolveAutoLoginTarget();
    if (!target?.email) return null;
    const pool = await db.getPool();
    const request = pool.request();
    request.input("email", target.email.trim().toLowerCase());
    const result = await request.query(`
      SELECT TOP 1 user_id,
                   username,
                   email,
                   voornaam,
                   achternaam,
                   role,
                   is_super_admin
      FROM dbo.tbl_users
      WHERE email = @email
    `);
    const user = result.recordset[0];
    if (!user) return null;

    const sessionId = await auth.createSessionForUser(user.user_id);
    const cookieValue = auth.createSignedSession(sessionId);
    res.cookie(auth.SESSION_COOKIE, cookieValue, auth.buildSessionCookieOptions());
    if (config.csrfEnabled && !readCookie(req, csrfCookieName)) {
      setCsrfCookie(res, crypto.randomBytes(24).toString("base64url"));
    }
    const update = pool.request();
    update.input("user_id", user.user_id);
    await update.query("UPDATE dbo.tbl_users SET last_login = SYSDATETIME() WHERE user_id = @user_id");
    return { sessionId, user, type: target.type };
  }

  async function fetchUserSettings(userId) {
    const pool = await db.getPool();
    const request = pool.request();
    request.input("user_id", userId);
    const result = await request.query(
      "SELECT theme, display_mode, accent_color, accent_text_color, sidebar_variant, gradient_intensity FROM dbo.tbl_user_settings WHERE user_id = @user_id"
    );
    return { ...defaultSettings, ...(result.recordset[0] || {}) };
  }

  async function buildBootstrap(req, res) {
    const featureFlags = await buildAppFeatureFlags();
    const appSettings = {
      sidebarOrientation: "vertical",
      featureFlags,
      localAuthEnabled: hasLocalAuth,
      hasMicrosoftClient: hasMicrosoftAuth,
    };

    const fallbackTheme = {
      theme: defaultSettings.theme,
      accentColor: defaultSettings.accent_color,
      accentTextColor: defaultSettings.accent_text_color,
      sidebarVariant: defaultSettings.sidebar_variant,
      gradientIntensity: defaultSettings.gradient_intensity,
    };

    const bootstrap = {
      user: null,
      permissions: { allowedPaths: [], roles: [] },
      appSettings,
      themeSettings: fallbackTheme,
    };

    if (!config.db.server) {
      return bootstrap;
    }

    try {
      const session = await auth.getSessionUser(req);
      if (!session?.user) {
        const autoSession = await ensureAutoLoginSession(req, res);
        if (!autoSession?.user) {
          return bootstrap;
        }
        req.user = autoSession.user;
        req.sessionId = autoSession.sessionId;
      } else {
        req.user = session.user;
        req.sessionId = session.sessionId;
      }
      if (config.csrfEnabled && !readCookie(req, csrfCookieName)) {
        setCsrfCookie(res, crypto.randomBytes(24).toString("base64url"));
      }

      const permissions = await loadPermissions(req);
      const settings = await fetchUserSettings(req.user.user_id);

      bootstrap.user = {
        id: req.user.user_id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role || "user",
        is_super_admin: Boolean(req.user.is_super_admin),
      };
      bootstrap.permissions = permissions;
      bootstrap.themeSettings = {
        theme: settings.theme || defaultSettings.theme,
        accentColor: settings.accent_color || defaultSettings.accent_color,
        accentTextColor: settings.accent_text_color || defaultSettings.accent_text_color,
        sidebarVariant: settings.sidebar_variant || defaultSettings.sidebar_variant,
        gradientIntensity: Number.isFinite(settings.gradient_intensity)
          ? settings.gradient_intensity
          : defaultSettings.gradient_intensity,
      };

      return bootstrap;
    } catch (error) {
      return bootstrap;
    }
  }

  return {
    loadFeatureFlags,
    buildAppFeatureFlags,
    fetchUserSettings,
    buildBootstrap,
  };
}

module.exports = { createBootstrapService };
