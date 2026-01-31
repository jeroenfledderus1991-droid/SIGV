-- ==============================================================================
-- View: vw_accountbeheer_rollen
-- Purpose: Stable interface voor rollen data (accountbeheer namespace)
-- Table: tbl_roles
-- Domain: Accountbeheer
-- Note: Dit is een wrapper view die dezelfde data exposed als vw_roles
--       maar met accountbeheer naming voor backwards compatibility
-- ==============================================================================

IF OBJECT_ID('dbo.vw_accountbeheer_rollen', 'V') IS NOT NULL
    DROP VIEW dbo.vw_accountbeheer_rollen;
GO

CREATE VIEW dbo.vw_accountbeheer_rollen AS
SELECT 
    -- Primary key
    r.id,
    
    -- Role details
    r.naam,
    r.omschrijving,
    r.volgorde,
    
    -- =============================================
    -- Computed columns (same as vw_roles)
    -- =============================================
    
    -- Role display name (capitalized)
    UPPER(LEFT(r.naam, 1)) + LOWER(SUBSTRING(r.naam, 2, LEN(r.naam))) AS naam_display,
    
    -- Role badge kleur
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
    COALESCE(r.omschrijving, 'Geen omschrijving beschikbaar') AS omschrijving_display

FROM dbo.tbl_roles r;
GO

-- ==============================================================================
-- View metadata en documentatie
-- ==============================================================================
-- Created: 2025-01-XX
-- Purpose: Backwards compatible view met accountbeheer namespace
-- Usage: SELECT * FROM vw_accountbeheer_rollen ORDER BY volgorde
-- Note: Dit is een alias voor vw_roles data - gebruik bij voorkeur vw_roles
-- ==============================================================================
