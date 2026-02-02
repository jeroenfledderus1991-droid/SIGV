/* =========================================================
   FEATURE FLAGS SYSTEM
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Feature flags table voor runtime toggles van functionaliteit
IF OBJECT_ID('dbo.tbl_feature_flags', 'U') IS NULL
CREATE TABLE dbo.tbl_feature_flags (
    flag_name NVARCHAR(120) NOT NULL PRIMARY KEY,
    enabled BIT NOT NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    page_key NVARCHAR(120) NULL,
    description NVARCHAR(500) NULL,
    created_at DATETIME2 NULL DEFAULT SYSDATETIME()
);
GO

-- Kolom page_key toevoegen als legacy tabel nog geen kolom heeft
IF OBJECT_ID('dbo.tbl_feature_flags','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_feature_flags','page_key') IS NULL
    ALTER TABLE dbo.tbl_feature_flags ADD page_key NVARCHAR(120) NULL;
GO

-- Kolom created_at toevoegen als nog niet bestaat
IF OBJECT_ID('dbo.tbl_feature_flags','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_feature_flags','created_at') IS NULL
    ALTER TABLE dbo.tbl_feature_flags ADD created_at DATETIME2 NULL DEFAULT SYSDATETIME();
GO

-- Kolom description toevoegen als nog niet bestaat
IF OBJECT_ID('dbo.tbl_feature_flags','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_feature_flags','description') IS NULL
    ALTER TABLE dbo.tbl_feature_flags ADD description NVARCHAR(500) NULL;
GO

-- Nieuwe kolom 'page' toevoegen (alias voor page_key / legacy of UI gebruik)
IF OBJECT_ID('dbo.tbl_feature_flags','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_feature_flags','page') IS NULL
    ALTER TABLE dbo.tbl_feature_flags ADD page NVARCHAR(120) NULL;
GO

-- Synchronisatie: vul page vanuit page_key indien leeg
IF OBJECT_ID('dbo.tbl_feature_flags','U') IS NOT NULL
    UPDATE dbo.tbl_feature_flags SET page = ISNULL(page_key,'GLOBAL') WHERE page IS NULL;
GO

-- Index voor filtering per pagina / beheer UI
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FeatureFlags_Page' AND object_id=OBJECT_ID('dbo.tbl_feature_flags'))
    CREATE INDEX IX_FeatureFlags_Page ON dbo.tbl_feature_flags(page_key, flag_name);
GO

-- Non-clustered index voor enabled kolom (voor snelle filtering)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FeatureFlags_Enabled' AND object_id=OBJECT_ID('dbo.tbl_feature_flags'))
    CREATE INDEX IX_FeatureFlags_Enabled ON dbo.tbl_feature_flags(enabled, flag_name);
GO

-- Basis feature flag invoegen indien nog niet bestaat
-- User settings feature volgens opgeschoonde architectuur
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_feature_flags WHERE flag_name = 'ENABLE_USER_SETTINGS')
    INSERT INTO dbo.tbl_feature_flags (flag_name, enabled, page_key, description)
    VALUES ('ENABLE_USER_SETTINGS', 1, 'SETTINGS', 'Sta gebruikers toe om persoonlijke instellingen aan te passen (thema, kleuren, sidebar)');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_feature_flags WHERE flag_name = 'ENABLE_AUTO_LOGINS')
    INSERT INTO dbo.tbl_feature_flags (flag_name, enabled, page_key, description)
    VALUES ('ENABLE_AUTO_LOGINS', 0, 'SYSTEM', 'Sta automatische login via speciale link toe');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_feature_flags WHERE flag_name = 'ENABLE_ADMIN_AUTO_LOGIN')
    INSERT INTO dbo.tbl_feature_flags (flag_name, enabled, page_key, description)
    VALUES ('ENABLE_ADMIN_AUTO_LOGIN', 0, 'SYSTEM', 'Log automatisch in als superadmin (EESA)');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_feature_flags WHERE flag_name = 'ENABLE_USER_AUTO_LOGIN')
    INSERT INTO dbo.tbl_feature_flags (flag_name, enabled, page_key, description)
    VALUES ('ENABLE_USER_AUTO_LOGIN', 0, 'SYSTEM', 'Log automatisch in als standaard gebruiker');
GO
