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
const { requireMicrosoftAuth, verifyMicrosoftToken } = require("./microsoftAuth");
const auth = require("./auth");
const { registerStamgegevensRoutes } = require("./routes/stamgegevensRoutes");
const { registerFeatureFlagRoutes } = require("./routes/featureFlagRoutes");
const { registerRoleRoutes } = require("./routes/roleRoutes");
const { registerAccountRoutes } = require("./routes/accountRoutes");
const { registerSystemRoutes } = require("./routes/systemRoutes");
const { registerAuthRoutes } = require("./routes/authRoutes");
const { registerClientShellRoutes } = require("./routes/clientShellRoutes");
const { createAccessControl } = require("./security/accessControl");
const { createAuthFlowHelpers } = require("./security/authFlowHelpers");
const { createFailedLoginAudit } = require("./security/failedLoginAudit");
const { createSystemErrorAudit } = require("./security/systemErrorAudit");
const { createSupportAdminAllowlist } = require("./security/supportAdminAllowlist");
const {
  createErrorAuditCaptureMiddleware,
  createExpressErrorAuditHandler,
} = require("./security/errorAuditMiddleware");
const { buildCspHeader } = require("./security/csp");
const { registerCsrfProtection } = require("./security/csrfMiddleware");
const { runStartupChecks } = require("./security/startupChecks");
const { createBootstrapService } = require("./services/bootstrapService");
const {
  clamp,
  normalizeHex,
  mixWithBlack,
  normalizeTableTint,
  normalizeContainerTint,
  getTableTintRgb,
  getContainerTintRgb,
} = require("./utils/themeUtils");
const { buildBootstrapMarkup } = require("./utils/bootstrapMarkup");
const { createViteProxyHelpers } = require("./utils/viteProxy");

const isProduction = (config.env || "").toLowerCase() === "production";
const SESSION_SECRET_MIN_LENGTH = 32;
const CSRF_COOKIE = "csrf_token";
const MICROSOFT_STATE_COOKIE = "ms_auth_state";
const MICROSOFT_REDIRECT_COOKIE = "ms_auth_redirect";
const MICROSOFT_AUTH_COOKIE_PATH = "/api/auth/microsoft";
const MICROSOFT_AUTH_STATE_TTL_MS = 10 * 60 * 1000;

const app = express();
app.set("etag", false);

const PAGE_PATTERNS = [
  { name: "Home", pattern: "/home*" },
  { name: "Accountbeheer", pattern: "/accounts*" },
  { name: "Rolbeheer", pattern: "/rollen*" },
  { name: "Stamgegevens Beheer", pattern: "/stamgegevens*" },
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
  table_tint: "mint",
  container_tint: "mint",
};
const SIDEBAR_HEADER_WHITE_FLAG = "ENABLE_SIDEBAR_HEADER_WHITE";
const SUPER_ADMIN_ROLE_NAME = "Super Admin";
const EESA_SUPER_ADMIN_EMAIL = "eesa@admin.local";

const CLIENT_DIST_DIR = path.resolve(__dirname, "..", "..", "client", "dist");
const CLIENT_DIST_INDEX = path.join(CLIENT_DIST_DIR, "index.html");
const CLIENT_DEV_INDEX = path.resolve(__dirname, "..", "..", "client", "index.html");

const VITE_PORT = Number(process.env.VITE_PORT || 0);
const VITE_ORIGIN =
  process.env.VITE_ORIGIN ||
  (VITE_PORT ? `http://localhost:${VITE_PORT}` : config.corsOrigin || "");
const hasLocalAuth = config.localAuthEnabled !== false;
const hasMicrosoftAuth =
  config.microsoft.enabled !== false &&
  Boolean(config.microsoft.clientId) &&
  Boolean(config.microsoft.tenantId) &&
  Boolean(config.microsoft.clientSecret);

