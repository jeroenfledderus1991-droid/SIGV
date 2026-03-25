const crypto = require("crypto");
const sql = require("mssql");

const SUPPORT_ADMIN_INTERNAL_ROLE = "support_admin_int";

function sanitizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function sanitizeText(value, maxLength = 255) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
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

function createSupportAdminAllowlist({ allowlistConfig, envName }) {
  const enabled = allowlistConfig?.enabled !== false;
  const dbConfig = allowlistConfig?.db || {};
  const appName = sanitizeText(allowlistConfig?.appName, 120) || "react-template";
  const isConfigured =
    Boolean(dbConfig.server) &&
    Boolean(dbConfig.name) &&
    Boolean(dbConfig.user) &&
    Boolean(dbConfig.password);

  let poolPromise = null;
  let schemaReady = false;
  let ensureSchemaPromise = null;

  async function getPool() {
    if (!poolPromise) {
      const pool = new sql.ConnectionPool(buildPoolConfig(dbConfig));
      poolPromise = pool.connect();
    }
    return poolPromise;
  }

  async function ensureSchema() {
    if (schemaReady || allowlistConfig?.autoCreateTable === false) return;
    if (!ensureSchemaPromise) {
      ensureSchemaPromise = (async () => {
        const pool = await getPool();
        await pool.request().query(`
          IF OBJECT_ID('dbo.tbl_support_admin_allowlist', 'U') IS NULL
          BEGIN
            CREATE TABLE dbo.tbl_support_admin_allowlist (
              admin_id INT IDENTITY(1,1) PRIMARY KEY,
              email NVARCHAR(320) NOT NULL,
              email_normalized AS LOWER(LTRIM(RTRIM(email))) PERSISTED,
              display_name NVARCHAR(200) NULL,
              role_code NVARCHAR(40) NOT NULL CONSTRAINT DF_SupportAdmins_RoleCode DEFAULT 'support_admin',
              is_active BIT NOT NULL CONSTRAINT DF_SupportAdmins_IsActive DEFAULT 1,
              notes NVARCHAR(500) NULL,
              created_at DATETIME2 NOT NULL CONSTRAINT DF_SupportAdmins_CreatedAt DEFAULT SYSUTCDATETIME(),
              updated_at DATETIME2 NOT NULL CONSTRAINT DF_SupportAdmins_UpdatedAt DEFAULT SYSUTCDATETIME(),
              created_by NVARCHAR(255) NULL,
              updated_by NVARCHAR(255) NULL,
              last_used_at DATETIME2 NULL
            );
          END;

          IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'UX_SupportAdmins_EmailNormalized'
              AND object_id = OBJECT_ID('dbo.tbl_support_admin_allowlist')
          )
          BEGIN
            CREATE UNIQUE INDEX UX_SupportAdmins_EmailNormalized
                ON dbo.tbl_support_admin_allowlist(email_normalized);
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

  async function getAllowlistEntryByEmail(email) {
    if (!enabled || !isConfigured) return null;
    const normalizedEmail = sanitizeEmail(email);
    if (!normalizedEmail) return null;
    await ensureSchema();
    const pool = await getPool();
    const request = pool.request();
    request.input("email_normalized", normalizedEmail);
    const result = await request.query(`
      SELECT TOP 1
        admin_id,
        email,
        email_normalized,
        display_name,
        role_code,
        is_active
      FROM dbo.tbl_support_admin_allowlist
      WHERE email_normalized = @email_normalized
        AND is_active = 1
    `);
    return result.recordset[0] || null;
  }

  async function markAllowlistUsage(email, metadata = {}) {
    if (!enabled || !isConfigured) return;
    const normalizedEmail = sanitizeEmail(email);
    if (!normalizedEmail) return;
    try {
      await ensureSchema();
      const pool = await getPool();
      const request = pool.request();
      request.input("email_normalized", normalizedEmail);
      request.input("updated_by", sanitizeText(metadata.updatedBy || `${appName}:${envName}`, 255));
      await request.query(`
        UPDATE dbo.tbl_support_admin_allowlist
        SET last_used_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME(),
            updated_by = @updated_by
        WHERE email_normalized = @email_normalized
          AND is_active = 1
      `);
    } catch (error) {
      console.warn("[support-admin-allowlist] Could not update last_used_at:", error.message || error);
    }
  }

  async function getAppUserByEmail(appPool, email) {
    const request = appPool.request();
    request.input("email", sanitizeEmail(email));
    const result = await request.query(`
      SELECT TOP 1
             u.user_id,
             u.username,
             u.email,
             u.password_hash,
             COALESCE(r.role_naam, u.role) AS role,
             u.is_super_admin
      FROM dbo.tbl_users u
      OUTER APPLY (
        SELECT TOP 1 ur.role_naam, ur.role_volgorde
        FROM dbo.vw_user_roles ur
        WHERE ur.user_id = u.user_id
        ORDER BY ur.role_volgorde
      ) r
      WHERE LOWER(u.email) = LOWER(@email)
    `);
    return result.recordset[0] || null;
  }

  async function ensureAllowlistedMicrosoftUser({ appPool, email, createPasswordHash }) {
    const normalizedEmail = sanitizeEmail(email);
    if (!normalizedEmail) return null;

    const allowlistEntry = await getAllowlistEntryByEmail(normalizedEmail);
    let user = await getAppUserByEmail(appPool, normalizedEmail);

    if (!allowlistEntry) {
      return user;
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("base64url");
      const passwordHash = createPasswordHash(randomPassword);
      const username = normalizedEmail.slice(0, 255);
      const insert = appPool.request();
      insert.input("username", username);
      insert.input("email", normalizedEmail);
      insert.input("password_hash", passwordHash);
      insert.input("role", SUPPORT_ADMIN_INTERNAL_ROLE);
      insert.input("is_super_admin", 1);
      await insert.query(`
        INSERT INTO dbo.tbl_users (username, email, password_hash, role, is_super_admin, created_at)
        VALUES (@username, @email, @password_hash, @role, @is_super_admin, GETDATE())
      `);
      user = await getAppUserByEmail(appPool, normalizedEmail);
    } else if (!user.is_super_admin || sanitizeEmail(user.role) !== SUPPORT_ADMIN_INTERNAL_ROLE) {
      const update = appPool.request();
      update.input("user_id", user.user_id);
      update.input("role", SUPPORT_ADMIN_INTERNAL_ROLE);
      await update.query("UPDATE dbo.tbl_users SET is_super_admin = 1, role = @role WHERE user_id = @user_id");
      user = await getAppUserByEmail(appPool, normalizedEmail);
    }

    await markAllowlistUsage(normalizedEmail, { updatedBy: `${appName}:${envName}` });
    return user;
  }

  if (enabled && !isConfigured) {
    console.warn(
      "[support-admin-allowlist] SUPPORT_ADMIN_ALLOWLIST_ENABLED is true, but SUPPORT_ADMIN_ALLOWLIST_DB_* config is incomplete."
    );
  }

  return {
    enabled: enabled && isConfigured,
    getAllowlistEntryByEmail,
    ensureAllowlistedMicrosoftUser,
  };
}

module.exports = { createSupportAdminAllowlist };
