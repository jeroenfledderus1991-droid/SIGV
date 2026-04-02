/* =========================================================
   USER SETTINGS TABLE
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- User settings table
IF OBJECT_ID('dbo.tbl_user_settings', 'U') IS NULL
CREATE TABLE dbo.tbl_user_settings (
    user_id INT PRIMARY KEY FOREIGN KEY REFERENCES dbo.tbl_users(user_id) ON DELETE CASCADE,
    theme NVARCHAR(20) DEFAULT 'light',
    display_mode NVARCHAR(20) DEFAULT 'full',
    accent_color NVARCHAR(7) NULL,            -- Hex (#RRGGBB) voor component / achtergrond accenten
    accent_text_color NVARCHAR(7) NULL,       -- Hex (#RRGGBB) voor tekst op accent vlakken
    sidebar_variant NVARCHAR(30) NULL,        -- 'accent-gradient' | 'accent-solid' | 'white'
    gradient_intensity INT DEFAULT 30,        -- Gradient intensiteit percentage (0-100)
    table_tint NVARCHAR(30) DEFAULT 'mint',   -- Zachte tabelkleur preset voor ClientTable
    container_tint NVARCHAR(30) DEFAULT 'mint', -- Zachte containerkleur preset voor cards/panels
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- Kolommen toevoegen indien bestaande tabel ouder is
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_user_settings','accent_color') IS NULL
    ALTER TABLE dbo.tbl_user_settings ADD accent_color NVARCHAR(7) NULL;
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_user_settings','accent_text_color') IS NULL
    ALTER TABLE dbo.tbl_user_settings ADD accent_text_color NVARCHAR(7) NULL;
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_user_settings','created_at') IS NULL
    ALTER TABLE dbo.tbl_user_settings ADD created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME();
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_user_settings','updated_at') IS NULL
    ALTER TABLE dbo.tbl_user_settings ADD updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME();
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_user_settings','sidebar_variant') IS NULL
    ALTER TABLE dbo.tbl_user_settings ADD sidebar_variant NVARCHAR(30) NULL;
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_user_settings','gradient_intensity') IS NULL
    ALTER TABLE dbo.tbl_user_settings ADD gradient_intensity INT NULL;
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_user_settings','table_tint') IS NULL
    ALTER TABLE dbo.tbl_user_settings ADD table_tint NVARCHAR(30) NULL;
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL AND COL_LENGTH('dbo.tbl_user_settings','container_tint') IS NULL
    ALTER TABLE dbo.tbl_user_settings ADD container_tint NVARCHAR(30) NULL;
GO
-- Default vullen voor bestaande records
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL
    UPDATE dbo.tbl_user_settings SET sidebar_variant = 'white' WHERE sidebar_variant IS NULL;
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL
    UPDATE dbo.tbl_user_settings SET gradient_intensity = 30 WHERE gradient_intensity IS NULL;
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL
    UPDATE dbo.tbl_user_settings SET table_tint = 'mint' WHERE table_tint IS NULL;
GO
IF OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL
    UPDATE dbo.tbl_user_settings SET container_tint = 'mint' WHERE container_tint IS NULL;
GO

-- Trigger om updated_at bij te werken (alleen aanmaken als nog niet bestaat)
IF OBJECT_ID('dbo.trg_tbl_user_settings_update','TR') IS NULL AND OBJECT_ID('dbo.tbl_user_settings','U') IS NOT NULL
EXEC('CREATE TRIGGER dbo.trg_tbl_user_settings_update ON dbo.tbl_user_settings AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE s SET updated_at = SYSDATETIME() FROM dbo.tbl_user_settings s JOIN inserted i ON s.user_id = i.user_id; END');
GO
