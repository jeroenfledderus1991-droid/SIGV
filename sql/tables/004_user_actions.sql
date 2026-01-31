/* =========================================================
   USER ACTIONS LOGGING TABLE
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- User actions table
IF OBJECT_ID('dbo.tbl_user_actions', 'U') IS NULL
CREATE TABLE dbo.tbl_user_actions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL FOREIGN KEY REFERENCES dbo.tbl_users(user_id) ON DELETE CASCADE,
    action_code NVARCHAR(50) NOT NULL,          -- korte code, bv LOGIN, UPDATE_ROLE
    action_label NVARCHAR(255) NULL,            -- leesbare omschrijving
    meta NVARCHAR(1000) NULL,                   -- optionele JSON / extra info
    ip_address NVARCHAR(45) NULL,               -- IPv4/IPv6
    user_agent NVARCHAR(255) NULL,              -- verkort UA
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- Index voor snelle recente acties per gebruiker
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_UserActions_User_Time' AND object_id=OBJECT_ID('dbo.tbl_user_actions'))
    CREATE INDEX IX_UserActions_User_Time ON dbo.tbl_user_actions(user_id, created_at DESC);
GO