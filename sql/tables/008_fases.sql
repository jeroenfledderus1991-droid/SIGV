/* =========================================================
   Fases Table
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_fases]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[tbl_fases](
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [fases] NVARCHAR(100) NOT NULL,
        [getal] INT NOT NULL,
        [volgorde] INT NOT NULL DEFAULT 0,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NULL
    );

    PRINT 'Table tbl_fases created successfully';
END
GO