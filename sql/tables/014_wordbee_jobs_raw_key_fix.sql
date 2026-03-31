/* =========================================================
   WordBee Jobs Raw Table key fix
   Ensure job row key is NVARCHAR (API id like 's58195')
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'[dbo].[tbl_wordbee_jobs_raw]', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.tbl_wordbee_jobs_raw', 'job_row_key') IS NULL
BEGIN
    DROP TABLE dbo.tbl_wordbee_jobs_raw;
END
GO

IF OBJECT_ID(N'[dbo].[tbl_wordbee_jobs_raw]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_wordbee_jobs_raw](
        [job_row_key] NVARCHAR(120) NOT NULL PRIMARY KEY,
        [job_id] BIGINT NULL,
        [project_id] BIGINT NOT NULL,
        [reference] NVARCHAR(255) NULL,
        [created_dt] DATETIME2(3) NULL,
        [dtpassign_dt] DATETIME2(3) NULL,
        [dtcassign_dt] DATETIME2(3) NULL,
        [dtstart_dt] DATETIME2(3) NULL,
        [dtend_dt] DATETIME2(3) NULL,
        [openings] INT NULL,
        [segments] INT NULL,
        [source_json] NVARCHAR(MAX) NOT NULL,
        [imported_at] DATETIME2(0) NOT NULL CONSTRAINT DF_tbl_wordbee_jobs_raw_imported_at DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_tbl_wordbee_jobs_raw_project_id
        ON dbo.tbl_wordbee_jobs_raw(project_id);
END
GO
