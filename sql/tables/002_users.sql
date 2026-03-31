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

