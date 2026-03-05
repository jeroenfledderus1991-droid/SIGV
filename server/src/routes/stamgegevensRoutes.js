function registerStamgegevensRoutes({ app, db, ensureDbConfigured, requireAuth, requirePermission }) {
  async function listStatussen(res) {
    try {
      const pool = await db.getPool();
      const result = await pool.request().query(`
        IF OBJECT_ID('dbo.vw_statussen','V') IS NOT NULL
          SELECT id, status, volgorde
          FROM dbo.vw_statussen
          ORDER BY volgorde, id
        ELSE
          SELECT id, status, volgorde
          FROM dbo.tbl_statussen
          ORDER BY volgorde, id
      `);
      res.json(result.recordset || []);
    } catch (error) {
      res.status(500).json({ error: "Failed to load statussen." });
    }
  }

  async function createStatus(res, data) {
    try {
      const pool = await db.getPool();
      const request = pool.request();
      request.input("status", data?.status ?? null);
      await request.query(`
        INSERT INTO dbo.tbl_statussen (status, volgorde, created_at)
        VALUES (@status, (SELECT ISNULL(MAX(volgorde), 0) + 1 FROM dbo.tbl_statussen), GETDATE())
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save status." });
    }
  }

  async function updateStatus(res, data, id) {
    try {
      const pool = await db.getPool();
      const request = pool.request();
      request.input("status", data?.status ?? null);
      request.input("id", id);
      await request.query(`
        UPDATE dbo.tbl_statussen
        SET status = @status, updated_at = GETDATE()
        WHERE id = @id
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update status." });
    }
  }

  async function deleteStatus(res, id) {
    try {
      const pool = await db.getPool();
      const request = pool.request();
      request.input("id", id);
      await request.query(`DELETE FROM dbo.tbl_statussen WHERE id = @id`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete status." });
    }
  }

  async function updateStatusOrder(res, order) {
    try {
      const pool = await db.getPool();
      for (const entry of order) {
        const request = pool.request();
        request.input("id", entry.id);
        request.input("volgorde", entry.volgorde);
        await request.query(`
          UPDATE dbo.tbl_statussen
          SET volgorde = @volgorde
          WHERE id = @id
        `);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update status order." });
    }
  }

  app.get("/api/stamgegevens/statussen", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    listStatussen(res);
  });

  app.post("/api/stamgegevens/statussen", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    createStatus(res, req.body);
  });

  app.put("/api/stamgegevens/statussen/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    updateStatus(res, req.body, Number(req.params.id));
  });

  app.delete("/api/stamgegevens/statussen/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    deleteStatus(res, Number(req.params.id));
  });

  app.post("/api/stamgegevens/statussen/order", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    updateStatusOrder(res, req.body?.order || []);
  });
}

module.exports = { registerStamgegevensRoutes };
