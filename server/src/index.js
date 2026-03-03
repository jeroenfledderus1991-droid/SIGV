const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const config = require("./config");
const db = require("./db");
const { requireMicrosoftAuth } = require("./microsoftAuth");
const auth = require("./auth");

const isProduction = (config.env || "").toLowerCase() === "production";
const SESSION_SECRET_MIN_LENGTH = 32;
const CSRF_COOKIE = "csrf_token";

const app = express();
app.set("etag", false);

const PAGE_PATTERNS = [
  { name: "Home", pattern: "/home*" },
  { name: "Accountbeheer", pattern: "/accounts*" },
  { name: "Rolbeheer", pattern: "/rollen*" },
  { name: "Stamgegevens Beheer", pattern: "/stamgegevens*" },
  { name: "Stamgegevens Admin", pattern: "/stamgegevens/admin*" },
  { name: "Feature flags", pattern: "/feature-flags*" },
  { name: "Instellingen", pattern: "/settings*" },
  { name: "Profiel", pattern: "/profiel*" },
];

const DEFAULT_SETTINGS = {
  theme: "light",
  display_mode: "full",
  accent_color: "#2c5f41",
  accent_text_color: "#ffffff",
  sidebar_variant: "accent-gradient",
  gradient_intensity: 30,
};
const AUTO_LOGIN_MASTER_FLAG = "ENABLE_AUTO_LOGINS";
const AUTO_LOGIN_ADMIN_FLAG = "ENABLE_ADMIN_AUTO_LOGIN";
const AUTO_LOGIN_USER_FLAG = "ENABLE_USER_AUTO_LOGIN";
const SIDEBAR_HEADER_WHITE_FLAG = "ENABLE_SIDEBAR_HEADER_WHITE";
const SUPER_ADMIN_ROLE_NAME = "Super Admin";
const EESA_SUPER_ADMIN_EMAIL = "eesa@admin.local";
const AUTO_LOGIN_FLAG_NAMES = [
  AUTO_LOGIN_MASTER_FLAG,
  AUTO_LOGIN_ADMIN_FLAG,
  AUTO_LOGIN_USER_FLAG,
];

const CLIENT_DIST_DIR = path.resolve(__dirname, "..", "..", "client", "dist");
const CLIENT_DIST_INDEX = path.join(CLIENT_DIST_DIR, "index.html");
const CLIENT_DEV_INDEX = path.resolve(__dirname, "..", "..", "client", "index.html");

const VITE_PORT = Number(process.env.VITE_PORT || 0);
const VITE_ORIGIN =
  process.env.VITE_ORIGIN ||
  (VITE_PORT ? `http://localhost:${VITE_PORT}` : config.corsOrigin || "");

async function ensureDbConfigured(res) {
  if (!config.db.server) {
    res.status(501).json({ error: "Database is not configured." });
    return false;
  }
  return true;
}

function buildCspHeader(nonce) {
  if (!isProduction) {
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' http: https: ws: wss:",
      "frame-ancestors 'self'",
      "object-src 'none'",
    ].join("; ");
  }
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' https:`,
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: http: ws: wss:",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ];
  return directives.join("; ");
}

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", buildCspHeader(res.locals.cspNonce));
  next();
});
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});
if (config.trustProxy) {
  app.set("trust proxy", 1);
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
  return cookies[name];
}

function setCsrfCookie(res, token) {
  const secure = isProduction;
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return fallback;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [44, 95, 65];
  return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
}

function mixWithBlack(hex, intensity) {
  const ratio = clamp(intensity, 0, 100) / 100;
  const boosted = Math.pow(ratio, 0.65);
  const [r, g, b] = hexToRgb(hex);
  const mixed = [r, g, b].map((value) => Math.round(value * (1 - boosted)));
  return `rgb(${mixed.join(",")})`;
}

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
    const flags = await loadFeatureFlags([SIDEBAR_HEADER_WHITE_FLAG]);
    return {
      ...defaults,
      sidebarHeaderWhite: Boolean(flags[SIDEBAR_HEADER_WHITE_FLAG]),
    };
  } catch {
    return defaults;
  }
}

