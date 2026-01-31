-- ==============================================================================
-- View: vw_user_roles
-- Purpose: Stable interface voor user-role mapping met JOIN data
-- Table: tbl_user_roles
-- Domain: Accountbeheer / Security
-- ==============================================================================

IF OBJECT_ID('dbo.vw_user_roles', 'V') IS NOT NULL
    DROP VIEW dbo.vw_user_roles;
GO

CREATE VIEW dbo.vw_user_roles AS
SELECT 
    -- Composite primary key
    ur.user_id,
    ur.role_id,
    
    -- =============================================
    -- JOIN data from related tables
    -- =============================================
    
    -- User details
    u.username,
    u.email,
    u.voornaam,
    u.achternaam,
    
    -- Role details
    r.naam AS role_naam,
    r.omschrijving AS role_omschrijving,
    r.volgorde AS role_volgorde,
    
    -- =============================================
    -- Computed columns voor convenience
    -- =============================================
    
    -- Full user name
    COALESCE(u.voornaam + ' ' + u.achternaam, u.username) AS user_volledig_naam,
    
    -- User-role combination label
    u.username + ' → ' + r.naam AS assignment_label,
    
    -- Role badge kleur (same logic as vw_roles)
    CASE 
        WHEN r.naam LIKE '%admin%' OR r.naam LIKE '%beheerder%' THEN 'danger'
        WHEN r.naam LIKE '%manager%' OR r.naam LIKE '%supervisor%' THEN 'warning'
        WHEN r.naam LIKE '%user%' OR r.naam LIKE '%gebruiker%' THEN 'primary'
        WHEN r.naam LIKE '%guest%' OR r.naam LIKE '%gast%' THEN 'secondary'
        ELSE 'info'
    END AS role_badge,
    
    -- Is admin role check
    CASE 
        WHEN r.naam LIKE '%admin%' OR r.naam LIKE '%beheerder%' THEN 1
        ELSE 0
    END AS is_admin_role

FROM dbo.tbl_user_roles ur
INNER JOIN dbo.tbl_users u ON ur.user_id = u.user_id
INNER JOIN dbo.tbl_roles r ON ur.role_id = r.id;
GO

-- ==============================================================================
-- View metadata en documentatie
-- ==============================================================================
-- Created: 2025-01-XX
-- Purpose: Protect application from schema changes in tbl_user_roles
-- Usage: SELECT * FROM vw_user_roles WHERE user_id = ?
-- Computed Columns:
--   - user_volledig_naam: Combined user full name
--   - assignment_label: Readable assignment string
--   - role_badge: Bootstrap badge class
--   - is_admin_role: Boolean check voor elevated permissions
-- JOINs: tbl_users, tbl_roles voor complete data
-- Note: Deze view bevat JOINS dus kan langzamer zijn dan simple views
-- ==============================================================================
