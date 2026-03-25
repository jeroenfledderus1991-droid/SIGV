function registerAuthRoutes({
  app,
  db,
  auth,
  config,
  crypto,
  ensureDbConfigured,
  requireAuth,
  hasLocalAuth,
  hasMicrosoftAuth,
  buildAppRedirectUrl,
  buildMicrosoftAuthorizeUrl,
  setMicrosoftAuthCookie,
  clearMicrosoftAuthCookies,
  MICROSOFT_STATE_COOKIE,
  MICROSOFT_REDIRECT_COOKIE,
  readCookie,
  resolveMicrosoftRedirectUri,
  exchangeMicrosoftCodeForToken,
  verifyMicrosoftToken,
  getMicrosoftAccountEmail,
  setCsrfCookie,
  isProduction,
  loadPermissions,
  fetchUserSettings,
  DEFAULT_SETTINGS,
  normalizeTableTint,
  normalizeContainerTint,
  failedLoginAudit,
  supportAdminAllowlist,
}) {
  function requireLocalAuthEnabled(req, res, next) {
    if (!hasLocalAuth) {
      return res.status(501).json({ error: "Lokale login is uitgeschakeld." });
    }
    return next();
  }
  async function getFailedAttempts({ provider, identifier, ipAddress, windowMinutes }) {
    const count = await failedLoginAudit?.countRecentFailedAttempts?.({
      provider: provider || "local",
      identifier,
      ipAddress,
      windowMinutes,
    });
    return Number.isFinite(count) ? count : 0;
  }
  async function logCentralFailedLogin(req, { provider, identifier, failureReason, statusCode, metadata }) {
    try {
      await failedLoginAudit?.logFailedLoginAttempt?.({
        provider: provider || "local",
        identifier: identifier || null,
        ipAddress: (req.ip || "").trim(),
        userAgent: req.headers["user-agent"] || "",
        requestPath: req.path || "",
        httpMethod: req.method || "",
        failureReason: failureReason || "unknown",
        statusCode: Number.isInteger(statusCode) ? statusCode : 401,
        metadata: metadata && typeof metadata === "object" ? metadata : null,
      });
    } catch {}
  }
  app.get("/api/auth/microsoft/start", async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    if (!hasMicrosoftAuth) {
      return res.redirect(buildAppRedirectUrl(req, "/login", { auth_error: "Microsoft login is uitgeschakeld." }));
    }
    try {
      const { state, redirectUri, authorizeUrl } = buildMicrosoftAuthorizeUrl(req);
      setMicrosoftAuthCookie(res, MICROSOFT_STATE_COOKIE, state);
      setMicrosoftAuthCookie(res, MICROSOFT_REDIRECT_COOKIE, redirectUri);
      return res.redirect(authorizeUrl);
    } catch (error) {
      return res.redirect(
        buildAppRedirectUrl(req, "/login", { auth_error: "Kon Microsoft login niet starten." })
      );
    }
  });

  app.get("/api/auth/microsoft/callback", async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    const fail = async (message, failureReason = "microsoft_login_failed", metadata = null) => {
      await logCentralFailedLogin(req, {
        provider: "microsoft",
        identifier: null,
        failureReason,
        statusCode: 401,
        metadata,
      });
      clearMicrosoftAuthCookies(res);
      return res.redirect(buildAppRedirectUrl(req, "/login", { auth_error: message }));
    };
    if (!hasMicrosoftAuth) {
      return fail("Microsoft login is uitgeschakeld.");
    }
    const queryError = req.query?.error_description || req.query?.error;
    if (queryError) {
      return fail("Microsoft login is geannuleerd of mislukt.", "microsoft_cancelled");
    }

    const state = String(req.query?.state || "");
    const code = String(req.query?.code || "");
    const expectedState = readCookie(req, MICROSOFT_STATE_COOKIE);
    const redirectUri = readCookie(req, MICROSOFT_REDIRECT_COOKIE) || resolveMicrosoftRedirectUri(req);

    if (!state || !expectedState || state !== expectedState) {
      return fail("Ongeldige Microsoft login sessie. Probeer opnieuw.", "microsoft_invalid_state");
    }
    if (!code) {
      return fail("Microsoft login code ontbreekt.", "microsoft_code_missing");
    }

    try {
      const tokenResult = await exchangeMicrosoftCodeForToken(code, redirectUri);
      const idToken = tokenResult.id_token || "";
      if (!idToken) {
        return fail("Microsoft token ontbreekt.");
      }

      const tokenPayload = await verifyMicrosoftToken(idToken);
      const email = getMicrosoftAccountEmail(tokenPayload);
      if (!email) {
        return fail("Kon geen e-mailadres ophalen uit Microsoft account.");
      }

      const pool = await db.getPool();
      const user = await supportAdminAllowlist.ensureAllowlistedMicrosoftUser({
        appPool: pool,
        email,
        createPasswordHash: auth.createScryptHash,
      });
      if (!user) {
        return fail("Je Microsoft account is niet gekoppeld aan een gebruiker.");
      }

      const sessionId = await auth.createSessionForUser(user.user_id);
      const cookieValue = auth.createSignedSession(sessionId);
      res.cookie(auth.SESSION_COOKIE, cookieValue, auth.buildSessionCookieOptions());
      if (config.csrfEnabled) {
        setCsrfCookie(res, crypto.randomBytes(24).toString("base64url"));
      }

      const update = pool.request();
      update.input("user_id", user.user_id);
      await update.query("UPDATE dbo.tbl_users SET last_login = SYSDATETIME() WHERE user_id = @user_id");

      clearMicrosoftAuthCookies(res);
      return res.redirect(buildAppRedirectUrl(req, "/"));
    } catch (error) {
      console.error("Microsoft callback failed:", error);
      const detail = String(error?.message || "Onbekende fout");
      const message =
        isProduction
          ? "Microsoft login mislukt."
          : `Microsoft login mislukt: ${detail}`;
      return fail(message, "microsoft_callback_exception", { detail });
    }
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({
      id: req.user.user_id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role || "user",
      is_super_admin: Boolean(req.user.is_super_admin),
    });
  });

  app.get("/api/auth/permissions", requireAuth, async (req, res) => {
    try {
      const permissions = await loadPermissions(req);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to load permissions." });
    }
  });

  app.post("/api/auth/login", requireLocalAuthEnabled, async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    const identifier = (req.body?.identifier || "").trim().toLowerCase();
    const password = req.body?.password || "";

    if (!identifier || !password) {
      await logCentralFailedLogin(req, {
        provider: "local",
        identifier,
        failureReason: "missing_credentials",
        statusCode: 400,
      });
      return res.status(400).json({ error: "E-mailadres en wachtwoord zijn verplicht." });
    }

    try {
      const pool = await db.getPool();
      const rateWindowMinutes = 15;
      const maxAttempts = 5;
      const ipAddress = (req.ip || "").trim();
      const failedCount = await getFailedAttempts({
        provider: "local",
        identifier,
        ipAddress,
        windowMinutes: rateWindowMinutes,
      });
      if (failedCount >= maxAttempts) {
        await logCentralFailedLogin(req, {
          provider: "local",
          identifier,
          failureReason: "rate_limited",
          statusCode: 429,
          metadata: { failedCount, windowMinutes: rateWindowMinutes, maxAttempts },
        });
        return res.status(429).json({ error: "Te veel mislukte pogingen. Probeer later opnieuw." });
      }

      const request = pool.request();
      request.input("identifier", identifier);
      const result = await request.query(`
        SELECT TOP 1
               u.user_id,
               u.username,
               u.email,
               u.password_hash,
               r.role_naam AS role,
               u.is_super_admin
        FROM dbo.tbl_users u
        OUTER APPLY (
          SELECT TOP 1 ur.role_naam, ur.role_volgorde
          FROM dbo.vw_user_roles ur
          WHERE ur.user_id = u.user_id
          ORDER BY ur.role_volgorde
        ) r
        WHERE LOWER(u.email) = LOWER(@identifier)
      `);
      const user = result.recordset[0];
      if (!user || !auth.verifyScryptHash(password, user.password_hash)) {
        await logCentralFailedLogin(req, {
          provider: "local",
          identifier,
          failureReason: "invalid_credentials",
          statusCode: 401,
        });
        return res.status(401).json({ error: "Ongeldige inloggegevens." });
      }

      const sessionId = await auth.createSessionForUser(user.user_id);
      const cookieValue = auth.createSignedSession(sessionId);
      res.cookie(auth.SESSION_COOKIE, cookieValue, auth.buildSessionCookieOptions());
      if (config.csrfEnabled) {
        const csrfToken = crypto.randomBytes(24).toString("base64url");
        setCsrfCookie(res, csrfToken);
      }

      const update = pool.request();
      update.input("user_id", user.user_id);
      await update.query("UPDATE dbo.tbl_users SET last_login = SYSDATETIME() WHERE user_id = @user_id");

      let themeSettings = null;
      try {
        const settings = await fetchUserSettings(user.user_id);
        themeSettings = {
          theme: settings.theme || DEFAULT_SETTINGS.theme,
          accentColor: settings.accent_color || DEFAULT_SETTINGS.accent_color,
          accentTextColor: settings.accent_text_color || DEFAULT_SETTINGS.accent_text_color,
          sidebarVariant: settings.sidebar_variant || DEFAULT_SETTINGS.sidebar_variant,
          gradientIntensity: Number.isFinite(settings.gradient_intensity)
            ? settings.gradient_intensity
            : DEFAULT_SETTINGS.gradient_intensity,
          tableTint: normalizeTableTint(settings.table_tint, DEFAULT_SETTINGS.table_tint),
          containerTint: normalizeContainerTint(
            settings.container_tint,
            DEFAULT_SETTINGS.container_tint
          ),
        };
      } catch (error) {
        themeSettings = null;
      }

      return res.json({
        success: true,
        user: {
          id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role || "user",
          is_super_admin: Boolean(user.is_super_admin),
        },
        themeSettings,
      });
    } catch (error) {
      await logCentralFailedLogin(req, {
        provider: "local",
        identifier,
        failureReason: "login_exception",
        statusCode: 500,
      });
      return res.status(500).json({ error: "Inloggen mislukt." });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      const session = await auth.getSessionUser(req);
      if (session?.sessionId) {
        await auth.clearSession(session.sessionId);
      }
      const options = auth.buildSessionCookieOptions();
      res.clearCookie(auth.SESSION_COOKIE, {
        httpOnly: options.httpOnly,
        sameSite: options.sameSite,
        secure: options.secure,
        path: options.path,
      });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Uitloggen mislukt." });
    }
  });

  app.post("/api/auth/register", requireLocalAuthEnabled, async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    const username = (req.body?.username || "").trim();
    const email = (req.body?.email || "").trim();
    const password = req.body?.password || "";
    const voornaam = (req.body?.voornaam || "").trim();
    const achternaam = (req.body?.achternaam || "").trim();

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Vul alle verplichte velden in." });
    }

    try {
      const pool = await db.getPool();
      const rateWindowMinutes = 15;
      const maxAttempts = 5;
      const ipAddress = (req.ip || "").trim();
      const rateIdentifier = `register:${email.toLowerCase() || username.toLowerCase()}`;
      const failedCount = await getFailedAttempts({
        provider: "register",
        identifier: rateIdentifier,
        ipAddress,
        windowMinutes: rateWindowMinutes,
      });
      if (failedCount >= maxAttempts) {
        await logCentralFailedLogin(req, {
          provider: "register",
          identifier: rateIdentifier,
          failureReason: "rate_limited",
          statusCode: 429,
          metadata: { failedCount, windowMinutes: rateWindowMinutes, maxAttempts },
        });
        return res.status(429).json({ error: "Te veel pogingen. Probeer later opnieuw." });
      }

      const check = pool.request();
      check.input("username", username);
      check.input("email", email);
      const existing = await check.query(`
        SELECT TOP 1 user_id FROM dbo.tbl_users WHERE username = @username OR email = @email
      `);
      if (existing.recordset.length) {
        await logCentralFailedLogin(req, {
          provider: "register",
          identifier: rateIdentifier,
          failureReason: "user_exists",
          statusCode: 409,
        });
        return res.status(409).json({ error: "Gebruiker bestaat al." });
      }

      const passwordHash = auth.createScryptHash(password);
      const insert = pool.request();
      insert.input("username", username);
      insert.input("email", email);
      insert.input("password_hash", passwordHash);
      insert.input("voornaam", voornaam || null);
      insert.input("achternaam", achternaam || null);
      insert.input("role", "user");
      insert.input("is_super_admin", 0);
      await insert.query(`
        INSERT INTO dbo.tbl_users (username, email, password_hash, voornaam, achternaam, role, is_super_admin, created_at)
        VALUES (@username, @email, @password_hash, @voornaam, @achternaam, @role, @is_super_admin, GETDATE())
      `);

      return res.json({ success: true });
    } catch (error) {
      await logCentralFailedLogin(req, {
        provider: "register",
        identifier: `register:${email.toLowerCase() || username.toLowerCase()}`,
        failureReason: "register_exception",
        statusCode: 500,
      });
      return res.status(500).json({ error: "Registreren mislukt." });
    }
  });

  app.post("/api/auth/forgot-password", requireLocalAuthEnabled, async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    const identifier = (req.body?.identifier || "").trim().toLowerCase();
    if (!identifier) {
      return res.status(400).json({ error: "E-mailadres is verplicht." });
    }

    try {
      const rateWindowMinutes = 15;
      const maxAttempts = 5;
      const ipAddress = (req.ip || "").trim();
      const rateIdentifier = `forgot:${identifier}`;
      const pool = await db.getPool();
      const failedCount = await getFailedAttempts({
        provider: "forgot",
        identifier: rateIdentifier,
        ipAddress,
        windowMinutes: rateWindowMinutes,
      });
      if (failedCount >= maxAttempts) {
        await logCentralFailedLogin(req, {
          provider: "forgot",
          identifier: rateIdentifier,
          failureReason: "rate_limited",
          statusCode: 429,
          metadata: { failedCount, windowMinutes: rateWindowMinutes, maxAttempts },
        });
        return res.status(429).json({ error: "Te veel pogingen. Probeer later opnieuw." });
      }

      const token = crypto.randomBytes(24).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const request = pool.request();
      request.input("identifier", identifier);
      request.input("token", tokenHash);
      await request.query(`
        UPDATE dbo.tbl_users
        SET reset_token = @token,
            reset_token_expires = DATEADD(HOUR, 2, GETDATE())
        WHERE email = @identifier OR username = @identifier
      `);

      return res.json({ success: true });
    } catch (error) {
      await logCentralFailedLogin(req, {
        provider: "forgot",
        identifier: `forgot:${identifier}`,
        failureReason: "forgot_exception",
        statusCode: 500,
      });
      return res.status(500).json({ error: "Reset link genereren mislukt." });
    }
  });

  app.post("/api/auth/reset-password", requireLocalAuthEnabled, async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    const token = (req.body?.token || "").trim();
    const password = req.body?.password || "";
    if (!token || !password) {
      return res.status(400).json({ error: "Token en wachtwoord zijn verplicht." });
    }

    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const pool = await db.getPool();
      const lookup = pool.request();
      lookup.input("token", tokenHash);
      const result = await lookup.query(`
        SELECT TOP 1 user_id
        FROM dbo.tbl_users
        WHERE reset_token = @token AND reset_token_expires > GETDATE()
      `);
      const user = result.recordset[0];
      if (!user) {
        return res.status(400).json({ error: "Reset token is ongeldig of verlopen." });
      }

      const passwordHash = auth.createScryptHash(password);
      const update = pool.request();
      update.input("user_id", user.user_id);
      update.input("password_hash", passwordHash);
      await update.query(`
        UPDATE dbo.tbl_users
        SET password_hash = @password_hash,
            reset_token = NULL,
            reset_token_expires = NULL
        WHERE user_id = @user_id
      `);

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Wachtwoord resetten mislukt." });
    }
  });
}

module.exports = { registerAuthRoutes };
