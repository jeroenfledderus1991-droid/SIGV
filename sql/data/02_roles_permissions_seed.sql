-- =====================================================
-- Roles and Permissions Data Seeding
-- =====================================================
-- Seeds basic roles and permissions according to architecture guidelines
-- Follows permission pattern system from .github/copilot-instructions.md
-- Run: python database_setup.py data
-- =====================================================

PRINT 'Seeding roles and permissions data...'

-- Ensure required tables exist
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tbl_roles')
BEGIN
    RAISERROR('Roles table does not exist! Run table creation first.', 16, 1)
    RETURN
END
GO
GO

-- Insert/Update basic roles using actual table structure
MERGE tbl_roles AS target
USING (VALUES 
    ('Super Admin', 'Full system access and administration', 1),
    ('Admin', 'Application administration with limited system access', 2),
    ('Manager', 'Management level access to most features', 3),
    ('User', 'Standard user access to core features', 4),
    ('Viewer', 'Read-only access to limited features', 5),
    ('Guest', 'Minimal access for temporary users', 6)
) AS source (naam, omschrijving, volgorde)
ON target.naam = source.naam
WHEN MATCHED THEN
    UPDATE SET 
        omschrijving = source.omschrijving,
        volgorde = source.volgorde
WHEN NOT MATCHED THEN
    INSERT (naam, omschrijving, volgorde)
    VALUES (source.naam, source.omschrijving, source.volgorde);
GO

-- Insert/Update permission patterns using role_permissions table
-- Basic page permissions for different roles
MERGE tbl_role_permissions AS target
USING (
    SELECT 
        r.id as role_id,
        p.page,
        p.allowed
    FROM tbl_roles r
    CROSS APPLY (VALUES 
        -- Super Admin gets access to everything
        ('*', CASE WHEN r.naam = 'Super Admin' THEN 1 ELSE 0 END),
        
        -- Admin routes
        ('/admin*', CASE WHEN r.naam IN ('Super Admin', 'Admin') THEN 1 ELSE 0 END),
        ('/accounts*', CASE WHEN r.naam IN ('Super Admin', 'Admin') THEN 1 ELSE 0 END),
        ('/rollen*', CASE WHEN r.naam IN ('Super Admin', 'Admin') THEN 1 ELSE 0 END),
        ('/feature-flags*', CASE WHEN r.naam = 'Super Admin' THEN 1 ELSE 0 END),
        
        -- User accessible routes
        ('/home*', CASE WHEN r.naam IN ('Super Admin', 'Admin', 'Manager', 'User') THEN 1 ELSE 0 END),
        ('/profiel*', CASE WHEN r.naam IN ('Super Admin', 'Admin', 'Manager', 'User') THEN 1 ELSE 0 END),
        ('/settings*', CASE WHEN r.naam IN ('Super Admin', 'Admin', 'Manager', 'User') THEN 1 ELSE 0 END),
        
        -- Stamgegevens (Master data management)
        ('/stamgegevens*', CASE WHEN r.naam IN ('Super Admin', 'Admin', 'Manager') THEN 1 ELSE 0 END),
        
        -- System routes
        ('/style-guide*', CASE WHEN r.naam IN ('Super Admin', 'Admin') THEN 1 ELSE 0 END),
        ('/cache*', CASE WHEN r.naam = 'Super Admin' THEN 1 ELSE 0 END),
        ('/health*', CASE WHEN r.naam IN ('Super Admin', 'Admin') THEN 1 ELSE 0 END)
    ) p(page, allowed)
    WHERE p.allowed = 1
) AS source (role_id, page, allowed)
ON target.role_id = source.role_id AND target.page = source.page
WHEN MATCHED THEN
    UPDATE SET 
        allowed = source.allowed
WHEN NOT MATCHED THEN
    INSERT (role_id, page, allowed)
    VALUES (source.role_id, source.page, source.allowed);
GO

-- Count and report
DECLARE @role_count INT, @permission_count INT

SELECT @role_count = COUNT(*) FROM tbl_roles
SELECT @permission_count = COUNT(*) FROM tbl_role_permissions

PRINT 'Roles and permissions seeding completed!'
PRINT 'Total roles: ' + CAST(@role_count AS VARCHAR(10))
PRINT 'Role-permission assignments: ' + CAST(@permission_count AS VARCHAR(10))
GO
GO