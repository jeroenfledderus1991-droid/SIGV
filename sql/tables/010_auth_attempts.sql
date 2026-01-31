/* =========================================================
   Auth Attempts Table (rate limiting + audit)
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.tbl_auth_attempts', 'U') IS NULL
CREATE TABLE dbo.tbl_auth_attempts (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    identifier NVARCHAR(255) NOT NULL,
    success BIT NOT NULL,
    ip_address NVARCHAR(45) NULL,
    user_agent NVARCHAR(255) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_AuthAttempts_Identifier_Time' AND object_id=OBJECT_ID('dbo.tbl_auth_attempts'))
    CREATE INDEX IX_AuthAttempts_Identifier_Time ON dbo.tbl_auth_attempts(identifier, created_at DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_AuthAttempts_Ip_Time' AND object_id=OBJECT_ID('dbo.tbl_auth_attempts'))
    CREATE INDEX IX_AuthAttempts_Ip_Time ON dbo.tbl_auth_attempts(ip_address, created_at DESC);
GO
