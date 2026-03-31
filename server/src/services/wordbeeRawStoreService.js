const { MAPPED_COLUMNS } = require("./wordbeeMappingConfig");

const RAW_DATASETS = {
  projects: {
    table: "tbl_wordbee_projects_raw",
    truncateSql: "TRUNCATE TABLE dbo.tbl_wordbee_projects_raw;",
    insertSql: `
      INSERT INTO dbo.tbl_wordbee_projects_raw (
        project_id,
        reference,
        status_code,
        status_label,
        client_name,
        client_id,
        out_company_id,
        out_person_id,
        source_locale_code,
        source_locale_label,
        deadline_dt,
        created_dt,
        received_dt,
        in_progress_dt,
        completion_dt,
        archival_dt,
        instructions,
        comments,
        manager_name,
        lblpro603,
        lblpro604,
        lblpro608,
        lblpro610,
        lblpro,
        source_json
      )
      SELECT
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.id')) AS project_id,
        LEFT(JSON_VALUE(j.value, '$.reference'), 255) AS reference,
        LEFT(JSON_VALUE(j.value, '$.status'), 80) AS status_code,
        LEFT(JSON_VALUE(j.value, '$.statust'), 255) AS status_label,
        LEFT(JSON_VALUE(j.value, '$.client'), 255) AS client_name,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.clientid')) AS client_id,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.outCompanyId')) AS out_company_id,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.outPersonId')) AS out_person_id,
        LEFT(JSON_VALUE(j.value, '$.src'), 80) AS source_locale_code,
        LEFT(JSON_VALUE(j.value, '$.srct'), 80) AS source_locale_label,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.deadline')) AS datetime2(3)) AS deadline_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.created')) AS datetime2(3)) AS created_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtreceived')) AS datetime2(3)) AS received_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtinprogress')) AS datetime2(3)) AS in_progress_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtcompletion')) AS datetime2(3)) AS completion_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtarchival')) AS datetime2(3)) AS archival_dt,
        JSON_VALUE(j.value, '$.instructions') AS instructions,
        JSON_VALUE(j.value, '$.comments') AS comments,
        LEFT(JSON_VALUE(j.value, '$.managernm'), 255) AS manager_name,
        JSON_VALUE(j.value, '$.lblpro603') AS lblpro603,
        JSON_VALUE(j.value, '$.lblpro604') AS lblpro604,
        JSON_VALUE(j.value, '$.lblpro608') AS lblpro608,
        JSON_VALUE(j.value, '$.lblpro610') AS lblpro610,
        JSON_VALUE(j.value, '$.lblpro') AS lblpro,
        j.value AS source_json
      FROM OPENJSON(@payload) j
      WHERE TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.id')) IS NOT NULL;
    `,
  },
  orders: {
    table: "tbl_wordbee_orders_raw",
    truncateSql: "TRUNCATE TABLE dbo.tbl_wordbee_orders_raw;",
    insertSql: `
      INSERT INTO dbo.tbl_wordbee_orders_raw (
        order_row_id,
        order_id,
        reference,
        company_id,
        person_id,
        out_company_id,
        out_person_id,
        project_id,
        project_reference,
        project_resource_id,
        status_code,
        status_label,
        source_locale_code,
        source_locale_label,
        created_dt,
        received_dt,
        deadline_dt,
        dtproposal_dt,
        dtaccepted_dt,
        dtcompleted_dt,
        dtclosed_dt,
        cford1,
        cford2,
        cford3,
        lblord613,
        lblord,
        source_json
      )
      SELECT
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.id')) AS order_row_id,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.orderId')) AS order_id,
        LEFT(JSON_VALUE(j.value, '$.reference'), 255) AS reference,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.companyId')) AS company_id,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.personId')) AS person_id,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.outCompanyId')) AS out_company_id,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.outPersonId')) AS out_person_id,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.projectId')) AS project_id,
        LEFT(JSON_VALUE(j.value, '$.projectReference'), 255) AS project_reference,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.projectResourceId')) AS project_resource_id,
        LEFT(JSON_VALUE(j.value, '$.status'), 80) AS status_code,
        LEFT(JSON_VALUE(j.value, '$.statust'), 255) AS status_label,
        LEFT(JSON_VALUE(j.value, '$.src'), 80) AS source_locale_code,
        LEFT(JSON_VALUE(j.value, '$.srct'), 80) AS source_locale_label,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.created')) AS datetime2(3)) AS created_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtreceived')) AS datetime2(3)) AS received_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.deadline')) AS datetime2(3)) AS deadline_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtproposal')) AS datetime2(3)) AS dtproposal_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtaccepted')) AS datetime2(3)) AS dtaccepted_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtcompleted')) AS datetime2(3)) AS dtcompleted_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtclosed')) AS datetime2(3)) AS dtclosed_dt,
        LEFT(JSON_VALUE(j.value, '$.cford1'), 255) AS cford1,
        LEFT(JSON_VALUE(j.value, '$.cford2'), 255) AS cford2,
        LEFT(JSON_VALUE(j.value, '$.cford3'), 255) AS cford3,
        JSON_VALUE(j.value, '$.lblord613') AS lblord613,
        JSON_VALUE(j.value, '$.lblord') AS lblord,
        j.value AS source_json
      FROM OPENJSON(@payload) j
      WHERE TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.id')) IS NOT NULL;
    `,
  },
  jobs: {
    table: "tbl_wordbee_jobs_raw",
    truncateSql: "TRUNCATE TABLE dbo.tbl_wordbee_jobs_raw;",
    insertSql: `
      INSERT INTO dbo.tbl_wordbee_jobs_raw (
        job_row_key,
        job_id,
        project_id,
        reference,
        created_dt,
        dtpassign_dt,
        dtcassign_dt,
        dtstart_dt,
        dtend_dt,
        openings,
        segments,
        source_json
      )
      SELECT
        LEFT(JSON_VALUE(j.value, '$.id'), 120) AS job_row_key,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.jobid')) AS job_id,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.pid')) AS project_id,
        LEFT(JSON_VALUE(j.value, '$.reference'), 255) AS reference,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.created')) AS datetime2(3)) AS created_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtpassign')) AS datetime2(3)) AS dtpassign_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtcassign')) AS datetime2(3)) AS dtcassign_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtstart')) AS datetime2(3)) AS dtstart_dt,
        TRY_CAST(TRY_CONVERT(datetimeoffset(7), JSON_VALUE(j.value, '$.dtend')) AS datetime2(3)) AS dtend_dt,
        TRY_CONVERT(INT, JSON_VALUE(j.value, '$.openings')) AS openings,
        TRY_CONVERT(INT, JSON_VALUE(j.value, '$.segments')) AS segments,
        j.value AS source_json
      FROM OPENJSON(@payload) j
      WHERE NULLIF(LTRIM(RTRIM(JSON_VALUE(j.value, '$.id'))), '') IS NOT NULL
        AND TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.pid')) IS NOT NULL;
    `,
  },
  resources: {
    table: "tbl_wordbee_resources_raw",
    truncateSql: "TRUNCATE TABLE dbo.tbl_wordbee_resources_raw;",
    insertSql: `
      INSERT INTO dbo.tbl_wordbee_resources_raw (
        resource_id,
        name,
        segments,
        source_json
      )
      SELECT
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.id')) AS resource_id,
        LEFT(JSON_VALUE(j.value, '$.name'), 255) AS name,
        TRY_CONVERT(INT, JSON_VALUE(j.value, '$.segments')) AS segments,
        j.value AS source_json
      FROM OPENJSON(@payload) j
      WHERE TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.id')) IS NOT NULL;
    `,
  },
};

