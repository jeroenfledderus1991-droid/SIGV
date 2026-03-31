/* =========================================================
   WordBee Raw Endpoint Tables
   API -> dedicated raw SQL tables per endpoint
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'[dbo].[tbl_wordbee_projects_raw]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_wordbee_projects_raw](
        [project_id] BIGINT NOT NULL PRIMARY KEY,
        [reference] NVARCHAR(255) NULL,
        [status_code] NVARCHAR(80) NULL,
        [status_label] NVARCHAR(255) NULL,
        [client_name] NVARCHAR(255) NULL,
        [client_id] BIGINT NULL,
        [out_company_id] BIGINT NULL,
        [out_person_id] BIGINT NULL,
        [source_locale_code] NVARCHAR(80) NULL,
        [source_locale_label] NVARCHAR(80) NULL,
        [deadline_dt] DATETIME2(3) NULL,
        [created_dt] DATETIME2(3) NULL,
        [received_dt] DATETIME2(3) NULL,
        [in_progress_dt] DATETIME2(3) NULL,
        [completion_dt] DATETIME2(3) NULL,
        [archival_dt] DATETIME2(3) NULL,
        [instructions] NVARCHAR(MAX) NULL,
        [comments] NVARCHAR(MAX) NULL,
        [manager_name] NVARCHAR(255) NULL,
        [lblpro603] NVARCHAR(MAX) NULL,
        [lblpro604] NVARCHAR(MAX) NULL,
        [lblpro608] NVARCHAR(MAX) NULL,
        [lblpro610] NVARCHAR(MAX) NULL,
        [lblpro] NVARCHAR(MAX) NULL,
        [source_json] NVARCHAR(MAX) NOT NULL,
        [imported_at] DATETIME2(0) NOT NULL CONSTRAINT DF_tbl_wordbee_projects_raw_imported_at DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_tbl_wordbee_projects_raw_created_dt
        ON dbo.tbl_wordbee_projects_raw(created_dt);
END
GO

IF OBJECT_ID(N'[dbo].[tbl_wordbee_orders_raw]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_wordbee_orders_raw](
        [order_row_id] BIGINT NOT NULL PRIMARY KEY,
        [order_id] BIGINT NULL,
        [reference] NVARCHAR(255) NULL,
        [company_id] BIGINT NULL,
        [person_id] BIGINT NULL,
        [out_company_id] BIGINT NULL,
        [out_person_id] BIGINT NULL,
        [project_id] BIGINT NULL,
        [project_reference] NVARCHAR(255) NULL,
        [project_resource_id] BIGINT NULL,
        [status_code] NVARCHAR(80) NULL,
        [status_label] NVARCHAR(255) NULL,
        [source_locale_code] NVARCHAR(80) NULL,
        [source_locale_label] NVARCHAR(80) NULL,
        [created_dt] DATETIME2(3) NULL,
        [received_dt] DATETIME2(3) NULL,
        [deadline_dt] DATETIME2(3) NULL,
        [dtproposal_dt] DATETIME2(3) NULL,
        [dtaccepted_dt] DATETIME2(3) NULL,
        [dtcompleted_dt] DATETIME2(3) NULL,
        [dtclosed_dt] DATETIME2(3) NULL,
        [cford1] NVARCHAR(255) NULL,
        [cford2] NVARCHAR(255) NULL,
        [cford3] NVARCHAR(255) NULL,
        [lblord613] NVARCHAR(MAX) NULL,
        [lblord] NVARCHAR(MAX) NULL,
        [source_json] NVARCHAR(MAX) NOT NULL,
        [imported_at] DATETIME2(0) NOT NULL CONSTRAINT DF_tbl_wordbee_orders_raw_imported_at DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_tbl_wordbee_orders_raw_project_id
        ON dbo.tbl_wordbee_orders_raw(project_id);

    CREATE INDEX IX_tbl_wordbee_orders_raw_reference
        ON dbo.tbl_wordbee_orders_raw(reference);
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

IF OBJECT_ID(N'[dbo].[tbl_wordbee_resources_raw]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_wordbee_resources_raw](
        [resource_id] BIGINT NOT NULL PRIMARY KEY,
        [name] NVARCHAR(255) NULL,
        [segments] INT NULL,
        [source_json] NVARCHAR(MAX) NOT NULL,
        [imported_at] DATETIME2(0) NOT NULL CONSTRAINT DF_tbl_wordbee_resources_raw_imported_at DEFAULT SYSUTCDATETIME()
    );
END
GO
