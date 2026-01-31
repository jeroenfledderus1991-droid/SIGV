/* =========================================================
   USERS & AUTHENTICATION TABLES
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Users table
IF OBJECT_ID('dbo.tbl_users', 'U') IS NULL
CREATE TABLE dbo.tbl_users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,
    email NVARCHAR(100) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    voornaam NVARCHAR(50) NULL,
    achternaam NVARCHAR(50) NULL,
    role NVARCHAR(20) NULL,
    is_super_admin BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    last_login DATETIME2 NULL,
    reset_token NVARCHAR(100) NULL,
    reset_token_expires DATETIME2 NULL
);
GO

-- Add voornaam and achternaam columns if table exists but columns don't
IF OBJECT_ID('dbo.tbl_users','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_users','voornaam') IS NULL
    ALTER TABLE dbo.tbl_users ADD voornaam NVARCHAR(50) NULL;
GO

IF OBJECT_ID('dbo.tbl_users','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_users','achternaam') IS NULL
    ALTER TABLE dbo.tbl_users ADD achternaam NVARCHAR(50) NULL;
GO

-- Computed kolom 'id' toevoegen voor backwards compatibility
IF OBJECT_ID('dbo.tbl_users','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_users','id') IS NULL
    EXEC('ALTER TABLE dbo.tbl_users ADD id AS (user_id)');
GO

-- User <-> Role koppeltabel
IF OBJECT_ID('dbo.tbl_user_roles','U') IS NULL
CREATE TABLE dbo.tbl_user_roles (
    user_id INT NOT NULL FOREIGN KEY REFERENCES dbo.tbl_users(user_id) ON DELETE CASCADE,
    role_id INT NOT NULL FOREIGN KEY REFERENCES dbo.tbl_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
GO

-- Active sessions tracking
IF OBJECT_ID('dbo.tbl_active_sessions','U') IS NULL
CREATE TABLE dbo.tbl_active_sessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL FOREIGN KEY REFERENCES dbo.tbl_users(user_id) ON DELETE CASCADE,
    session_id NVARCHAR(100) NOT NULL,
    login_time DATETIME2 DEFAULT SYSDATETIME(),
    last_seen DATETIME2 DEFAULT SYSDATETIME()
);
GO

-- Seed superadmin (wachtwoord: kRyx2159S?;KWkkj)
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_users WHERE username = 'EESA')
BEGIN
    INSERT INTO dbo.tbl_users (username, email, password_hash, voornaam, achternaam, role, is_super_admin, created_at)
    VALUES ('EESA','eesa@admin.local','scrypt:32768:8:1$5K7elyAfQYEXrPx2$a3038353df8e3afa16049ec88cf1a733617b0ea7f635af9e54357a3678b36c7767615dabefff4ae7ce46a3b751f2f5e35734124a4e0e73bf81edad3c270979cd','Expert','Excel','superadmin',1,GETDATE());
END
GO

-- Koppeling EESA -> admin rol
IF EXISTS (SELECT 1 FROM dbo.tbl_users WHERE username='EESA')
   AND EXISTS (SELECT 1 FROM dbo.tbl_roles WHERE naam='admin')
   AND NOT EXISTS (
       SELECT 1 FROM dbo.tbl_user_roles ur
       JOIN dbo.tbl_users u ON u.user_id = ur.user_id
       JOIN dbo.tbl_roles r ON r.id = ur.role_id
       WHERE u.username='EESA' AND r.naam='admin'
   )
BEGIN
    INSERT INTO dbo.tbl_user_roles (user_id, role_id)
    SELECT u.user_id, r.id FROM dbo.tbl_users u CROSS JOIN dbo.tbl_roles r
    WHERE u.username='EESA' AND r.naam='admin';
END
GO