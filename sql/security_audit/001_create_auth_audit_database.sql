/*
  Run this script once on your SQL Server to create a shared central database
  for failed login events across all tools based on this template.
*/

IF DB_ID(N'sys_systemlogging') IS NULL
BEGIN
    CREATE DATABASE [sys_systemlogging];
END;
GO

USE [sys_systemlogging];
GO

IF OBJECT_ID('dbo.tbl_failed_login_events', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_failed_login_events (
        event_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_FailedLoginEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
        app_name NVARCHAR(120) NOT NULL,
        environment NVARCHAR(64) NULL,
        provider NVARCHAR(40) NOT NULL,
        identifier NVARCHAR(255) NULL,
        ip_address NVARCHAR(64) NULL,
        user_agent NVARCHAR(512) NULL,
        request_path NVARCHAR(255) NULL,
        http_method NVARCHAR(12) NULL,
        failure_reason NVARCHAR(128) NULL,
        status_code INT NULL,
        metadata_json NVARCHAR(MAX) NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_FailedLoginEvents_CreatedAt'
      AND object_id = OBJECT_ID('dbo.tbl_failed_login_events')
)
BEGIN
    CREATE INDEX IX_FailedLoginEvents_CreatedAt
        ON dbo.tbl_failed_login_events(created_at DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_FailedLoginEvents_App_CreatedAt'
      AND object_id = OBJECT_ID('dbo.tbl_failed_login_events')
)
BEGIN
    CREATE INDEX IX_FailedLoginEvents_App_CreatedAt
        ON dbo.tbl_failed_login_events(app_name, created_at DESC);
END;
GO
