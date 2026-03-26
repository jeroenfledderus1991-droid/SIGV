/*
  Run this script on sys_systemlogging to create a central allowlist table
  for ExpertExcel support/admin accounts.
*/

USE [sys_systemlogging];
GO

IF OBJECT_ID('dbo.tbl_support_admin_allowlist', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_support_admin_allowlist (
        admin_id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(320) NOT NULL,
        email_normalized AS LOWER(LTRIM(RTRIM(email))) PERSISTED,
        display_name NVARCHAR(200) NULL,
        role_code NVARCHAR(40) NOT NULL CONSTRAINT DF_SupportAdmins_RoleCode DEFAULT 'support_admin',
        is_active BIT NOT NULL CONSTRAINT DF_SupportAdmins_IsActive DEFAULT 1,
        notes NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_SupportAdmins_CreatedAt DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_SupportAdmins_UpdatedAt DEFAULT SYSUTCDATETIME(),
        created_by NVARCHAR(255) NULL,
        updated_by NVARCHAR(255) NULL,
        last_used_at DATETIME2 NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_SupportAdmins_EmailNormalized'
      AND object_id = OBJECT_ID('dbo.tbl_support_admin_allowlist')
)
BEGIN
    CREATE UNIQUE INDEX UX_SupportAdmins_EmailNormalized
        ON dbo.tbl_support_admin_allowlist(email_normalized);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_SupportAdmins_IsActive_RoleCode'
      AND object_id = OBJECT_ID('dbo.tbl_support_admin_allowlist')
)
BEGIN
    CREATE INDEX IX_SupportAdmins_IsActive_RoleCode
        ON dbo.tbl_support_admin_allowlist(is_active, role_code, email_normalized);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.tbl_support_admin_allowlist
    WHERE email_normalized = LOWER('jeroen@expertexcel.nl')
)
BEGIN
    INSERT INTO dbo.tbl_support_admin_allowlist (
        email,
        display_name,
        role_code,
        is_active,
        notes,
        created_by,
        updated_by
    )
    VALUES (
        'jeroen@expertexcel.nl',
        'Jeroen (seed)',
        'support_admin',
        1,
        'Seed record for support admin allowlist test',
        'seed-script',
        'seed-script'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.tbl_support_admin_allowlist
    WHERE email_normalized = LOWER('steven@expertexcel.nl')
)
BEGIN
    INSERT INTO dbo.tbl_support_admin_allowlist (
        email,
        display_name,
        role_code,
        is_active,
        notes,
        created_by,
        updated_by
    )
    VALUES (
        'steven@expertexcel.nl',
        'Steven (seed)',
        'support_admin',
        1,
        'Seed record for support admin allowlist test',
        'seed-script',
        'seed-script'
    );
END;
GO
