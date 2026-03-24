const sql = require("mssql");

function sanitizeText(value, maxLength = 255) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function toMetadataJson(value) {
  if (!value || typeof value !== "object") return null;
  try {
    return JSON.stringify(value).slice(0, 4000);
  } catch {
    return null;
  }
}

function buildPoolConfig(dbConfig) {
  return {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.server,
    database: dbConfig.name,
    port: Number(dbConfig.port || 1433),
    pool: {
      max: Number(dbConfig.maxConnections || 5),
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: dbConfig.encrypt !== false,
      trustServerCertificate: dbConfig.trustServerCertificate === true,
    },
    connectionTimeout: Number(dbConfig.connectionTimeout || 10) * 1000,
    requestTimeout: Number(dbConfig.commandTimeout || 10) * 1000,
  };
}

function createSystemErrorAudit({ auditConfig, envName }) {
  const enabled = auditConfig?.enabled !== false;
  const dbConfig = auditConfig?.db || {};
  const isConfigured =
    Boolean(dbConfig.server) &&
    Boolean(dbConfig.name) &&
    Boolean(dbConfig.user) &&
    Boolean(dbConfig.password);

  let poolPromise = null;
  let schemaReady = false;
  let ensureSchemaPromise = null;
  let handlersAttached = false;

  async function getPool() {
    if (!poolPromise) {
      const pool = new sql.ConnectionPool(buildPoolConfig(dbConfig));
      poolPromise = pool.connect();
    }
    return poolPromise;
  }

  async function ensureSchema() {
    if (schemaReady || auditConfig?.autoCreateTable === false) return;
    if (!ensureSchemaPromise) {
      ensureSchemaPromise = (async () => {
        const pool = await getPool();
        await pool.request().query(`
          IF OBJECT_ID('dbo.tbl_system_errors', 'U') IS NULL
          BEGIN
            CREATE TABLE dbo.tbl_system_errors (
              error_event_id BIGINT IDENTITY(1,1) PRIMARY KEY,
              created_at DATETIME2 NOT NULL CONSTRAINT DF_SystemErrors_CreatedAt DEFAULT SYSUTCDATETIME(),
              app_name NVARCHAR(120) NOT NULL,
              environment NVARCHAR(64) NULL,
              severity NVARCHAR(24) NOT NULL,
              source NVARCHAR(48) NOT NULL,
              category NVARCHAR(80) NULL,
              message NVARCHAR(1024) NOT NULL,
              stack_trace NVARCHAR(MAX) NULL,
              request_path NVARCHAR(255) NULL,
              http_method NVARCHAR(12) NULL,
              status_code INT NULL,
              user_id INT NULL,
              username NVARCHAR(255) NULL,
              ip_address NVARCHAR(64) NULL,
              user_agent NVARCHAR(512) NULL,
              metadata_json NVARCHAR(MAX) NULL
            );
          END;

          IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_SystemErrors_CreatedAt'
              AND object_id = OBJECT_ID('dbo.tbl_system_errors')
          )
          BEGIN
            CREATE INDEX IX_SystemErrors_CreatedAt
            ON dbo.tbl_system_errors(created_at DESC);
          END;

          IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_SystemErrors_App_CreatedAt'
              AND object_id = OBJECT_ID('dbo.tbl_system_errors')
          )
          BEGIN
            CREATE INDEX IX_SystemErrors_App_CreatedAt
            ON dbo.tbl_system_errors(app_name, created_at DESC);
          END;
        `);
        schemaReady = true;
      })().catch((error) => {
        ensureSchemaPromise = null;
        throw error;
      });
    }
    return ensureSchemaPromise;
  }

  async function logErrorEvent({
    severity = "error",
    source = "server",
    category = "application",
    message = "Unknown server error",
    stackTrace = null,
    requestPath = null,
    httpMethod = null,
    statusCode = null,
    userId = null,
    username = null,
    ipAddress = null,
    userAgent = null,
    metadata = null,
  }) {
    if (!enabled || !isConfigured) return false;
    try {
      await ensureSchema();
      const pool = await getPool();
      const request = pool.request();
      request.input("app_name", sanitizeText(auditConfig.appName, 120) || "react-template");
      request.input("environment", sanitizeText(envName, 64));
      request.input("severity", sanitizeText(severity, 24) || "error");
      request.input("source", sanitizeText(source, 48) || "server");
      request.input("category", sanitizeText(category, 80));
      request.input("message", sanitizeText(message, 1024) || "Unknown server error");
      request.input("stack_trace", sanitizeText(stackTrace, 4000));
      request.input("request_path", sanitizeText(requestPath, 255));
      request.input("http_method", sanitizeText(httpMethod, 12));
      request.input("status_code", Number.isInteger(statusCode) ? statusCode : null);
      request.input("user_id", Number.isInteger(userId) ? userId : null);
      request.input("username", sanitizeText(username, 255));
      request.input("ip_address", sanitizeText(ipAddress, 64));
      request.input("user_agent", sanitizeText(userAgent, 512));
      request.input("metadata_json", toMetadataJson(metadata));
      await request.query(`
        INSERT INTO dbo.tbl_system_errors (
          app_name,
          environment,
          severity,
          source,
          category,
          message,
          stack_trace,
          request_path,
          http_method,
          status_code,
          user_id,
          username,
          ip_address,
          user_agent,
          metadata_json
        )
        VALUES (
          @app_name,
          @environment,
          @severity,
          @source,
          @category,
          @message,
          @stack_trace,
          @request_path,
          @http_method,
          @status_code,
          @user_id,
          @username,
          @ip_address,
          @user_agent,
          @metadata_json
        )
      `);
      return true;
    } catch (error) {
      console.warn("[system-error-audit] Could not write error event:", error.message || error);
      return false;
    }
  }

  function attachProcessHandlers() {
    if (handlersAttached || !enabled || !isConfigured) return;
    handlersAttached = true;
    process.on("unhandledRejection", (reason) => {
      const message = reason instanceof Error ? reason.message : String(reason || "Unhandled rejection");
      const stackTrace = reason instanceof Error ? reason.stack : null;
      void logErrorEvent({
        severity: "critical",
        source: "process",
        category: "unhandledRejection",
        message,
        stackTrace,
      });
    });
    process.on("uncaughtExceptionMonitor", (error) => {
      void logErrorEvent({
        severity: "critical",
        source: "process",
        category: "uncaughtException",
        message: error?.message || "Uncaught exception",
        stackTrace: error?.stack || null,
      });
    });
  }

  if (enabled && !isConfigured) {
    console.warn(
      "[system-error-audit] SYSTEM_ERROR_AUDIT_ENABLED is true, but SYSTEM_ERROR_AUDIT_DB_* config is incomplete."
    );
  }

  return {
    enabled: enabled && isConfigured,
    logErrorEvent,
    attachProcessHandlers,
  };
}

module.exports = { createSystemErrorAudit };