async function resolveAutoLoginTarget() {
  const flags = await loadFeatureFlags(AUTO_LOGIN_FLAG_NAMES);
  if (!flags[AUTO_LOGIN_MASTER_FLAG]) return null;
  if (flags[AUTO_LOGIN_ADMIN_FLAG]) {
    return { email: config.autoLoginAdminEmail, type: "admin" };
  }
  if (flags[AUTO_LOGIN_USER_FLAG]) {
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
  if (config.csrfEnabled && !readCookie(req, CSRF_COOKIE)) {
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
  return { ...DEFAULT_SETTINGS, ...(result.recordset[0] || {}) };
}

async function buildBootstrap(req, res) {
  const featureFlags = await buildAppFeatureFlags();
  const appSettings = {
    sidebarOrientation: "vertical",
    featureFlags,
    hasMicrosoftClient: Boolean(config.microsoft.clientId),
  };

  const fallbackTheme = {
    theme: DEFAULT_SETTINGS.theme,
    accentColor: DEFAULT_SETTINGS.accent_color,
    accentTextColor: DEFAULT_SETTINGS.accent_text_color,
    sidebarVariant: DEFAULT_SETTINGS.sidebar_variant,
    gradientIntensity: DEFAULT_SETTINGS.gradient_intensity,
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
    if (config.csrfEnabled && !readCookie(req, CSRF_COOKIE)) {
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
      theme: settings.theme || DEFAULT_SETTINGS.theme,
      accentColor: settings.accent_color || DEFAULT_SETTINGS.accent_color,
      accentTextColor: settings.accent_text_color || DEFAULT_SETTINGS.accent_text_color,
      sidebarVariant: settings.sidebar_variant || DEFAULT_SETTINGS.sidebar_variant,
      gradientIntensity: Number.isFinite(settings.gradient_intensity)
        ? settings.gradient_intensity
        : DEFAULT_SETTINGS.gradient_intensity,
    };

    return bootstrap;
  } catch (error) {
    return bootstrap;
  }
}

function buildBootstrapMarkup(bootstrap, nonce) {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : "";
  const theme = bootstrap?.themeSettings?.theme || DEFAULT_SETTINGS.theme;
  const accentColor = normalizeHex(
    bootstrap?.themeSettings?.accentColor,
    DEFAULT_SETTINGS.accent_color
  );
  const accentTextColor = normalizeHex(
    bootstrap?.themeSettings?.accentTextColor,
    DEFAULT_SETTINGS.accent_text_color
  );
  const gradientIntensity = Number.isFinite(Number(bootstrap?.themeSettings?.gradientIntensity))
    ? clamp(Number(bootstrap.themeSettings.gradientIntensity), 0, 100)
    : DEFAULT_SETTINGS.gradient_intensity;
  const accentRgb = hexToRgb(accentColor);
  const sidebarAccentSecond = mixWithBlack(accentColor, gradientIntensity);
  const bootstrapJson = JSON.stringify(bootstrap).replace(/</g, "\\u003c");
  const themeJson = JSON.stringify(theme);

  return `
    <style id="bootstrap-theme"${nonceAttr}>
      :root {
        --accent-color: ${accentColor};
        --accent-color-rgb: ${accentRgb.join(",")};
        --accent-hover: ${accentColor}E6;
        --accent-text-color: ${accentTextColor};
        --sidebar-accent-second: ${sidebarAccentSecond};
      }
    </style>
    <script${nonceAttr}>
      window.__BOOTSTRAP__ = ${bootstrapJson};
      (function () {
        var theme = ${themeJson};
        var root = document.documentElement;
        root.dataset.theme = theme;
        root.classList.remove("theme-light", "theme-dark", "theme-auto");
        root.classList.add("theme-" + theme);
      })();
    </script>
  `;
}

function shouldProxyToVite(pathname) {
  return (
    pathname.startsWith("/@vite") ||
    pathname.startsWith("/@react-refresh") ||
    pathname.startsWith("/@id") ||
    pathname.startsWith("/@fs") ||
    pathname.startsWith("/src/") ||
    pathname.startsWith("/node_modules/") ||
    pathname.startsWith("/.vite/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/vite.svg"
  );
}

function proxyToVite(req, res) {
  if (!VITE_ORIGIN) {
    res.status(502).send("Vite dev server is not configured.");
    return;
  }

  const targetUrl = new URL(req.originalUrl, VITE_ORIGIN);
  const client = targetUrl.protocol === "https:" ? https : http;
  const proxyReq = client.request(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on("error", () => {
    res.status(502).send("Failed to reach Vite dev server.");
  });

  req.pipe(proxyReq, { end: true });
}

if (config.csrfEnabled) {
  app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();
    if (req.path.startsWith("/api/auth/login") || req.path.startsWith("/api/auth/register") ||
        req.path.startsWith("/api/auth/forgot-password") || req.path.startsWith("/api/auth/reset-password")) {
      return next();
    }
    const cookieToken = readCookie(req, CSRF_COOKIE);
    const headerToken = req.headers["x-csrf-token"];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ error: "CSRF token mismatch." });
    }
    return next();
  });
}

if (isProduction) {
  if (!config.sessionSecret || config.sessionSecret.length < SESSION_SECRET_MIN_LENGTH) {
    console.error("SESSION_SECRET must be set and at least 32 chars in production.");
    process.exit(1);
  }
}

