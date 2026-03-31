const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

function pickEnv(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function envFlag(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  return String(value).trim().toLowerCase() === "1" || String(value).trim().toLowerCase() === "true";
}

const envName = process.env.ENVIRONMENT || "Local";
const normalizedEnv = envName.trim().toLowerCase();
const isProduction = normalizedEnv === "production";
const isLocalLike = normalizedEnv === "local" || normalizedEnv === "development" || normalizedEnv === "dev";

const config = {
  env: envName,
  port: Number(process.env.EXPRESS_PORT || 5010),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  localAuthEnabled: process.env.LOCAL_AUTH_ENABLED !== "0",
  db: {
    server: process.env.DB_SERVER || "",
    port: Number(process.env.DB_PORT || 1433),
    name: process.env.DB_NAME || "",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS || 10),
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT || 30),
    commandTimeout: Number(process.env.DB_COMMAND_TIMEOUT || 30),
    encrypt: envFlag(process.env.DB_ENCRYPT, !isLocalLike),
    trustServerCertificate: envFlag(process.env.DB_TRUST_SERVER_CERTIFICATE, isLocalLike),
  },
  authAudit: {
    enabled: envFlag(process.env.AUTH_AUDIT_ENABLED, true),
    appName: pickEnv(process.env.AUTH_AUDIT_APP_NAME, process.env.APP_NAME, "react-template"),
    autoCreateTable: envFlag(process.env.AUTH_AUDIT_AUTO_CREATE_TABLE, true),
    db: {
      server: pickEnv(process.env.AUTH_AUDIT_DB_SERVER, process.env.DB_SERVER),
      port: Number(pickEnv(process.env.AUTH_AUDIT_DB_PORT, process.env.DB_PORT, "1433")),
      name: process.env.AUTH_AUDIT_DB_NAME || "",
      user: pickEnv(process.env.AUTH_AUDIT_DB_USER, process.env.DB_USER),
      password: pickEnv(process.env.AUTH_AUDIT_DB_PASSWORD, process.env.DB_PASSWORD),
      maxConnections: Number(pickEnv(process.env.AUTH_AUDIT_DB_MAX_CONNECTIONS, "5")),
      connectionTimeout: Number(pickEnv(process.env.AUTH_AUDIT_DB_CONNECTION_TIMEOUT, "10")),
      commandTimeout: Number(pickEnv(process.env.AUTH_AUDIT_DB_COMMAND_TIMEOUT, "10")),
      encrypt: envFlag(process.env.AUTH_AUDIT_DB_ENCRYPT, !isLocalLike),
      trustServerCertificate: envFlag(
        process.env.AUTH_AUDIT_DB_TRUST_SERVER_CERTIFICATE,
        isLocalLike
      ),
    },
  },
  supportAdminAllowlist: {
    enabled: envFlag(process.env.SUPPORT_ADMIN_ALLOWLIST_ENABLED, true),
    appName: pickEnv(
      process.env.SUPPORT_ADMIN_ALLOWLIST_APP_NAME,
      process.env.AUTH_AUDIT_APP_NAME,
      process.env.APP_NAME,
      "react-template"
    ),
    autoCreateTable: envFlag(process.env.SUPPORT_ADMIN_ALLOWLIST_AUTO_CREATE_TABLE, true),
    db: {
      server: pickEnv(
        process.env.SUPPORT_ADMIN_ALLOWLIST_DB_SERVER,
        process.env.AUTH_AUDIT_DB_SERVER,
        process.env.DB_SERVER
      ),
      port: Number(
        pickEnv(
          process.env.SUPPORT_ADMIN_ALLOWLIST_DB_PORT,
          process.env.AUTH_AUDIT_DB_PORT,
          process.env.DB_PORT,
          "1433"
        )
      ),
      name: pickEnv(
        process.env.SUPPORT_ADMIN_ALLOWLIST_DB_NAME,
        process.env.AUTH_AUDIT_DB_NAME
      ),
      user: pickEnv(
        process.env.SUPPORT_ADMIN_ALLOWLIST_DB_USER,
        process.env.AUTH_AUDIT_DB_USER,
        process.env.DB_USER
      ),
      password: pickEnv(
        process.env.SUPPORT_ADMIN_ALLOWLIST_DB_PASSWORD,
        process.env.AUTH_AUDIT_DB_PASSWORD,
        process.env.DB_PASSWORD
      ),
      maxConnections: Number(pickEnv(process.env.SUPPORT_ADMIN_ALLOWLIST_DB_MAX_CONNECTIONS, "5")),
      connectionTimeout: Number(pickEnv(process.env.SUPPORT_ADMIN_ALLOWLIST_DB_CONNECTION_TIMEOUT, "10")),
      commandTimeout: Number(pickEnv(process.env.SUPPORT_ADMIN_ALLOWLIST_DB_COMMAND_TIMEOUT, "10")),
      encrypt: envFlag(process.env.SUPPORT_ADMIN_ALLOWLIST_DB_ENCRYPT, !isLocalLike),
      trustServerCertificate: envFlag(
        process.env.SUPPORT_ADMIN_ALLOWLIST_DB_TRUST_SERVER_CERTIFICATE,
        isLocalLike
      ),
    },
  },
  systemErrorAudit: {
    enabled: envFlag(process.env.SYSTEM_ERROR_AUDIT_ENABLED, true),
    appName: pickEnv(
      process.env.SYSTEM_ERROR_AUDIT_APP_NAME,
      process.env.AUTH_AUDIT_APP_NAME,
      process.env.APP_NAME,
      "react-template"
    ),
    autoCreateTable: envFlag(process.env.SYSTEM_ERROR_AUDIT_AUTO_CREATE_TABLE, true),
    db: {
      server: pickEnv(process.env.SYSTEM_ERROR_AUDIT_DB_SERVER, process.env.AUTH_AUDIT_DB_SERVER, process.env.DB_SERVER),
      port: Number(
        pickEnv(process.env.SYSTEM_ERROR_AUDIT_DB_PORT, process.env.AUTH_AUDIT_DB_PORT, process.env.DB_PORT, "1433")
      ),
      name: pickEnv(process.env.SYSTEM_ERROR_AUDIT_DB_NAME, process.env.AUTH_AUDIT_DB_NAME),
      user: pickEnv(process.env.SYSTEM_ERROR_AUDIT_DB_USER, process.env.AUTH_AUDIT_DB_USER, process.env.DB_USER),
      password: pickEnv(
        process.env.SYSTEM_ERROR_AUDIT_DB_PASSWORD,
        process.env.AUTH_AUDIT_DB_PASSWORD,
        process.env.DB_PASSWORD
      ),
      maxConnections: Number(pickEnv(process.env.SYSTEM_ERROR_AUDIT_DB_MAX_CONNECTIONS, "5")),
      connectionTimeout: Number(pickEnv(process.env.SYSTEM_ERROR_AUDIT_DB_CONNECTION_TIMEOUT, "10")),
      commandTimeout: Number(pickEnv(process.env.SYSTEM_ERROR_AUDIT_DB_COMMAND_TIMEOUT, "10")),
      encrypt: envFlag(process.env.SYSTEM_ERROR_AUDIT_DB_ENCRYPT, !isLocalLike),
      trustServerCertificate: envFlag(
        process.env.SYSTEM_ERROR_AUDIT_DB_TRUST_SERVER_CERTIFICATE,
        isLocalLike
      ),
    },
  },
  microsoft: {
    enabled: process.env.MICROSOFT_AUTH_ENABLED !== "0",
    clientId: pickEnv(process.env.INLOG_MICROSOFT_CLIENT_ID, process.env.MICROSOFT_CLIENT_ID),
    clientSecret: pickEnv(process.env.INLOG_MICROSOFT_CLIENT_SECRET, process.env.MICROSOFT_CLIENT_SECRET),
    tenantId: pickEnv(process.env.INLOG_MICROSOFT_TENANT_ID, process.env.MICROSOFT_TENANT_ID),
    redirectUri: pickEnv(process.env.MICROSOFT_AUTH_REDIRECT_URI, process.env.INLOG_MICROSOFT_REDIRECT_URI),
  },
  wordbee: {
    baseUrl: pickEnv(process.env.WORDBEE_API_BASE_URL, process.env.WORDBEE_BASE_URL),
    apiKey: pickEnv(process.env.WORDBEE_API_KEY),
    accountId: pickEnv(process.env.WORDBEE_API_ACCOUNT_ID, process.env.WORDBEE_ACCOUNT_ID),
    authMode: pickEnv(process.env.WORDBEE_AUTH_MODE, "api2").toLowerCase(),
    apiKeyHeader: pickEnv(process.env.WORDBEE_API_KEY_HEADER, "Authorization"),
    apiKeyPrefix: process.env.WORDBEE_API_KEY_PREFIX ?? "Bearer ",
    timeoutMs: Number(process.env.WORDBEE_TIMEOUT_MS || 30000),
  },
  appUserEmail: process.env.APP_DEFAULT_USER_EMAIL || "",
  autoLoginEnabled: process.env.AUTO_LOGIN_ENABLED === "1",
  autoLoginAdminEnabled: process.env.AUTO_LOGIN_ADMIN_ENABLED === "1",
  autoLoginUserEnabled: process.env.AUTO_LOGIN_USER_ENABLED === "1",
  autoLoginAdminEmail: process.env.AUTO_LOGIN_ADMIN_EMAIL || "",
  autoLoginUserEmail: process.env.AUTO_LOGIN_USER_EMAIL || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "session_id",
  sessionDurationHours: Number(process.env.SESSION_DURATION_HOURS || 24 * 7),
  trustProxy: process.env.TRUST_PROXY === "1",
  csrfEnabled: process.env.CSRF_ENABLED !== "0",
  isProduction,
  isLocalLike,
};

module.exports = config;
