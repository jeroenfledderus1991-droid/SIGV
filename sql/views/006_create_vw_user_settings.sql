-- ==============================================================================
-- View: vw_user_settings
-- Purpose: Stable interface voor user settings data
-- Table: tbl_user_settings
-- Domain: Accountbeheer
-- ==============================================================================

IF OBJECT_ID('dbo.vw_user_settings', 'V') IS NOT NULL
    DROP VIEW dbo.vw_user_settings;
GO

CREATE VIEW dbo.vw_user_settings AS
SELECT 
    -- Primary key
    us.user_id,
    
    -- Theme settings
    us.theme,
    us.display_mode,
    us.accent_color,
    us.accent_text_color,
    us.sidebar_variant,
    us.gradient_intensity,
    
    -- Timestamps
    us.created_at,
    us.updated_at,
    
    -- =============================================
    -- Computed columns voor convenience
    -- =============================================
    
    -- Check of dark theme actief is
    CASE 
        WHEN us.theme = 'dark' THEN 1 
        ELSE 0 
    END AS is_dark_theme,
    
    -- Readable theme label
    CASE us.theme
        WHEN 'light' THEN 'Licht thema'
        WHEN 'dark' THEN 'Donker thema'
        WHEN 'auto' THEN 'Automatisch'
        ELSE 'Onbekend'
    END AS theme_label,
    
    -- Display mode label
    CASE us.display_mode
        WHEN 'full' THEN 'Volledig'
        WHEN 'compact' THEN 'Compact'
        WHEN 'minimal' THEN 'Minimaal'
        ELSE 'Standaard'
    END AS display_mode_label,

    -- Gradient intensity percentage
    CAST(us.gradient_intensity AS NVARCHAR(10)) + '%' AS gradient_intensity_display

FROM dbo.tbl_user_settings us;
GO

-- ==============================================================================
-- View metadata en documentatie
-- ==============================================================================
-- Created: 2025-01-XX
-- Purpose: Protect application from schema changes in tbl_user_settings
-- Usage: SELECT * FROM vw_user_settings WHERE user_id = ?
-- Computed Columns:
--   - is_dark_theme: Boolean check voor dark theme
--   - theme_label: Human-readable theme name
--   - display_mode_label: Human-readable display mode
--   - gradient_intensity_display: Percentage string voor UI
-- ==============================================================================
