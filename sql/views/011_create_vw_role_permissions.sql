-- ==============================================================================
-- View: vw_role_permissions
-- Purpose: Stable interface voor role permission mapping
-- Table: tbl_role_permissions
-- Domain: Accountbeheer / Security
-- ==============================================================================

IF OBJECT_ID('dbo.vw_role_permissions', 'V') IS NOT NULL
    DROP VIEW dbo.vw_role_permissions;
GO

CREATE VIEW dbo.vw_role_permissions AS
SELECT 
    -- Primary key
    rp.id,
    
    -- Foreign keys
    rp.role_id,
    
    -- Permission details
    rp.page,
    rp.allowed,
    
    -- =============================================
    -- Computed columns voor convenience
    -- =============================================
    
    -- Permission status label
    CASE 
        WHEN rp.allowed = 1 THEN 'Toegestaan'
        ELSE 'Geweigerd'
    END AS permission_status,
    
    -- Status badge kleur
    CASE 
        WHEN rp.allowed = 1 THEN 'success'
        ELSE 'danger'
    END AS status_badge,
    
    -- Page category (extracted from page pattern)
    CASE 
        WHEN rp.page LIKE '/admin%' THEN 'Beheer'
        WHEN rp.page LIKE '/user%' THEN 'Gebruiker'
        WHEN rp.page LIKE '/settings%' THEN 'Instellingen'
        WHEN rp.page LIKE '/reports%' THEN 'Rapporten'
        WHEN rp.page LIKE '/api%' THEN 'API'
        ELSE 'Algemeen'
    END AS page_category,
    
    -- Is wildcard permission (contains *)
    CASE 
        WHEN rp.page LIKE '%*%' THEN 1
        ELSE 0
    END AS is_wildcard,
    
    -- Permission scope indicator
    CASE 
        WHEN rp.page = '/*' THEN 'GLOBAL'
        WHEN rp.page LIKE '%*' THEN 'SECTION'
        ELSE 'PAGE'
    END AS permission_scope,
    
    -- Clean page display (remove leading slash voor UI)
    CASE 
        WHEN LEFT(rp.page, 1) = '/' THEN SUBSTRING(rp.page, 2, LEN(rp.page))
        ELSE rp.page
    END AS page_display

FROM dbo.tbl_role_permissions rp;
GO

-- ==============================================================================
-- View metadata en documentatie
-- ==============================================================================
-- Created: 2025-01-XX
-- Purpose: Protect application from schema changes in tbl_role_permissions
-- Usage: SELECT * FROM vw_role_permissions WHERE role_id = ? AND allowed = 1
-- Computed Columns:
--   - permission_status: Readable status string
--   - status_badge: Bootstrap badge class
--   - page_category: Extracted category van page pattern
--   - is_wildcard: Boolean check voor wildcard permissions
--   - permission_scope: GLOBAL/SECTION/PAGE indicator
--   - page_display: Clean page path voor UI
-- Security Note: Gebruikt in permission checking logic
-- ==============================================================================