async function requireAuth(req, res, next) {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const session = await auth.getSessionUser(req);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    req.user = session.user;
    req.sessionId = session.sessionId;
    if (config.csrfEnabled && !readCookie(req, CSRF_COOKIE)) {
      setCsrfCookie(res, crypto.randomBytes(24).toString("base64url"));
    }
    return next();
  } catch (error) {
    return res.status(500).json({ error: "Failed to validate session." });
  }
}

function matchPattern(pattern, path) {
  if (!pattern) return false;
  if (pattern === "*" || pattern === "ALL") return true;
  if (pattern.endsWith("*")) {
    const base = pattern.slice(0, -1);
    if (path === "/" && base === "/home") return true;
    return path.startsWith(base);
  }
  if (path === "/" && pattern === "/home") return true;
  return path === pattern;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isEesaSuperAdminEmail(value) {
  return normalizeEmail(value) === EESA_SUPER_ADMIN_EMAIL;
}

function isSuperAdminRoleName(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === SUPER_ADMIN_ROLE_NAME.toLowerCase();
}

async function getSuperAdminRoleId(pool) {
  const request = pool.request();
  request.input("role_name", SUPER_ADMIN_ROLE_NAME);
  const result = await request.query(`
    SELECT TOP 1 id
    FROM dbo.tbl_roles
    WHERE LOWER(naam) = LOWER(@role_name)
    ORDER BY id
  `);
  return Number(result.recordset[0]?.id) || null;
}

async function loadPermissions(req) {
  if (req.permissions) return req.permissions;
  if (req.user?.is_super_admin) {
    req.permissions = { allowedPaths: ["*"], roles: ["super_admin"] };
    return req.permissions;
  }

  const pool = await db.getPool();
  const roleSourceCte = `
    WITH user_role_ids AS (
      SELECT ur.role_id
      FROM dbo.tbl_user_roles ur
      WHERE ur.user_id = @user_id
      UNION
      SELECT r.id AS role_id
      FROM dbo.tbl_users u
      JOIN dbo.tbl_roles r ON LOWER(r.naam) = LOWER(ISNULL(u.role, ''))
      WHERE u.user_id = @user_id
    )
  `;

  const rolesRequest = pool.request();
  rolesRequest.input("user_id", req.user.user_id);
  const rolesResult = await rolesRequest.query(`
    ${roleSourceCte}
    SELECT DISTINCT r.naam
    FROM user_role_ids src
    JOIN dbo.tbl_roles r ON r.id = src.role_id
  `);
  const roles = rolesResult.recordset.map((row) => row.naam);

  const permRequest = pool.request();
  permRequest.input("user_id", req.user.user_id);
  const permResult = await permRequest.query(`
    ${roleSourceCte}
    SELECT DISTINCT rp.page
    FROM user_role_ids src
    JOIN dbo.tbl_role_permissions rp ON rp.role_id = src.role_id
    WHERE rp.allowed = 1
  `);
  const allowedPaths = permResult.recordset.map((row) => row.page);

  if (allowedPaths.some((path) => path === "*" || path === "ALL")) {
    req.permissions = { allowedPaths: ["*"], roles };
  } else {
    req.permissions = { allowedPaths, roles };
  }
  return req.permissions;
}

function requirePermission(pattern) {
  return async (req, res, next) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated." });
      }
      const permissions = await loadPermissions(req);
      const allowed = permissions.allowedPaths || [];
      if (!allowed.length) {
        return res.status(403).json({ error: "Geen toegang." });
      }
      const isAllowed =
        allowed.includes("*") ||
        allowed.includes("ALL") ||
        allowed.some((allowedPattern) => matchPattern(allowedPattern, pattern));
      if (!isAllowed) {
        return res.status(403).json({ error: "Geen toegang." });
      }
      return next();
    } catch (error) {
      return res.status(500).json({ error: "Failed to validate permissions." });
    }
  };
}

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
    hasMicrosoftClient: Boolean(config.microsoft.clientId),
  });
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

