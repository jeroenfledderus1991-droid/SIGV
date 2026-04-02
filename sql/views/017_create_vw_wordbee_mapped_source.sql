/*
    View: vw_wordbee_mapped_source
    Purpose: mapped leeslaag op basis van 4 WordBee raw tabellen
*/

IF OBJECT_ID('dbo.vw_wordbee_mapped_source', 'V') IS NOT NULL
    DROP VIEW dbo.vw_wordbee_mapped_source;
GO

CREATE VIEW dbo.vw_wordbee_mapped_source
AS
WITH jobs_agg AS (
    SELECT
        j.project_id,
        MIN(j.dtpassign_dt) AS first_proposal_dt,
        MIN(j.dtcassign_dt) AS first_accepted_dt,
        MIN(j.dtstart_dt) AS first_in_progress_dt
    FROM dbo.tbl_wordbee_jobs_raw j
    GROUP BY j.project_id
),
orders_ranked AS (
    SELECT
        o.*,
        CASE
            WHEN ISJSON(o.lblord613) = 1
                 AND TRY_CONVERT(INT, JSON_VALUE(o.lblord613, '$.xp')) = 0
                 AND TRY_CONVERT(INT, JSON_VALUE(o.lblord613, '$.cnt')) = 0
                THEN NULL
            ELSE NULLIF(LTRIM(RTRIM(o.lblord613)), '')
        END AS lblord613_clean,
        CASE
            WHEN ISJSON(o.lblord) = 1
                 AND TRY_CONVERT(INT, JSON_VALUE(o.lblord, '$.xp')) = 0
                 AND TRY_CONVERT(INT, JSON_VALUE(o.lblord, '$.cnt')) = 0
                THEN NULL
            ELSE NULLIF(LTRIM(RTRIM(o.lblord)), '')
        END AS lblord_clean,
        ROW_NUMBER() OVER (
            PARTITION BY o.project_id
            ORDER BY
                o.created_dt DESC,
                o.order_row_id DESC
        ) AS rn
    FROM dbo.tbl_wordbee_orders_raw o
),
best_orders AS (
    SELECT *
    FROM orders_ranked
    WHERE rn = 1
)
SELECT
    p.reference AS [Kenmerk],
    CONVERT(NVARCHAR(120), p.project_id) AS [Aanvraagnummer],
    CASE
        WHEN st.status_norm IN ('in progress', 'in-progress') THEN N'In uitvoering'
        WHEN st.status_norm IN ('results approved', 'result approved', 'approved') THEN N'Resultaten goedgekeurd'
        WHEN st.status_norm IN ('request', 'proposal', 'waiting') THEN N'Verzoek'
        WHEN st.status_norm IN ('work done', 'done', 'completed') THEN N'Werk klaar'
        WHEN st.status_norm IN ('cancelled', 'canceled') THEN N'Geannuleerd'
        ELSE COALESCE(st.status_raw, '')
    END AS [Status],
    COALESCE(
        NULLIF(LTRIM(RTRIM(JSON_VALUE(o.source_json, '$.comments'))), ''),
        NULLIF(LTRIM(RTRIM(p.comments)), ''),
        NULLIF(LTRIM(RTRIM(JSON_VALUE(p.source_json, '$.comments'))), '')
    ) AS [Comments],
    COALESCE(NULLIF(LTRIM(RTRIM(p.source_locale_label)), ''), NULLIF(LTRIM(RTRIM(p.source_locale_code)), '')) AS [Brontaal],
    CASE
        WHEN dt.received_dt IS NULL THEN ''
        ELSE FORMAT((dt.received_dt AT TIME ZONE 'UTC') AT TIME ZONE 'W. Europe Standard Time', 'dd-MM-yyyy HH:mm:ss', 'nl-NL')
    END AS [Datum van ontvangst],
    CASE
        WHEN dt.deadline_dt IS NULL THEN ''
        ELSE FORMAT((dt.deadline_dt AT TIME ZONE 'UTC') AT TIME ZONE 'W. Europe Standard Time', 'dd-MM-yyyy HH:mm:ss', 'nl-NL')
    END AS [Deadline],
    CASE
        WHEN dt.created_dt IS NULL THEN ''
        ELSE FORMAT((dt.created_dt AT TIME ZONE 'UTC') AT TIME ZONE 'W. Europe Standard Time', 'dd-MM-yyyy HH:mm:ss', 'nl-NL')
    END AS [Aanmaakdatum],
    CASE
        WHEN dt.proposal_dt IS NULL THEN ''
        ELSE FORMAT((dt.proposal_dt AT TIME ZONE 'UTC') AT TIME ZONE 'W. Europe Standard Time', 'dd-MM-yyyy HH:mm:ss', 'nl-NL')
    END AS [Datum van voorstel],
    CASE
        WHEN dt.accepted_dt IS NULL THEN ''
        ELSE FORMAT((dt.accepted_dt AT TIME ZONE 'UTC') AT TIME ZONE 'W. Europe Standard Time', 'dd-MM-yyyy HH:mm:ss', 'nl-NL')
    END AS [Aanvaarde datum],
    CASE
        WHEN dt.proposal_initial_dt IS NULL THEN ''
        ELSE FORMAT((dt.proposal_initial_dt AT TIME ZONE 'UTC') AT TIME ZONE 'W. Europe Standard Time', 'dd-MM-yyyy HH:mm:ss', 'nl-NL')
    END AS [Proposal (Initial) Date],
    CASE
        WHEN dt.in_progress_initial_dt IS NULL THEN ''
        ELSE FORMAT((dt.in_progress_initial_dt AT TIME ZONE 'UTC') AT TIME ZONE 'W. Europe Standard Time', 'dd-MM-yyyy HH:mm:ss', 'nl-NL')
    END AS [In Progress (Initial) Date],
    COALESCE(
        NULLIF(LTRIM(RTRIM(o.cford2)), ''),
        NULLIF(LTRIM(RTRIM(o.cford3)), '')
    ) AS [Nummer Rbtv],
    TRY_CONVERT(INT, r.segments) AS [Aantal vertaalde woorden],
    COALESCE(
        NULLIF(LTRIM(RTRIM(o.cford3)), ''),
        o.lblord613_clean,
        o.lblord_clean
    ) AS [Voorstel ander deadline],
    YEAR(dt.created_dt) AS [period_year],
    MONTH(dt.created_dt) AS [period_month],
    dt.created_dt AS [created_dt_utc]
