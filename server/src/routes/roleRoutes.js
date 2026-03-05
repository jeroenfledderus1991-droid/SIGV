function registerRoleRoutes({
  app,
  db,
  ensureDbConfigured,
  requireAuth,
  requirePermission,
  PAGE_PATTERNS,
  SUPER_ADMIN_ROLE_NAME,
  isSuperAdminRoleName,
  getSuperAdminRoleId,
}) {
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
}

module.exports = { registerRoleRoutes };
