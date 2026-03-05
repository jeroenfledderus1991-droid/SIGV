function registerStamgegevensRoutes({ app, db, ensureDbConfigured, requireAuth, requirePermission }) {
  async function listStamgegevens(res, table, columns) {
    try {
      const pool = await db.getPool();
      const result = await pool
        .request()
        .query(`SELECT ${columns.join(", ")} FROM dbo.${table} ORDER BY volgorde, id`);
      res.json(result.recordset || []);
    } catch (error) {
      res.status(500).json({ error: `Failed to load ${table}.` });
    }
  }

  async function upsertStamgegevens(res, table, columns, data, id) {
    try {
      const pool = await db.getPool();
      const request = pool.request();
      const setClauses = [];
      for (const column of columns) {
        request.input(column, data[column] ?? null);
        setClauses.push(`${column} = @${column}`);
      }
      if (id) {
        request.input("id", id);
        await request.query(
          `UPDATE dbo.${table} SET ${setClauses.join(", ")}, updated_at = GETDATE() WHERE id = @id`
        );
      } else {
        const insertColumns = columns.join(", ");
        const insertValues = columns.map((column) => `@${column}`).join(", ");
        await request.query(`
          INSERT INTO dbo.${table} (${insertColumns}, volgorde, created_at)
          VALUES (${insertValues}, (SELECT ISNULL(MAX(volgorde), 0) + 1 FROM dbo.${table}), GETDATE())
        `);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: `Failed to save ${table}.` });
    }
  }

  async function deleteStamgegevens(res, table, id) {
    try {
      const pool = await db.getPool();
      const request = pool.request();
      request.input("id", id);
      await request.query(`DELETE FROM dbo.${table} WHERE id = @id`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: `Failed to delete ${table}.` });
    }
  }

  async function updateOrder(res, table, order) {
    try {
      const pool = await db.getPool();
      for (const entry of order) {
        const request = pool.request();
        request.input("id", entry.id);
        request.input("volgorde", entry.volgorde);
        await request.query(`UPDATE dbo.${table} SET volgorde = @volgorde WHERE id = @id`);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: `Failed to update ${table} order.` });
    }
  }

  app.get("/api/stamgegevens/statussen", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    listStamgegevens(res, "tbl_statussen", ["id", "status", "volgorde"]);
  });

  app.post("/api/stamgegevens/statussen", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    upsertStamgegevens(res, "tbl_statussen", ["status"], req.body, null);
  });

  app.put("/api/stamgegevens/statussen/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    upsertStamgegevens(res, "tbl_statussen", ["status"], req.body, Number(req.params.id));
  });

  app.delete("/api/stamgegevens/statussen/:id", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    deleteStamgegevens(res, "tbl_statussen", Number(req.params.id));
  });

  app.post("/api/stamgegevens/statussen/order", requireAuth, requirePermission("/stamgegevens*"), async (req, res) => {
    if (!(await ensureDbConfigured(res))) return;
    updateOrder(res, "tbl_statussen", req.body?.order || []);
  });
}

module.exports = { registerStamgegevensRoutes };