FROM dbo.tbl_wordbee_projects_raw p
LEFT JOIN best_orders o
    ON o.project_id = p.project_id
LEFT JOIN jobs_agg ja
    ON ja.project_id = p.project_id
LEFT JOIN dbo.tbl_wordbee_resources_raw r
    ON r.resource_id = o.project_resource_id
OUTER APPLY (
    SELECT
        COALESCE(
            NULLIF(LTRIM(RTRIM(o.status_label)), ''),
            NULLIF(LTRIM(RTRIM(o.status_code)), ''),
            NULLIF(LTRIM(RTRIM(p.status_label)), ''),
            NULLIF(LTRIM(RTRIM(p.status_code)), '')
        ) AS status_raw,
        LOWER(LTRIM(RTRIM(COALESCE(
            NULLIF(LTRIM(RTRIM(o.status_label)), ''),
            NULLIF(LTRIM(RTRIM(o.status_code)), ''),
            NULLIF(LTRIM(RTRIM(p.status_label)), ''),
            NULLIF(LTRIM(RTRIM(p.status_code)), '')
        )))) AS status_norm
) st
OUTER APPLY (
    SELECT
        COALESCE(o.created_dt, p.created_dt, p.received_dt) AS created_dt,
        COALESCE(o.received_dt, p.received_dt) AS received_dt,
        COALESCE(o.deadline_dt, p.deadline_dt) AS deadline_dt,
        COALESCE(o.dtproposal_dt, ja.first_proposal_dt) AS proposal_dt,
        COALESCE(o.dtaccepted_dt, ja.first_accepted_dt) AS accepted_dt,
        COALESCE(ja.first_proposal_dt, o.dtproposal_dt) AS proposal_initial_dt,
        COALESCE(ja.first_in_progress_dt, p.in_progress_dt) AS in_progress_initial_dt
) dt;
GO