app.post("/api/auth/login", async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  const identifier = (req.body?.identifier || "").trim().toLowerCase();
  const password = req.body?.password || "";

  if (!identifier || !password) {
    return res.status(400).json({ error: "E-mailadres en wachtwoord zijn verplicht." });
  }

  try {
    const pool = await db.getPool();

    const rateWindowMinutes = 15;
    const maxAttempts = 5;
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";
    const rateCheck = pool.request();
    rateCheck.input("identifier", identifier);
    rateCheck.input("ip_address", ip);
    rateCheck.input("window_minutes", rateWindowMinutes);
    const rateResult = await rateCheck.query(`
      SELECT COUNT(*) AS failed_count
      FROM dbo.tbl_auth_attempts
      WHERE success = 0
        AND created_at > DATEADD(MINUTE, -@window_minutes, SYSDATETIME())
        AND (identifier = @identifier OR ip_address = @ip_address)
    `);
    const failedCount = rateResult.recordset[0]?.failed_count || 0;
    if (failedCount >= maxAttempts) {
      return res.status(429).json({ error: "Te veel mislukte pogingen. Probeer later opnieuw." });
    }

    const request = pool.request();
    request.input("identifier", identifier);
    const result = await request.query(`
      SELECT TOP 1 user_id, username, email, password_hash, role, is_super_admin
      FROM dbo.tbl_users
      WHERE email = @identifier
    `);
    const user = result.recordset[0];
    if (!user || !auth.verifyScryptHash(password, user.password_hash)) {
      const logFail = pool.request();
      logFail.input("identifier", identifier);
      logFail.input("success", 0);
      logFail.input("ip_address", ip);
      logFail.input("user_agent", req.headers["user-agent"]?.slice(0, 255) || "");
      await logFail.query(`
        INSERT INTO dbo.tbl_auth_attempts (identifier, success, ip_address, user_agent)
        VALUES (@identifier, @success, @ip_address, @user_agent)
      `);
      return res.status(401).json({ error: "Ongeldige inloggegevens." });
    }

    const sessionId = await auth.createSessionForUser(user.user_id);
    const cookieValue = auth.createSignedSession(sessionId);
    res.cookie(auth.SESSION_COOKIE, cookieValue, auth.buildSessionCookieOptions());
    if (config.csrfEnabled) {
      const csrfToken = crypto.randomBytes(24).toString("base64url");
      setCsrfCookie(res, csrfToken);
    }

    const logSuccess = pool.request();
    logSuccess.input("identifier", identifier);
    logSuccess.input("success", 1);
    logSuccess.input("ip_address", ip);
    logSuccess.input("user_agent", req.headers["user-agent"]?.slice(0, 255) || "");
    await logSuccess.query(`
      INSERT INTO dbo.tbl_auth_attempts (identifier, success, ip_address, user_agent)
      VALUES (@identifier, @success, @ip_address, @user_agent)
    `);

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

app.post("/api/auth/register", async (req, res) => {
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
    const check = pool.request();
    check.input("username", username);
    check.input("email", email);
    const existing = await check.query(`
      SELECT TOP 1 user_id FROM dbo.tbl_users WHERE username = @username OR email = @email
    `);
    if (existing.recordset.length) {
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
    return res.status(500).json({ error: "Registreren mislukt." });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  const identifier = (req.body?.identifier || "").trim().toLowerCase();
  if (!identifier) {
    return res.status(400).json({ error: "E-mailadres is verplicht." });
  }

  try {
    const token = crypto.randomBytes(24).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const pool = await db.getPool();
    const request = pool.request();
    request.input("identifier", identifier);
    request.input("token", tokenHash);
    await request.query(`
      UPDATE dbo.tbl_users
      SET reset_token = @token,
          reset_token_expires = DATEADD(HOUR, 24, GETDATE())
      WHERE email = @identifier OR username = @identifier
    `);

    const payload = { success: true };
    if (!isProduction) {
      payload.resetToken = token;
    }
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: "Reset link genereren mislukt." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
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
    const pool = await db.getPool();
    const request = pool.request();
    request.input("user_id", req.user.user_id);
    const result = await request.query(
      "SELECT theme, display_mode, accent_color, accent_text_color, sidebar_variant, gradient_intensity FROM dbo.tbl_user_settings WHERE user_id = @user_id"
    );
    res.json({ ...DEFAULT_SETTINGS, ...(result.recordset[0] || {}) });
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

app.get("/api/roles/matrix", requireAuth, requirePermission("/rollen*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const pool = await db.getPool();
    const rolesRequest = pool.request();
    rolesRequest.input("super_admin_name", SUPER_ADMIN_ROLE_NAME);
    const rolesResult = await rolesRequest.query(`
      SELECT id, naam, volgorde
      FROM dbo.vw_roles
      WHERE LOWER(naam) <> LOWER(@super_admin_name)
      ORDER BY volgorde, id
    `);
    const permsRequest = pool.request();
    permsRequest.input("super_admin_name", SUPER_ADMIN_ROLE_NAME);
    const permsResult = await permsRequest.query(`
      SELECT rp.role_id, rp.page, rp.allowed
      FROM dbo.vw_role_permissions rp
      INNER JOIN dbo.vw_roles r ON r.id = rp.role_id
      WHERE rp.allowed = 1
        AND LOWER(r.naam) <> LOWER(@super_admin_name)
    `);
    const permissions = {};
    for (const role of rolesResult.recordset) {
      permissions[role.id] = [];
    }
    for (const row of permsResult.recordset) {
      if (!permissions[row.role_id]) {
        permissions[row.role_id] = [];
      }
      if (row.page === "ALL" || row.page === "*") {
        permissions[row.role_id] = PAGE_PATTERNS.map((pattern) => pattern.pattern);
      } else {
        permissions[row.role_id].push(row.page);
      }
    }
    res.json({
      roles: rolesResult.recordset,
      page_patterns: PAGE_PATTERNS,
      permissions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load roles matrix." });
  }
});

app.post("/api/roles", requireAuth, requirePermission("/rollen*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  const name = (req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Role name is required." });
  }
  if (isSuperAdminRoleName(name)) {
    return res.status(400).json({ error: "Deze rolnaam is gereserveerd." });
  }
  try {
    const pool = await db.getPool();
    const request = pool.request();
    request.input("name", name);
    const result = await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.tbl_roles WHERE naam = @name)
        SELECT id FROM dbo.tbl_roles WHERE naam = @name
      ELSE
        INSERT INTO dbo.tbl_roles (naam, volgorde) OUTPUT INSERTED.id VALUES (@name, 0)
    `);
    res.json({ success: true, id: result.recordset[0]?.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create role." });
  }
});

app.post("/api/roles/:id/delete", requireAuth, requirePermission("/rollen*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const roleId = Number(req.params.id);
    if (!roleId || Number.isNaN(roleId)) {
      return res.status(400).json({ error: "Role id is required." });
    }
    const pool = await db.getPool();
    const superAdminRoleId = await getSuperAdminRoleId(pool);
    if (superAdminRoleId && roleId === superAdminRoleId) {
      return res.status(403).json({ error: "Super Admin rol kan niet worden verwijderd." });
    }
    const request = pool.request();
    request.input("role_id", roleId);
    await request.query("DELETE FROM dbo.tbl_role_permissions WHERE role_id = @role_id");
    await request.query("DELETE FROM dbo.tbl_user_roles WHERE role_id = @role_id");
    await request.query("DELETE FROM dbo.tbl_roles WHERE id = @role_id");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete role." });
  }
});

app.post("/api/roles/permissions", requireAuth, requirePermission("/rollen*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const permissions = req.body?.permissions || {};
    const pool = await db.getPool();
    const superAdminRoleId = await getSuperAdminRoleId(pool);
    for (const [roleId, patterns] of Object.entries(permissions)) {
      const roleIdNumber = Number(roleId);
      if (!roleIdNumber || Number.isNaN(roleIdNumber)) {
        return res.status(400).json({ error: "Invalid role id in permissions payload." });
      }
      if (superAdminRoleId && roleIdNumber === superAdminRoleId) {
        return res.status(403).json({ error: "Super Admin rol permissies kunnen niet worden gewijzigd." });
      }
      const request = pool.request();
      request.input("role_id", roleIdNumber);
      await request.query("DELETE FROM dbo.tbl_role_permissions WHERE role_id = @role_id");
      if (Array.isArray(patterns) && patterns.length) {
        for (const pattern of patterns) {
          const insert = pool.request();
          insert.input("role_id", roleIdNumber);
          insert.input("page", pattern);
          insert.input("allowed", 1);
          await insert.query(
            "INSERT INTO dbo.tbl_role_permissions (role_id, page, allowed) VALUES (@role_id, @page, @allowed)"
          );
        }
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save permissions." });
  }
});

app.post("/api/roles/order", requireAuth, requirePermission("/rollen*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const roleOrders = req.body?.role_orders || [];
    const pool = await db.getPool();
    const superAdminRoleId = await getSuperAdminRoleId(pool);
    for (let index = 0; index < roleOrders.length; index += 1) {
      const roleId = Number(roleOrders[index]);
      if (!roleId || Number.isNaN(roleId)) {
        return res.status(400).json({ error: "Invalid role id in role order payload." });
      }
      if (superAdminRoleId && roleId === superAdminRoleId) {
        return res.status(403).json({ error: "Super Admin rol volgorde kan niet worden gewijzigd." });
      }
      const request = pool.request();
      request.input("role_id", roleId);
      request.input("volgorde", index + 1);
      await request.query("UPDATE dbo.tbl_roles SET volgorde = @volgorde WHERE id = @role_id");
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update role order." });
  }
});

async function listStamgegevens(res, table, columns) {
  try {
    const pool = await db.getPool();
    const result = await pool
      .request()
      .query(`SELECT ${columns.join(", ")} FROM dbo.${table} ORDER BY volgorde, id`);
    res.json(result.recordset || []);
  } catch (error) {
    res.status(500).json({ error: `Failed to load ${table}.` });
  }
}

async function upsertStamgegevens(res, table, columns, data, id) {
  try {
    const pool = await db.getPool();
    const request = pool.request();
    const setClauses = [];
    for (const column of columns) {
      request.input(column, data[column] ?? null);
      setClauses.push(`${column} = @${column}`);
    }
    if (id) {
      request.input("id", id);
      await request.query(
        `UPDATE dbo.${table} SET ${setClauses.join(", ")}, updated_at = GETDATE() WHERE id = @id`
      );
    } else {
      const insertColumns = columns.join(", ");
      const insertValues = columns.map((column) => `@${column}`).join(", ");
      await request.query(`
        INSERT INTO dbo.${table} (${insertColumns}, volgorde, created_at)
        VALUES (${insertValues}, (SELECT ISNULL(MAX(volgorde), 0) + 1 FROM dbo.${table}), GETDATE())
      `);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: `Failed to save ${table}.` });
  }
}

async function deleteStamgegevens(res, table, id) {
  try {
    const pool = await db.getPool();
    const request = pool.request();
    request.input("id", id);
    await request.query(`DELETE FROM dbo.${table} WHERE id = @id`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete ${table}.` });
  }
}

async function updateOrder(res, table, order) {
  try {
    const pool = await db.getPool();
    for (const entry of order) {
      const request = pool.request();
      request.input("id", entry.id);
      request.input("volgorde", entry.volgorde);
      await request.query(`UPDATE dbo.${table} SET volgorde = @volgorde WHERE id = @id`);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: `Failed to update ${table} order.` });
  }
}

app.get("/api/stamgegevens/bedrijven", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  listStamgegevens(res, "tbl_bedrijven", ["id", "naam", "status", "volgorde"]);
});

