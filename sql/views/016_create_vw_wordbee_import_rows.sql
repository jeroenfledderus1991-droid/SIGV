/*
    View: vw_wordbee_import_rows
    Purpose: Stable read interface voor WordBee maandimport + overrides
*/

IF OBJECT_ID('dbo.vw_wordbee_import_rows', 'V') IS NOT NULL
    DROP VIEW dbo.vw_wordbee_import_rows;
GO

CREATE VIEW dbo.vw_wordbee_import_rows
AS
SELECT
    id,
    row_key,
    period_year,
    period_month,
    external_id,
    source_hash,
    source_json,
    manual_json,
    kenmerk,
    aanvraagnummer,
    status,
    comments,
    brontaal,
    datum_van_ontvangst,
    deadline,
    aanmaakdatum,
    datum_van_voorstel,
    aanvaarde_datum,
    proposal_initial_date,
    in_progress_initial_date,
    nummer_rbtv,
    aantal_vertaalde_woorden,
    voorstel_ander_deadline,
    created_at,
    imported_at,
    updated_at,
    manual_updated_at
FROM
    dbo.tbl_wordbee_import_rows;
GO
