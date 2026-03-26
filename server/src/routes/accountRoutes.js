function registerAccountRoutes({
  app,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
  SUPER_ADMIN_ROLE_NAME,
  isSuperAdminRoleName,
  getSuperAdminRoleId,
}) {
  const SUPPORT_ADMIN_INTERNAL_ROLE = "support_admin_int";

  app.get("/api/accounts/users", requireAuth, requirePermission("/accounts*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    try {
      const pool = await db.getPool();
      const request = pool.request();
      request.input("super_admin_name", SUPER_ADMIN_ROLE_NAME);
      request.input("support_admin_role", SUPPORT_ADMIN_INTERNAL_ROLE);
      const result = await request.query(`
        SELECT u.user_id AS id,
               u.username,
               u.email,
               CASE
                 WHEN u.is_super_admin = 1 THEN NULL
                 WHEN LOWER(COALESCE(r.role_naam, '')) = LOWER(@super_admin_name) THEN NULL
                 ELSE r.role_naam
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
        WHERE LOWER(COALESCE(u.role, '')) <> LOWER(@support_admin_role)
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
        SELECT TOP 1 user_id, email, is_super_admin, role
        FROM dbo.tbl_users
        WHERE user_id = @user_id
      `);
      const targetUser = userResult.recordset[0];
      if (!targetUser) {
        return res.status(404).json({ error: "Gebruiker niet gevonden." });
      }
      if (String(targetUser.role || "").toLowerCase() === SUPPORT_ADMIN_INTERNAL_ROLE) {
        return res.status(403).json({ error: "Dit support admin account kan niet worden aangepast." });
      }
      if (wantsSuperAdminChange && !req.user?.is_super_admin) {
        return res.status(403).json({ error: "Alleen een Super Admin mag Super Admin toewijzen of intrekken." });
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
        update.input("is_super_admin", nextIsSuperAdmin ? 1 : 0);
        await update.query("UPDATE dbo.tbl_users SET is_super_admin = @is_super_admin WHERE user_id = @user_id");
      } else {
        const update = pool.request();
        update.input("user_id", userId);
        update.input("is_super_admin", nextIsSuperAdmin ? 1 : 0);
        await update.query("UPDATE dbo.tbl_users SET is_super_admin = @is_super_admin WHERE user_id = @user_id");
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
        SELECT TOP 1 email, role
        FROM dbo.tbl_users
        WHERE user_id = @user_id
      `);
      const targetUser = userResult.recordset[0];
      if (!targetUser) {
        return res.status(404).json({ error: "Gebruiker niet gevonden." });
      }
      if (String(targetUser.role || "").toLowerCase() === SUPPORT_ADMIN_INTERNAL_ROLE) {
        return res.status(403).json({ error: "Dit support admin account kan niet worden verwijderd." });
      }

      const request = pool.request();
      request.input("user_id", userId);
      await request.query("DELETE FROM dbo.tbl_users WHERE user_id = @user_id");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user." });
    }
  });
}

module.exports = { registerAccountRoutes };
