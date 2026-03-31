const crypto = require("crypto");

const FLAT_COLUMNS = [
  { label: "Kenmerk", db: "kenmerk" },
  { label: "Aanvraagnummer", db: "aanvraagnummer" },
  { label: "Status", db: "status" },
  { label: "Brontaal", db: "brontaal" },
  { label: "Datum van ontvangst", db: "datum_van_ontvangst" },
  { label: "Deadline", db: "deadline" },
  { label: "Aanmaakdatum", db: "aanmaakdatum" },
  { label: "Datum van voorstel", db: "datum_van_voorstel" },
  { label: "Aanvaarde datum", db: "aanvaarde_datum" },
  { label: "Proposal (Initial) Date", db: "proposal_initial_date" },
  { label: "In Progress (Initial) Date", db: "in_progress_initial_date" },
  { label: "Nummer Rbtv", db: "nummer_rbtv" },
  { label: "Aantal vertaalde woorden", db: "aantal_vertaalde_woorden" },
  { label: "Voorstel ander deadline", db: "voorstel_ander_deadline" },
];

const FLAT_SELECT_SQL = FLAT_COLUMNS.map(({ db }) => `        ${db}`).join(",\n");
const FLAT_INSERT_COLUMNS_SQL = FLAT_COLUMNS.map(({ db }) => `            ${db}`).join(",\n");
const FLAT_INSERT_VALUES_SQL = FLAT_COLUMNS.map(({ db }) => `            @${db}`).join(",\n");
const FLAT_UPDATE_SET_SQL = FLAT_COLUMNS.map(({ db }) => `        ${db} = @${db}`).join(",\n");

function safeJsonParse(value, fallback = {}) {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stripMetaFields(row) {
  if (!row || typeof row !== "object") return {};
  const cleaned = {};
  Object.entries(row).forEach(([key, value]) => {
    if (!key.startsWith("__")) cleaned[key] = value;
  });
  return cleaned;
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) return value.map((item) => sortObjectDeep(item));
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObjectDeep(value[key]);
      return acc;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(sortObjectDeep(value || {}));
}

function createHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function toPeriodTag(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function sanitizeKeyPart(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w\-\.]/g, "_")
    .slice(0, 120);
}

function resolveRowIdentity(row) {
  const externalId = String(row?.Aanvraagnummer || row?.Kenmerk || "").trim();
  const signature = [
    externalId,
    row?.Kenmerk || "",
    row?.Aanmaakdatum || "",
    row?.Brontaal || "",
    row?.["Nummer Rbtv"] || "",
  ].join("|");
  return {
    externalId: externalId || "unknown",
    signatureHash: crypto.createHash("sha1").update(signature).digest("hex").slice(0, 12),
  };
}

function normalizeFlatValue(label, value) {
  if (value === undefined || value === null) return null;
  if (label === "Aantal vertaalde woorden") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
  }
  const text = String(value);
  return text === "" ? null : text;
}

function buildFlatPayload(row) {
  const payload = {};
  FLAT_COLUMNS.forEach(({ label, db }) => {
    payload[db] = normalizeFlatValue(label, row?.[label]);
  });
  return payload;
}

function applyFlatInputs(request, payload) {
  FLAT_COLUMNS.forEach(({ db, label }) => {
    const rawValue = payload?.[db];
    if (label === "Aantal vertaalde woorden") {
      request.input(db, rawValue === null || rawValue === undefined ? null : Number(rawValue));
      return;
    }
    request.input(db, rawValue === null || rawValue === undefined ? null : String(rawValue));
  });
}

function buildRowFromFlatColumns(record) {
  if (!record || typeof record !== "object") return null;
  const row = {};
  let hasFlatData = false;
  FLAT_COLUMNS.forEach(({ label, db }) => {
    if (!Object.prototype.hasOwnProperty.call(record, db)) return;
    hasFlatData = true;
    const value = record[db];
    if (label === "Aantal vertaalde woorden") {
      row[label] = value === null || value === undefined ? "" : Number(value);
      return;
    }
    row[label] = value === null || value === undefined ? "" : value;
  });
  return hasFlatData ? row : null;
}