app.post("/api/stamgegevens/bedrijven", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  upsertStamgegevens(res, "tbl_bedrijven", ["naam", "status"], req.body, null);
});

app.put("/api/stamgegevens/bedrijven/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  upsertStamgegevens(res, "tbl_bedrijven", ["naam", "status"], req.body, Number(req.params.id));
});

app.delete("/api/stamgegevens/bedrijven/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  deleteStamgegevens(res, "tbl_bedrijven", Number(req.params.id));
});

app.post("/api/stamgegevens/bedrijven/order", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  updateOrder(res, "tbl_bedrijven", req.body?.order || []);
});

app.get("/api/stamgegevens/statussen", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  listStamgegevens(res, "tbl_statussen", ["id", "status", "volgorde"]);
});

app.post("/api/stamgegevens/statussen", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  upsertStamgegevens(res, "tbl_statussen", ["status"], req.body, null);
});

app.put("/api/stamgegevens/statussen/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  upsertStamgegevens(res, "tbl_statussen", ["status"], req.body, Number(req.params.id));
});

app.delete("/api/stamgegevens/statussen/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  deleteStamgegevens(res, "tbl_statussen", Number(req.params.id));
});

app.post("/api/stamgegevens/statussen/order", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  updateOrder(res, "tbl_statussen", req.body?.order || []);
});

