/* =========================================================
   WordBee Import Rows Table
   Stores source payload + manual overrides per maand/jaar
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_wordbee_import_rows]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[tbl_wordbee_import_rows](
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [row_key] NVARCHAR(220) NOT NULL,
        [period_year] INT NOT NULL,
        [period_month] INT NOT NULL,
        [external_id] NVARCHAR(120) NOT NULL,
        [source_hash] CHAR(64) NOT NULL,
        [source_json] NVARCHAR(MAX) NOT NULL,
        [manual_json] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2(0) NOT NULL CONSTRAINT DF_tbl_wordbee_import_rows_created_at DEFAULT SYSUTCDATETIME(),
        [imported_at] DATETIME2(0) NOT NULL CONSTRAINT DF_tbl_wordbee_import_rows_imported_at DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2(0) NULL,
        [manual_updated_at] DATETIME2(0) NULL
    );

    CREATE UNIQUE INDEX UX_tbl_wordbee_import_rows_row_key
        ON dbo.tbl_wordbee_import_rows(row_key);

    CREATE INDEX IX_tbl_wordbee_import_rows_period
        ON dbo.tbl_wordbee_import_rows(period_year, period_month, external_id);

    PRINT 'Table tbl_wordbee_import_rows created successfully';
END
GO