const RAW_DATASET_ORDER = ["projects", "orders", "jobs", "resources"];

function chunkArray(values, chunkSize) {
  const size = Math.max(1, Number(chunkSize) || 1);
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function getMappedSelectSql() {
  const columns = MAPPED_COLUMNS.map((columnName) => `[${columnName}]`).join(",\n        ");
  return `
      SELECT
        ${columns},
        period_year AS [__period_year],
        period_month AS [__period_month]
      FROM dbo.vw_wordbee_mapped_source
      WHERE period_year = @period_year
        AND period_month <= @period_month
      ORDER BY created_dt_utc DESC, [Kenmerk] DESC
    `;
}

function createWordbeeRawStoreService({ db }) {
  async function replaceDatasetRows(datasetKey, rows, options = {}) {
    const dataset = RAW_DATASETS[datasetKey];
    if (!dataset) {
      throw new Error(`Onbekend raw dataset '${datasetKey}'.`);
    }
    const payloadRows = Array.isArray(rows) ? rows : [];
    const chunkSize = Number.isFinite(options.chunkSize) && options.chunkSize > 0 ? Math.floor(options.chunkSize) : 250;
    const pool = await db.getPool();

    await pool.request().query(dataset.truncateSql);
    if (!payloadRows.length) {
      return {
        dataset: datasetKey,
        table: dataset.table,
        received: 0,
        inserted: 0,
      };
    }

    let inserted = 0;
    const chunks = chunkArray(payloadRows, chunkSize);
    for (const rowsChunk of chunks) {
      const request = pool.request();
      request.input("payload", JSON.stringify(rowsChunk));
      const result = await request.query(dataset.insertSql);
      inserted += Number(result.rowsAffected?.[0] || 0);
    }

    return {
      dataset: datasetKey,
      table: dataset.table,
      received: payloadRows.length,
      inserted,
    };
  }

  async function getMappedRowsForPeriod(periodYear, periodMonth) {
    const year = Number(periodYear);
    const month = Number(periodMonth);
    const pool = await db.getPool();
    const request = pool.request();
    request.input("period_year", year);
    request.input("period_month", month);
    const result = await request.query(getMappedSelectSql());
    return result.recordset || [];
  }

  return {
    rawDatasetOrder: RAW_DATASET_ORDER,
    replaceDatasetRows,
    getMappedRowsForPeriod,
  };
}

module.exports = {
  createWordbeeRawStoreService,
};