function mergeSourceAndManual(record) {
  const source = safeJsonParse(record?.source_json, {});
  const manual = safeJsonParse(record?.manual_json, {});
  return { ...source, ...manual };
}

function mapRecordToResponseRow(record) {
  const baseRow = buildRowFromFlatColumns(record) || mergeSourceAndManual(record);
  return {
    ...baseRow,
    __row_id: record.id,
    __row_key: record.row_key,
    __external_id: record.external_id,
    __period_year: record.period_year,
    __period_month: record.period_month,
    __imported_at: record.imported_at,
    __manual_updated_at: record.manual_updated_at,
  };
}

function buildManualDiff(sourceRow, editedRow) {
  const source = stripMetaFields(sourceRow);
  const edited = stripMetaFields(editedRow);
  const diff = {};
  Object.entries(edited).forEach(([key, value]) => {
    const sourceValue = source[key];
    if (stableStringify(sourceValue) !== stableStringify(value)) {
      diff[key] = value;
    }
  });
  return diff;
}

function createWordbeeImportStoreService({ db }) {
  async function listRowsAll() {
    const pool = await db.getPool();
    const result = await pool.request().query(`
      SELECT
        id,
        row_key,
        period_year,
        period_month,
        external_id,
        source_hash,
        source_json,
        manual_json,
${FLAT_SELECT_SQL},
        created_at,
        imported_at,
        updated_at,
        manual_updated_at
      FROM dbo.vw_wordbee_import_rows
      ORDER BY period_year DESC, period_month DESC, id DESC
    `);
    const rows = (result.recordset || []).map((record) => mapRecordToResponseRow(record));
    return {
      rows,
      count: rows.length,
    };
  }

  async function listRows(periodYear, periodMonth) {
    const pool = await db.getPool();
    const request = pool.request();
    request.input("period_year", Number(periodYear));
    request.input("period_month", Number(periodMonth));
    const result = await request.query(`
      SELECT
        id,
        row_key,
        period_year,
        period_month,
        external_id,
        source_hash,
        source_json,
        manual_json,
${FLAT_SELECT_SQL},
        created_at,
        imported_at,
        updated_at,
        manual_updated_at
      FROM dbo.vw_wordbee_import_rows
      WHERE period_year = @period_year
        AND period_month = @period_month
      ORDER BY id DESC
    `);
    const rows = (result.recordset || []).map((record) => mapRecordToResponseRow(record));
    return {
      rows,
      count: rows.length,
    };
  }

  async function upsertImportedRows(periodYear, periodMonth, sourceRows) {
    const year = Number(periodYear);
    const month = Number(periodMonth);
    const rows = Array.isArray(sourceRows) ? sourceRows : [];
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    const pool = await db.getPool();
    for (const row of rows) {
      const rowYear = Number.isInteger(Number(row?.__period_year)) ? Number(row.__period_year) : year;
      const rowMonth = Number.isInteger(Number(row?.__period_month)) ? Number(row.__period_month) : month;
      const periodTag = toPeriodTag(rowYear, rowMonth);
      const identity = resolveRowIdentity(row);
      const rowKey = `${periodTag}-${sanitizeKeyPart(identity.externalId)}-${identity.signatureHash}`;
      const sourcePayload = stripMetaFields(row);
      const sourceJson = stableStringify(sourcePayload);
      const sourceHash = createHash(sourceJson);

      const existingResult = await pool
        .request()
        .input("row_key", rowKey)
        .query(`
          SELECT TOP 1
            id,
            source_hash,
            manual_json
          FROM dbo.vw_wordbee_import_rows
          WHERE row_key = @row_key
        `);
      const current = existingResult.recordset?.[0];
      const manualPayload = safeJsonParse(current?.manual_json, {});
      const mergedPayload = current ? { ...sourcePayload, ...manualPayload } : sourcePayload;
      const flatPayload = buildFlatPayload(mergedPayload);

      if (!current) {
        const insertRequest = pool.request();
        insertRequest.input("row_key", rowKey);
        insertRequest.input("period_year", rowYear);
        insertRequest.input("period_month", rowMonth);
        insertRequest.input("external_id", identity.externalId);
        insertRequest.input("source_hash", sourceHash);
        insertRequest.input("source_json", sourceJson);
        applyFlatInputs(insertRequest, flatPayload);
        await insertRequest.query(`
          INSERT INTO dbo.tbl_wordbee_import_rows (
            row_key,
            period_year,
            period_month,
            external_id,
            source_hash,
            source_json,
${FLAT_INSERT_COLUMNS_SQL},
            imported_at,
            created_at
          )
          VALUES (
            @row_key,
            @period_year,
            @period_month,
            @external_id,
            @source_hash,
            @source_json,
${FLAT_INSERT_VALUES_SQL},
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
          )
        `);
        inserted += 1;
        continue;
      }

      if (String(current.source_hash || "") !== sourceHash) {
        const updateRequest = pool.request();
        updateRequest.input("row_key", rowKey);
        updateRequest.input("source_hash", sourceHash);
        updateRequest.input("source_json", sourceJson);
        applyFlatInputs(updateRequest, flatPayload);
        await updateRequest.query(`
          UPDATE dbo.tbl_wordbee_import_rows
          SET
            source_json = @source_json,
            source_hash = @source_hash,
${FLAT_UPDATE_SET_SQL},
            imported_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME()
          WHERE row_key = @row_key
        `);
        updated += 1;
        continue;
      }

      await pool.request().input("row_key", rowKey).query(`
        UPDATE dbo.tbl_wordbee_import_rows
        SET imported_at = SYSUTCDATETIME()
        WHERE row_key = @row_key
      `);
      unchanged += 1;
    }

    return {
      periodYear: year,
      periodMonth: month,
      totalReceived: rows.length,
      inserted,
      updated,
      unchanged,
    };
  }

  async function saveManualRow(rowId, editedRow) {
    const id = Number(rowId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Ongeldig row id.");
    }
    const pool = await db.getPool();
    const existing = await pool.request().input("id", id).query(`
      SELECT TOP 1
        id,
        row_key,
        period_year,
        period_month,
        external_id,
        source_json,
        manual_json,
${FLAT_SELECT_SQL},
        imported_at,
        manual_updated_at
      FROM dbo.vw_wordbee_import_rows
      WHERE id = @id
    `);
    const current = existing.recordset?.[0];
    if (!current) throw new Error("Rij niet gevonden.");

    const sourceObj = safeJsonParse(current.source_json, {});
    const manualDiff = buildManualDiff(sourceObj, editedRow);
    const hasManualDiff = Object.keys(manualDiff).length > 0;
    const mergedPayload = { ...sourceObj, ...manualDiff };
    const flatPayload = buildFlatPayload(mergedPayload);

    const saveRequest = pool.request();
    saveRequest.input("id", id);
    saveRequest.input("manual_json", hasManualDiff ? JSON.stringify(manualDiff) : null);
    applyFlatInputs(saveRequest, flatPayload);
    await saveRequest.query(`
      UPDATE dbo.tbl_wordbee_import_rows
      SET
        manual_json = @manual_json,
        manual_updated_at = CASE WHEN @manual_json IS NULL THEN NULL ELSE SYSUTCDATETIME() END,
        updated_at = SYSUTCDATETIME(),
${FLAT_UPDATE_SET_SQL}
      WHERE id = @id
    `);

    const refreshed = await pool.request().input("id", id).query(`
      SELECT TOP 1
        id,
        row_key,
        period_year,
        period_month,
        external_id,
        source_json,
        manual_json,
${FLAT_SELECT_SQL},
        imported_at,
        manual_updated_at
      FROM dbo.vw_wordbee_import_rows
      WHERE id = @id
    `);

    return mapRecordToResponseRow(refreshed.recordset?.[0] || current);
  }

  return {
    listRowsAll,
    listRows,
    upsertImportedRows,
    saveManualRow,
  };
}

module.exports = {
  createWordbeeImportStoreService,
};
