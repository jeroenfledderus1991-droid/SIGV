/*
    Table: tbl_wordbee_complaints
    Purpose: Handmatige klachten koppelen aan WordBee kenmerk zodat deze behouden blijven na API refresh.
*/

IF NOT EXISTS (
    SELECT *
    FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[tbl_wordbee_complaints]')
      AND type IN (N'U')
)
BEGIN
    CREATE TABLE [dbo].[tbl_wordbee_complaints] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [kenmerk] NVARCHAR(255) NOT NULL,
        [complaint_text] NVARCHAR(MAX) NOT NULL,
        [created_by_user_id] INT NULL,
        [created_by_display] NVARCHAR(255) NULL,
        [updated_by_user_id] INT NULL,
        [updated_by_display] NVARCHAR(255) NULL,
        [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_tbl_wordbee_complaints_created_at] DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_tbl_wordbee_complaints_updated_at] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_tbl_wordbee_complaints] PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT [UQ_tbl_wordbee_complaints_kenmerk] UNIQUE NONCLUSTERED ([kenmerk] ASC)
    );
END
GO
