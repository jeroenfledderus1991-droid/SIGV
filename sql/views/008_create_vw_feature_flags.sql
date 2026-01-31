-- ==============================================================================
-- View: vw_feature_flags
-- Purpose: Stable interface voor feature flag management
-- Table: tbl_feature_flags
-- Domain: Settings / Configuration
-- ==============================================================================

IF OBJECT_ID('dbo.vw_feature_flags', 'V') IS NOT NULL
    DROP VIEW dbo.vw_feature_flags;
GO

CREATE VIEW dbo.vw_feature_flags AS
SELECT 
    -- Primary key
    ff.flag_name,
    
    -- Flag state
    ff.enabled,
    
    -- Metadata
    ff.page_key,
    ff.page,  -- Legacy column, may be deprecated
    ff.description,  -- Feature description for UI tooltips
    
    -- Timestamps
    ff.created_at,
    ff.updated_at,
    
    -- =============================================
    -- Computed columns voor convenience
    -- =============================================
    
    -- Status label voor UI
    CASE 
        WHEN ff.enabled = 1 THEN 'Actief'
        ELSE 'Inactief'
    END AS status_label,
    
    -- Status badge kleur
    CASE 
        WHEN ff.enabled = 1 THEN 'success'
        ELSE 'secondary'
    END AS status_badge,
    
    -- Friendly flag name (remove ENABLE_ prefix)
    CASE 
        WHEN ff.flag_name LIKE 'ENABLE_%' THEN SUBSTRING(ff.flag_name, 8, LEN(ff.flag_name))
        ELSE ff.flag_name
    END AS flag_name_short,
    
    -- Feature category (extracted from flag name)
    CASE 
        WHEN ff.flag_name LIKE 'ENABLE_PERFORMANCE_%' THEN 'Performance'
        WHEN ff.flag_name LIKE 'ENABLE_CACHE_%' THEN 'Caching'
        WHEN ff.flag_name LIKE 'ENABLE_DEBUG_%' THEN 'Debug'
        WHEN ff.flag_name LIKE 'ENABLE_ADMIN_%' THEN 'Admin Tools'
        WHEN ff.flag_name LIKE 'ENABLE_SECURITY_%' THEN 'Security'
        WHEN ff.flag_name LIKE 'ENABLE_UI_%' THEN 'User Interface'
        ELSE 'Feature'
    END AS feature_category,
    
    -- Last update timing
    DATEDIFF(DAY, ff.updated_at, SYSDATETIME()) AS days_since_update,
    
    -- Recently updated flag (last 7 days)
    CASE 
        WHEN DATEDIFF(DAY, ff.updated_at, SYSDATETIME()) <= 7 THEN 1
        ELSE 0
    END AS is_recently_updated

FROM dbo.tbl_feature_flags ff;
GO

-- ==============================================================================
-- View metadata en documentatie
-- ==============================================================================
-- Created: 2025-01-XX
-- Purpose: Protect application from schema changes in tbl_feature_flags
-- Usage: SELECT * FROM vw_feature_flags WHERE enabled = 1
-- Computed Columns:
--   - status_label: Readable status string
--   - status_badge: Bootstrap badge class voor UI
--   - flag_name_short: Verkorte naam zonder prefix
--   - feature_category: Extracted categorie
--   - days_since_update: Days since last change
--   - is_recently_updated: Boolean voor highlighting nieuwe changes
-- ==============================================================================
