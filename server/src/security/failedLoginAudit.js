const sql = require("mssql");

function sanitizeText(value, maxLength = 255) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function createFailedLoginAudit({ auditConfig, envName }) {
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

  const poolConfig = {
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

  async function getPool() {
    if (!poolPromise) {
      const pool = new sql.ConnectionPool(poolConfig);
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
          IF OBJECT_ID('dbo.tbl_failed_login_events', 'U') IS NULL
          BEGIN
            CREATE TABLE dbo.tbl_failed_login_events (
              event_id BIGINT IDENTITY(1,1) PRIMARY KEY,
              created_at DATETIME2 NOT NULL CONSTRAINT DF_FailedLoginEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
              app_name NVARCHAR(120) NOT NULL,
              environment NVARCHAR(64) NULL,
              provider NVARCHAR(40) NOT NULL,
              identifier NVARCHAR(255) NULL,
              ip_address NVARCHAR(64) NULL,
              user_agent NVARCHAR(512) NULL,
              request_path NVARCHAR(255) NULL,
              http_method NVARCHAR(12) NULL,
              failure_reason NVARCHAR(128) NULL,
              status_code INT NULL,
              metadata_json NVARCHAR(MAX) NULL
            );
          END;

          IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_FailedLoginEvents_CreatedAt'
              AND object_id = OBJECT_ID('dbo.tbl_failed_login_events')
          )
          BEGIN
            CREATE INDEX IX_FailedLoginEvents_CreatedAt
            ON dbo.tbl_failed_login_events(created_at DESC);
          END;

          IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_FailedLoginEvents_App_CreatedAt'
              AND object_id = OBJECT_ID('dbo.tbl_failed_login_events')
          )
          BEGIN
            CREATE INDEX IX_FailedLoginEvents_App_CreatedAt
            ON dbo.tbl_failed_login_events(app_name, created_at DESC);
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

  async function logFailedLoginAttempt({
    provider = "local",
    identifier = null,
    ipAddress = null,
    userAgent = null,
    requestPath = null,
    httpMethod = null,
    failureReason = "unknown",
    statusCode = null,
    metadata = null,
  }) {
    if (!enabled || !isConfigured) return false;
    try {
      await ensureSchema();
      const pool = await getPool();
      const request = pool.request();
      request.input("app_name", sanitizeText(auditConfig.appName, 120) || "react-template");
      request.input("environment", sanitizeText(envName, 64));
      request.input("provider", sanitizeText(provider, 40) || "local");
      request.input("identifier", sanitizeText(identifier, 255));
      request.input("ip_address", sanitizeText(ipAddress, 64));
      request.input("user_agent", sanitizeText(userAgent, 512));
      request.input("request_path", sanitizeText(requestPath, 255));
      request.input("http_method", sanitizeText(httpMethod, 12));
      request.input("failure_reason", sanitizeText(failureReason, 128));
      request.input("status_code", Number.isInteger(statusCode) ? statusCode : null);
      request.input(
        "metadata_json",
        metadata && typeof metadata === "object" ? JSON.stringify(metadata).slice(0, 4000) : null
      );
      await request.query(`
        INSERT INTO dbo.tbl_failed_login_events (
          app_name,
          environment,
          provider,
          identifier,
          ip_address,
          user_agent,
          request_path,
          http_method,
          failure_reason,
          status_code,
          metadata_json
        )
        VALUES (
          @app_name,
          @environment,
          @provider,
          @identifier,
          @ip_address,
          @user_agent,
          @request_path,
          @http_method,
          @failure_reason,
          @status_code,
          @metadata_json
        )
      `);
      return true;
    } catch (error) {
      console.warn("[failed-login-audit] Could not write audit event:", error.message || error);
      return false;
    }
  }

  async function countRecentFailedAttempts({ provider = "local", identifier = null, ipAddress = null, windowMinutes = 15 }) {
    if (!enabled || !isConfigured) return null;
    try {
      await ensureSchema();
      const pool = await getPool();
      const request = pool.request();
      request.input("provider", sanitizeText(provider, 40) || "local");
      request.input("identifier", sanitizeText(identifier, 255));
      request.input("ip_address", sanitizeText(ipAddress, 64));
      request.input("window_minutes", Number(windowMinutes) > 0 ? Number(windowMinutes) : 15);
      const result = await request.query(`
        SELECT COUNT(*) AS failed_count
        FROM dbo.tbl_failed_login_events
        WHERE provider = @provider
          AND created_at > DATEADD(MINUTE, -@window_minutes, SYSUTCDATETIME())
          AND (
            (@identifier IS NOT NULL AND identifier = @identifier)
            OR (@ip_address IS NOT NULL AND ip_address = @ip_address)
          )
      `);
      return Number(result.recordset?.[0]?.failed_count || 0);
    } catch (error) {
      console.warn("[failed-login-audit] Could not count audit events:", error.message || error);
      return null;
    }
  }

  if (enabled && !isConfigured) {
    console.warn(
      "[failed-login-audit] AUTH_AUDIT_ENABLED is true, but AUTH_AUDIT_DB_* config is incomplete. Logging disabled."
    );
  }

  return {
    enabled: enabled && isConfigured,
    logFailedLoginAttempt,
    countRecentFailedAttempts,
  };
}

module.exports = { createFailedLoginAudit };