app.get("/api/stamgegevens/fases", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  listStamgegevens(res, "tbl_fases", ["id", "fases", "getal", "volgorde"]);
});

app.post("/api/stamgegevens/fases", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  upsertStamgegevens(res, "tbl_fases", ["fases", "getal"], req.body, null);
});

app.put("/api/stamgegevens/fases/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  upsertStamgegevens(res, "tbl_fases", ["fases", "getal"], req.body, Number(req.params.id));
});

app.delete("/api/stamgegevens/fases/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  deleteStamgegevens(res, "tbl_fases", Number(req.params.id));
});

app.post("/api/stamgegevens/fases/order", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  updateOrder(res, "tbl_fases", req.body?.order || []);
});

app.get("/api/accounts/users", requireAuth, requirePermission("/accounts*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const pool = await db.getPool();
    const request = pool.request();
    request.input("eesa_email", EESA_SUPER_ADMIN_EMAIL);
    request.input("super_admin_name", SUPER_ADMIN_ROLE_NAME);
    const result = await request.query(`
      SELECT u.user_id AS id,
             u.username,
             u.email,
             CASE
               WHEN u.is_super_admin = 1 THEN NULL
               WHEN LOWER(COALESCE(r.role_naam, u.role, '')) = LOWER(@super_admin_name) THEN NULL
               ELSE COALESCE(r.role_naam, u.role)
             END AS role,
             r.role_id AS role_id,
             u.is_super_admin,
             u.last_login
      FROM dbo.vw_accountbeheer_users u
      OUTER APPLY (
        SELECT TOP 1 ur.role_id,
                     ur.role_naam,
                     ur.role_volgorde
        FROM dbo.vw_user_roles ur
        WHERE ur.user_id = u.user_id
        ORDER BY ur.role_volgorde
      ) r
      WHERE LOWER(u.email) <> LOWER(@eesa_email)
      ORDER BY u.username
    `);
    res.json(result.recordset || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to load users." });
  }
});

