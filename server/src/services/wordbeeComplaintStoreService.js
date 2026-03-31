function normalizeComplaintText(value) {
  const text = String(value || "").trim();
  return text || "";
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("Datum moet in formaat JJJJ-MM-DD staan.");
  }
  return text;
}

function mapComplaintRecord(record) {
  if (!record) return null;
  return {
    id: Number(record.id),
    kenmerk: String(record.kenmerk || ""),
    complaintText: String(record.complaint_text || ""),
    complaintDate: record.complaint_date || null,
    actionsTaken: String(record.actions_taken || ""),
    resolvedDate: record.resolved_date || null,
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
    createdByDisplay: record.created_by_display || "",
    updatedByDisplay: record.updated_by_display || "",
  };
}

function getUserDisplay(user) {
  if (!user || typeof user !== "object") return "";
  return String(user.display_name || user.name || user.email || user.username || "").trim();
}

function createWordbeeComplaintStoreService({ db }) {
  async function listComplaints() {
    const pool = await db.getPool();
    const result = await pool.request().query(`
      SELECT
        id,
        kenmerk,
        complaint_text,
        complaint_date,
        actions_taken,
        resolved_date,
        created_by_display,
        updated_by_display,
        created_at,
        updated_at
      FROM dbo.vw_wordbee_complaints
      ORDER BY updated_at DESC, id DESC
    `);
    return (result.recordset || []).map((record) => mapComplaintRecord(record));
  }

  async function saveComplaint({ kenmerk, complaintText, complaintDate, actionsTaken, resolvedDate, user }) {
    const normalizedKenmerk = String(kenmerk || "").trim();
    if (!normalizedKenmerk) {
      throw new Error("Kenmerk is verplicht.");
    }

    const normalizedComplaintText = normalizeComplaintText(complaintText);
    const normalizedActionsTaken = normalizeComplaintText(actionsTaken);
    const normalizedComplaintDate = normalizeDate(complaintDate);
    const normalizedResolvedDate = normalizeDate(resolvedDate);
    const pool = await db.getPool();
    const existingRequest = pool.request();
    existingRequest.input("kenmerk", normalizedKenmerk);
    const existing = await existingRequest.query(`
      SELECT TOP 1 id
      FROM dbo.vw_wordbee_complaints
      WHERE kenmerk = @kenmerk
    `);
    const existingRow = existing.recordset?.[0] || null;

    if (!normalizedComplaintText && !normalizedActionsTaken && !normalizedComplaintDate && !normalizedResolvedDate) {
      if (existingRow) {
        const deleteRequest = pool.request();
        deleteRequest.input("id", Number(existingRow.id));
        await deleteRequest.query(`
          DELETE FROM dbo.tbl_wordbee_complaints
          WHERE id = @id
        `);
      }
      return null;
    }

    const userId = Number.isInteger(Number(user?.user_id)) ? Number(user.user_id) : null;
    const userDisplay = getUserDisplay(user) || "Onbekend";

    if (existingRow) {
      const updateRequest = pool.request();
      updateRequest.input("id", Number(existingRow.id));
      updateRequest.input("complaint_text", normalizedComplaintText);
      updateRequest.input("complaint_date", normalizedComplaintDate);
      updateRequest.input("actions_taken", normalizedActionsTaken);
      updateRequest.input("resolved_date", normalizedResolvedDate);
      updateRequest.input("updated_by_user_id", userId);
      updateRequest.input("updated_by_display", userDisplay);
      await updateRequest.query(`
        UPDATE dbo.tbl_wordbee_complaints
        SET
          complaint_text = @complaint_text,
          complaint_date = @complaint_date,
          actions_taken = @actions_taken,
          resolved_date = @resolved_date,
          updated_by_user_id = @updated_by_user_id,
          updated_by_display = @updated_by_display,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id
      `);
    } else {
      const insertRequest = pool.request();
      insertRequest.input("kenmerk", normalizedKenmerk);
      insertRequest.input("complaint_text", normalizedComplaintText);
      insertRequest.input("complaint_date", normalizedComplaintDate);
      insertRequest.input("actions_taken", normalizedActionsTaken);
      insertRequest.input("resolved_date", normalizedResolvedDate);
      insertRequest.input("created_by_user_id", userId);
      insertRequest.input("created_by_display", userDisplay);
      insertRequest.input("updated_by_user_id", userId);
      insertRequest.input("updated_by_display", userDisplay);
      await insertRequest.query(`
        INSERT INTO dbo.tbl_wordbee_complaints (
          kenmerk,
          complaint_text,
          complaint_date,
          actions_taken,
          resolved_date,
          created_by_user_id,
          created_by_display,
          updated_by_user_id,
          updated_by_display,
          created_at,
          updated_at
        )
        VALUES (
          @kenmerk,
          @complaint_text,
          @complaint_date,
          @actions_taken,
          @resolved_date,
          @created_by_user_id,
          @created_by_display,
          @updated_by_user_id,
          @updated_by_display,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        )
      `);
    }

    const refreshedRequest = pool.request();
    refreshedRequest.input("kenmerk", normalizedKenmerk);
    const refreshed = await refreshedRequest.query(`
      SELECT TOP 1
        id,
        kenmerk,
        complaint_text,
        complaint_date,
        actions_taken,
        resolved_date,
        created_by_display,
        updated_by_display,
        created_at,
        updated_at
      FROM dbo.vw_wordbee_complaints
      WHERE kenmerk = @kenmerk
    `);
    return mapComplaintRecord(refreshed.recordset?.[0] || null);
  }

  return {
    listComplaints,
    saveComplaint,
  };
}

module.exports = {
  createWordbeeComplaintStoreService,
};
