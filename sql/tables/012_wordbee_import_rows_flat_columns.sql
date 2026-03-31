/* =========================================================
   WordBee Import Rows - Flat columns migration
   Alleen kolommen die in de editable tabel gebruikt worden
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'[dbo].[tbl_wordbee_import_rows]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'kenmerk') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD kenmerk NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'aanvraagnummer') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD aanvraagnummer NVARCHAR(120) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'status') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD status NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'brontaal') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD brontaal NVARCHAR(80) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'datum_van_ontvangst') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD datum_van_ontvangst NVARCHAR(40) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'deadline') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD deadline NVARCHAR(40) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'aanmaakdatum') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD aanmaakdatum NVARCHAR(40) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'datum_van_voorstel') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD datum_van_voorstel NVARCHAR(40) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'aanvaarde_datum') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD aanvaarde_datum NVARCHAR(40) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'proposal_initial_date') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD proposal_initial_date NVARCHAR(40) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'in_progress_initial_date') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD in_progress_initial_date NVARCHAR(40) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'nummer_rbtv') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD nummer_rbtv NVARCHAR(120) NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'aantal_vertaalde_woorden') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD aantal_vertaalde_woorden INT NULL;
    IF COL_LENGTH('dbo.tbl_wordbee_import_rows', 'voorstel_ander_deadline') IS NULL
        ALTER TABLE dbo.tbl_wordbee_import_rows ADD voorstel_ander_deadline NVARCHAR(255) NULL;

    EXEC sp_executesql N'
        UPDATE t
        SET
            kenmerk = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Kenmerk"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Kenmerk"''), ''''), NULL),
            aanvraagnummer = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Aanvraagnummer"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Aanvraagnummer"''), ''''), NULL),
            status = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Status"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Status"''), ''''), NULL),
            brontaal = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Brontaal"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Brontaal"''), ''''), NULL),
            datum_van_ontvangst = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Datum van ontvangst"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Datum van ontvangst"''), ''''), NULL),
            deadline = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Deadline"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Deadline"''), ''''), NULL),
            aanmaakdatum = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Aanmaakdatum"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Aanmaakdatum"''), ''''), NULL),
            datum_van_voorstel = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Datum van voorstel"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Datum van voorstel"''), ''''), NULL),
            aanvaarde_datum = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Aanvaarde datum"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Aanvaarde datum"''), ''''), NULL),
            proposal_initial_date = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Proposal (Initial) Date"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Proposal (Initial) Date"''), ''''), NULL),
            in_progress_initial_date = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."In Progress (Initial) Date"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."In Progress (Initial) Date"''), ''''), NULL),
            nummer_rbtv = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Nummer Rbtv"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Nummer Rbtv"''), ''''), NULL),
            aantal_vertaalde_woorden = COALESCE(
                TRY_CONVERT(INT, NULLIF(JSON_VALUE(t.manual_json, ''$."Aantal vertaalde woorden"''), '''')),
                TRY_CONVERT(INT, NULLIF(JSON_VALUE(t.source_json, ''$."Aantal vertaalde woorden"''), '''')),
                NULL
            ),
            voorstel_ander_deadline = COALESCE(NULLIF(JSON_VALUE(t.manual_json, ''$."Voorstel ander deadline"''), ''''), NULLIF(JSON_VALUE(t.source_json, ''$."Voorstel ander deadline"''), ''''), NULL)
        FROM dbo.tbl_wordbee_import_rows t;
    ';
END
GO
