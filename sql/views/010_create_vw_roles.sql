-- ==============================================================================
-- View: vw_roles
-- Purpose: Stable interface voor role management
-- Table: tbl_roles
-- Domain: Accountbeheer / Security
-- ==============================================================================

IF OBJECT_ID('dbo.vw_roles', 'V') IS NOT NULL
    DROP VIEW dbo.vw_roles;
GO

CREATE VIEW dbo.vw_roles AS
SELECT 
    -- Primary key
    r.id,
    
    -- Role details
    r.naam,
    r.omschrijving,
    r.volgorde,
    
    -- =============================================
    -- Computed columns voor convenience
    -- =============================================
    
    -- Role display name (capitalized)
    UPPER(LEFT(r.naam, 1)) + LOWER(SUBSTRING(r.naam, 2, LEN(r.naam))) AS naam_display,
    
    -- Role badge kleur (based on common role patterns)
    CASE 
        WHEN r.naam LIKE '%admin%' OR r.naam LIKE '%beheerder%' THEN 'danger'
        WHEN r.naam LIKE '%manager%' OR r.naam LIKE '%supervisor%' THEN 'warning'
        WHEN r.naam LIKE '%user%' OR r.naam LIKE '%gebruiker%' THEN 'primary'
        WHEN r.naam LIKE '%guest%' OR r.naam LIKE '%gast%' THEN 'secondary'
        ELSE 'info'
    END AS role_badge,
    
    -- Security level indicator
    CASE 
        WHEN r.naam LIKE '%admin%' OR r.naam LIKE '%beheerder%' THEN 'HIGH'
        WHEN r.naam LIKE '%manager%' OR r.naam LIKE '%supervisor%' THEN 'MEDIUM'
        ELSE 'STANDARD'
    END AS security_level,
    
    -- Role beschrijving met fallback
    COALESCE(r.omschrijving, 'Geen omschrijving beschikbaar') AS omschrijving_display,
    
    -- Lengte check voor UI rendering
    CASE 
        WHEN LEN(r.naam) > 20 THEN 1
        ELSE 0
    END AS is_long_name

FROM dbo.tbl_roles r;
GO

-- ==============================================================================
-- View metadata en documentatie
-- ==============================================================================
-- Created: 2025-01-XX
-- Purpose: Protect application from schema changes in tbl_roles
-- Usage: SELECT * FROM vw_roles ORDER BY volgorde
-- Computed Columns:
--   - naam_display: Properly capitalized role name
--   - role_badge: Bootstrap badge class gebaseerd op role type
--   - security_level: HIGH/MEDIUM/STANDARD voor access control
--   - omschrijving_display: Description met fallback text
--   - is_long_name: Flag voor UI truncation logic
-- ==============================================================================
