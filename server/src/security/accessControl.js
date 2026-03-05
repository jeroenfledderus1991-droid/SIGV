function createAccessControl({
  db,
  auth,
  crypto,
  config,
  ensureDbConfigured,
  readCookie,
  setCsrfCookie,
  csrfCookieName,
  superAdminRoleName,
  eesaSuperAdminEmail,
}) {
  function normalizeEmail(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function isEesaSuperAdminEmail(value) {
    return normalizeEmail(value) === eesaSuperAdminEmail;
  }

  function isSuperAdminRoleName(value) {
    return String(value || "")
      .trim()
      .toLowerCase() === superAdminRoleName.toLowerCase();
  }

  async function getSuperAdminRoleId(pool) {
    const request = pool.request();
    request.input("role_name", superAdminRoleName);
    const result = await request.query(`
      SELECT TOP 1 id
      FROM dbo.tbl_roles
      WHERE LOWER(naam) = LOWER(@role_name)
      ORDER BY id
    `);
    return Number(result.recordset[0]?.id) || null;
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
      if (config.csrfEnabled && !readCookie(req, csrfCookieName)) {
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

  return {
    requireAuth,
    loadPermissions,
    requirePermission,
    isEesaSuperAdminEmail,
    isSuperAdminRoleName,
    getSuperAdminRoleId,
  };
}

module.exports = { createAccessControl };
