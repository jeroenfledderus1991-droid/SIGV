/*
  Run this script on sys_systemlogging to create general system error logging table.
*/

USE [sys_systemlogging];
GO

IF OBJECT_ID('dbo.tbl_system_errors', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_system_errors (
        error_event_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_SystemErrors_CreatedAt DEFAULT SYSUTCDATETIME(),
        app_name NVARCHAR(120) NOT NULL,
        environment NVARCHAR(64) NULL,
        severity NVARCHAR(24) NOT NULL,
        source NVARCHAR(48) NOT NULL,
        category NVARCHAR(80) NULL,
        message NVARCHAR(1024) NOT NULL,
        stack_trace NVARCHAR(MAX) NULL,
        request_path NVARCHAR(255) NULL,
        http_method NVARCHAR(12) NULL,
        status_code INT NULL,
        user_id INT NULL,
        username NVARCHAR(255) NULL,
        ip_address NVARCHAR(64) NULL,
        user_agent NVARCHAR(512) NULL,
        metadata_json NVARCHAR(MAX) NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_SystemErrors_CreatedAt'
      AND object_id = OBJECT_ID('dbo.tbl_system_errors')
)
BEGIN
    CREATE INDEX IX_SystemErrors_CreatedAt
        ON dbo.tbl_system_errors(created_at DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_SystemErrors_App_CreatedAt'
      AND object_id = OBJECT_ID('dbo.tbl_system_errors')
)
BEGIN
    CREATE INDEX IX_SystemErrors_App_CreatedAt
        ON dbo.tbl_system_errors(app_name, created_at DESC);
END;
GO