const {
  readCookie,
  setCsrfCookie,
  setMicrosoftAuthCookie,
  clearMicrosoftAuthCookies,
  buildAppRedirectUrl,
  resolveMicrosoftRedirectUri,
  buildMicrosoftAuthorizeUrl,
  exchangeMicrosoftCodeForToken,
  getMicrosoftAccountEmail,
} = createAuthFlowHelpers({
  crypto,
  config,
  isProduction,
  csrfCookieName: CSRF_COOKIE,
  microsoftAuthCookiePath: MICROSOFT_AUTH_COOKIE_PATH,
  microsoftAuthStateTtlMs: MICROSOFT_AUTH_STATE_TTL_MS,
  microsoftStateCookieName: MICROSOFT_STATE_COOKIE,
  microsoftRedirectCookieName: MICROSOFT_REDIRECT_COOKIE,
});
const { shouldProxyToVite, proxyToVite } = createViteProxyHelpers({
  VITE_ORIGIN,
  http,
  https,
});
const failedLoginAudit = createFailedLoginAudit({
  auditConfig: config.authAudit,
  envName: config.env,
});
const systemErrorAudit = createSystemErrorAudit({
  auditConfig: config.systemErrorAudit,
  envName: config.env,
});
systemErrorAudit.attachProcessHandlers();
const supportAdminAllowlist = createSupportAdminAllowlist({
  allowlistConfig: config.supportAdminAllowlist,
  envName: config.env,
});

async function ensureDbConfigured(res) {
  if (!config.db.server) {
    res.status(501).json({ error: "Database is not configured." });
    return false;
  }
  return true;
}

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", buildCspHeader(isProduction, res.locals.cspNonce));
  next();
});
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(createErrorAuditCaptureMiddleware({ systemErrorAudit }));
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

registerCsrfProtection({
  app,
  config,
  readCookie,
  csrfCookieName: CSRF_COOKIE,
});

runStartupChecks({
  isLocalLike: config.isLocalLike,
  isProduction,
  sessionSecret: config.sessionSecret,
  minSessionSecretLength: SESSION_SECRET_MIN_LENGTH,
  autoLoginEnabled: config.autoLoginEnabled,
  autoLoginAdminEnabled: config.autoLoginAdminEnabled,
  autoLoginUserEnabled: config.autoLoginUserEnabled,
  autoLoginAdminEmail: config.autoLoginAdminEmail,
  autoLoginUserEmail: config.autoLoginUserEmail,
  demoSuperAdminEmail: EESA_SUPER_ADMIN_EMAIL,
});

const {
  requireAuth,
  loadPermissions,
  requirePermission,
  isSuperAdminRoleName,
  getSuperAdminRoleId,
} = createAccessControl({
  db,
  auth,
  crypto,
  config,
  ensureDbConfigured,
  readCookie,
  setCsrfCookie,
  csrfCookieName: CSRF_COOKIE,
  superAdminRoleName: SUPER_ADMIN_ROLE_NAME,
});

const {
  loadFeatureFlags,
  buildAppFeatureFlags,
  fetchUserSettings,
  buildBootstrap,
} = createBootstrapService({
  db,
  auth,
  crypto,
  config,
  readCookie,
  setCsrfCookie,
  csrfCookieName: CSRF_COOKIE,
  defaultSettings: DEFAULT_SETTINGS,
  hasLocalAuth,
  hasMicrosoftAuth,
  sidebarHeaderWhiteFlag: SIDEBAR_HEADER_WHITE_FLAG,
  loadPermissions,
  normalizeTableTint,
  normalizeContainerTint,
  failedLoginAudit,
});

registerSystemRoutes({
  app,
  config,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
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
});

registerAuthRoutes({
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
});

registerRoleRoutes({
  app,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
  PAGE_PATTERNS,
  SUPER_ADMIN_ROLE_NAME,
  isSuperAdminRoleName,
  getSuperAdminRoleId,
});

registerStamgegevensRoutes({
  app,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
});

registerAccountRoutes({
  app,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
  SUPER_ADMIN_ROLE_NAME,
  isSuperAdminRoleName,
  getSuperAdminRoleId,
});

registerFeatureFlagRoutes({
  app,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
});

registerClientShellRoutes({
  app,
  express,
  fs,
  isProduction,
  viteOrigin: VITE_ORIGIN,
  clientDistDir: CLIENT_DIST_DIR,
  clientDistIndex: CLIENT_DIST_INDEX,
  clientDevIndex: CLIENT_DEV_INDEX,
  shouldProxyToVite,
  proxyToVite,
  buildBootstrap,
  buildBootstrapMarkup,
  defaultSettings: DEFAULT_SETTINGS,
  normalizeHex,
  clamp,
  mixWithBlack,
  normalizeTableTint,
  normalizeContainerTint,
  getTableTintRgb,
  getContainerTintRgb,
});

app.use(createExpressErrorAuditHandler({ systemErrorAudit, isProduction }));
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(config.port, () => {
  console.log(`Express API listening on http://localhost:${config.port}`);
  if (!config.sessionSecret) {
    console.warn("SESSION_SECRET is empty. Set a secure secret for production.");
  }
});