app.get("/api/accounts/roles", requireAuth, requirePermission("/accounts*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const pool = await db.getPool();
    const request = pool.request();
    request.input("super_admin_name", SUPER_ADMIN_ROLE_NAME);
    const result = await request.query(`
      SELECT id, naam, volgorde
      FROM dbo.vw_roles
      WHERE LOWER(naam) <> LOWER(@super_admin_name)
      ORDER BY volgorde, id
    `);
    res.json(result.recordset || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to load roles." });
  }
});

app.post("/api/accounts/users/:id/role", requireAuth, requirePermission("/accounts*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const body = req.body || {};
    const userId = Number(req.params.id);
    const roleId = body.role_id ? Number(body.role_id) : null;
    const wantsSuperAdminChange = Object.prototype.hasOwnProperty.call(body, "is_super_admin");
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ error: "User id is required." });
    }
    if (req.user?.user_id === userId) {
      return res.status(400).json({ error: "Je kunt je eigen rol niet aanpassen." });
    }

    const pool = await db.getPool();
    const lookup = pool.request();
    lookup.input("user_id", userId);
    const userResult = await lookup.query(`
      SELECT TOP 1 user_id, email, is_super_admin
      FROM dbo.tbl_users
      WHERE user_id = @user_id
    `);
    const targetUser = userResult.recordset[0];
    if (!targetUser) {
      return res.status(404).json({ error: "Gebruiker niet gevonden." });
    }
    if (isEesaSuperAdminEmail(targetUser.email)) {
      return res.status(403).json({ error: "Dit account kan niet worden aangepast." });
    }
    if (wantsSuperAdminChange && !isEesaSuperAdminEmail(req.user?.email)) {
      return res.status(403).json({ error: "Alleen EESA mag Super Admin toewijzen of intrekken." });
    }

    const nextIsSuperAdmin = wantsSuperAdminChange
      ? Boolean(body.is_super_admin)
      : Boolean(targetUser.is_super_admin);
    const superAdminRoleId = await getSuperAdminRoleId(pool);
    let roleName = null;
    if (roleId && !Number.isNaN(roleId)) {
      if (superAdminRoleId && roleId === superAdminRoleId) {
        return res.status(403).json({ error: "Super Admin rol is verborgen en kan niet direct worden toegewezen." });
      }
      const roleLookup = pool.request();
      roleLookup.input("role_id", roleId);
      const roleResult = await roleLookup.query("SELECT naam FROM dbo.tbl_roles WHERE id = @role_id");
      roleName = roleResult.recordset[0]?.naam || null;
      if (!roleName) {
        return res.status(400).json({ error: "Ongeldige rol." });
      }
      if (isSuperAdminRoleName(roleName)) {
        return res.status(403).json({ error: "Super Admin rol is verborgen en kan niet direct worden toegewezen." });
      }
    }

    const request = pool.request();
    request.input("user_id", userId);
    await request.query("DELETE FROM dbo.tbl_user_roles WHERE user_id = @user_id");

    if (roleId && !Number.isNaN(roleId)) {
      const insert = pool.request();
      insert.input("user_id", userId);
      insert.input("role_id", roleId);
      await insert.query("INSERT INTO dbo.tbl_user_roles (user_id, role_id) VALUES (@user_id, @role_id)");

      const update = pool.request();
      update.input("user_id", userId);
      update.input("role", roleName);
      update.input("is_super_admin", nextIsSuperAdmin ? 1 : 0);
      await update.query(
        "UPDATE dbo.tbl_users SET role = @role, is_super_admin = @is_super_admin WHERE user_id = @user_id"
      );
    } else {
      const update = pool.request();
      update.input("user_id", userId);
      update.input("role", null);
      update.input("is_super_admin", nextIsSuperAdmin ? 1 : 0);
      await update.query(
        "UPDATE dbo.tbl_users SET role = @role, is_super_admin = @is_super_admin WHERE user_id = @user_id"
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user role." });
  }
});

