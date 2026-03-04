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

const config = {
  env: process.env.ENVIRONMENT || "Local",
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
  },
  microsoft: {
    enabled: process.env.MICROSOFT_AUTH_ENABLED !== "0",
    clientId: pickEnv(process.env.INLOG_MICROSOFT_CLIENT_ID, process.env.MICROSOFT_CLIENT_ID),
    clientSecret: pickEnv(process.env.INLOG_MICROSOFT_CLIENT_SECRET, process.env.MICROSOFT_CLIENT_SECRET),
    tenantId: pickEnv(process.env.INLOG_MICROSOFT_TENANT_ID, process.env.MICROSOFT_TENANT_ID),
    redirectUri: pickEnv(process.env.MICROSOFT_AUTH_REDIRECT_URI, process.env.INLOG_MICROSOFT_REDIRECT_URI),
  },
  appUserEmail: process.env.APP_DEFAULT_USER_EMAIL || "",
  autoLoginAdminEmail: process.env.AUTO_LOGIN_ADMIN_EMAIL || "",
  autoLoginUserEmail: process.env.AUTO_LOGIN_USER_EMAIL || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "session_id",
  sessionDurationHours: Number(process.env.SESSION_DURATION_HOURS || 24 * 7),
  trustProxy: process.env.TRUST_PROXY === "1",
  csrfEnabled: process.env.CSRF_ENABLED === "1",
};

module.exports = config;