app.delete("/api/accounts/users/:id", requireAuth, requirePermission("/accounts*"), async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const userId = Number(req.params.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ error: "User id is required." });
    }
    if (req.user?.user_id === userId) {
      return res.status(400).json({ error: "Je kunt je eigen account niet verwijderen." });
    }

    const pool = await db.getPool();
    const lookup = pool.request();
    lookup.input("user_id", userId);
    const userResult = await lookup.query(`
      SELECT TOP 1 email
      FROM dbo.tbl_users
      WHERE user_id = @user_id
    `);
    const targetUser = userResult.recordset[0];
    if (!targetUser) {
      return res.status(404).json({ error: "Gebruiker niet gevonden." });
    }
    if (isEesaSuperAdminEmail(targetUser.email)) {
      return res.status(403).json({ error: "Dit account kan niet worden verwijderd." });
    }

    const request = pool.request();
    request.input("user_id", userId);
    await request.query("DELETE FROM dbo.tbl_users WHERE user_id = @user_id");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user." });
  }
});

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

app.get(/^\/auto_log=?([12])=(true|false)$/i, async (req, res) => {
  if (!(await ensureDbConfigured(res))) return;
  try {
    const flagIndex = req.params?.[0];
    const enabledRaw = req.params?.[1];
    const flagMap = {
      1: AUTO_LOGIN_ADMIN_FLAG,
      2: AUTO_LOGIN_USER_FLAG,
    };
    const flagName = flagMap[Number(flagIndex)];
    if (!flagName) {
      return res.status(400).json({ error: "Invalid auto login flag." });
    }

    const flags = await loadFeatureFlags([AUTO_LOGIN_MASTER_FLAG]);
    if (!flags[AUTO_LOGIN_MASTER_FLAG]) {
      return res.status(403).json({ error: "Auto logins are disabled." });
    }

    const enabled = String(enabledRaw).toLowerCase() === "true";
    const pool = await db.getPool();
    const request = pool.request();
    request.input("flag_name", flagName);
    request.input("enabled", enabled ? 1 : 0);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.tbl_feature_flags WHERE flag_name = @flag_name)
        UPDATE dbo.tbl_feature_flags
        SET enabled = @enabled, updated_at = SYSDATETIME()
        WHERE flag_name = @flag_name
      ELSE
        INSERT INTO dbo.tbl_feature_flags (flag_name, enabled, page_key, description, updated_at)
        VALUES (@flag_name, @enabled, 'SYSTEM', 'Auto-login toggled via special link', SYSDATETIME())
    `);

    if (enabled) {
      const otherFlag = flagName === AUTO_LOGIN_ADMIN_FLAG ? AUTO_LOGIN_USER_FLAG : AUTO_LOGIN_ADMIN_FLAG;
      const disableOther = pool.request();
      disableOther.input("flag_name", otherFlag);
      await disableOther.query(`
        UPDATE dbo.tbl_feature_flags
        SET enabled = 0, updated_at = SYSDATETIME()
        WHERE flag_name = @flag_name
      `);
    }

    const acceptsJson = (req.headers.accept || "").includes("application/json");
    if (acceptsJson) {
      return res.json({ success: true, flag: flagName, enabled });
    }
    const target = VITE_ORIGIN || "/";
    return res.redirect(target);
  } catch (error) {
    const payload = { error: "Failed to update auto login flag." };
    if (!isProduction) {
      payload.detail = error?.message || String(error);
    }
    return res.status(500).json(payload);
  }
});

if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
}

if (!isProduction && VITE_ORIGIN) {
  app.use((req, res, next) => {
    if (shouldProxyToVite(req.path || req.url || "")) {
      proxyToVite(req, res);
      return;
    }
    next();
  });
}

app.get(/^(?!\/api).*/, async (req, res) => {
  if (!isProduction && VITE_ORIGIN) {
    const redirectUrl = new URL(req.originalUrl, VITE_ORIGIN);
    res.redirect(redirectUrl.toString());
    return;
  }
  const indexPath = fs.existsSync(CLIENT_DIST_INDEX) ? CLIENT_DIST_INDEX : CLIENT_DEV_INDEX;
  if (!fs.existsSync(indexPath)) {
    res.status(404).send("Client index not found.");
    return;
  }

  try {
    const template = fs.readFileSync(indexPath, "utf-8");
    const bootstrap = await buildBootstrap(req, res);
    const nonce = isProduction ? res.locals.cspNonce : null;
    const markup = buildBootstrapMarkup(bootstrap, nonce);
    const html = template
      .replace("<!-- APP_BOOTSTRAP -->", markup)
      .replace(/__CSP_NONCE__/g, nonce || "");
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    res.status(500).send("Failed to load app.");
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(config.port, () => {
  console.log(`Express API listening on http://localhost:${config.port}`);
  if (!config.sessionSecret) {
    console.warn("SESSION_SECRET is empty. Set a secure secret for production.");
  }
});
