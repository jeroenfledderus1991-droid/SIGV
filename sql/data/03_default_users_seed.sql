-- =====================================================
-- Default Admin User Data Seeding
-- =====================================================
-- Creates default admin user for initial system access
-- Run: python database_setup.py data
-- =====================================================

PRINT 'Seeding default admin user...'

-- Ensure required tables exist
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tbl_users')
BEGIN
    RAISERROR('Users table does not exist! Run table creation first.', 16, 1)
    RETURN
END
GO

-- Create default admin user
-- Note: Password should be changed immediately after first login
-- Default password: 'admin123' (scrypt hashed)
MERGE tbl_users AS target
USING (VALUES 
    ('admin', 'admin@example.com', 'scrypt:32768:8:1$HK5uJI3xDTXlq4xf$5d5c9bccf547366d8bf67326675137631a801fd4bcc90df3a5cc7b394b2867f9acbf056d01863b0c598439096ac00bd0ae6f3bd7d1f56375df66f5b1a8fde672', 'admin', 1)
) AS source (username, email, password_hash, role, is_super_admin)
ON target.username = source.username
WHEN MATCHED THEN
    UPDATE SET 
        email = source.email,
        password_hash = source.password_hash,
        role = source.role,
        is_super_admin = source.is_super_admin
WHEN NOT MATCHED THEN
    INSERT (username, email, password_hash, role, is_super_admin, created_at)
    VALUES (source.username, source.email, source.password_hash, source.role, source.is_super_admin, GETDATE());
GO
GO

-- Create EESA superadmin user
-- Password: kRyx2159S?;KWkkj (scrypt hashed)
MERGE tbl_users AS target
USING (VALUES 
    ('EESA', 'eesa@admin.local', 'scrypt:32768:8:1$5K7elyAfQYEXrPx2$a3038353df8e3afa16049ec88cf1a733617b0ea7f635af9e54357a3678b36c7767615dabefff4ae7ce46a3b751f2f5e35734124a4e0e73bf81edad3c270979cd', 'superadmin', 1)
) AS source (username, email, password_hash, role, is_super_admin)
ON target.email = source.email
WHEN MATCHED THEN
    UPDATE SET 
        username = source.username,
        password_hash = source.password_hash,
        role = source.role,
        is_super_admin = source.is_super_admin
WHEN NOT MATCHED THEN
    INSERT (username, email, password_hash, role, is_super_admin, created_at)
    VALUES (source.username, source.email, source.password_hash, source.role, source.is_super_admin, GETDATE());
GO

-- Create standard template account (email/password provided by user)
-- Password: Test123 (scrypt hashed)
MERGE tbl_users AS target
USING (VALUES 
    ('eesa', 'eesa@local.admin', 'scrypt:32768:8:1$i9DycJ3tBZ6dOciu$485931c007cd03d82a4931bd65e09ab8e75f01a1a1d53022f6bdee0eb5d57dd0a5a9cd648e1847240d9b5de07309c213ce76dd97c0d3c7e86ea6348a8e7e9332', 'admin', 1)
) AS source (username, email, password_hash, role, is_super_admin)
ON target.email = source.email
WHEN MATCHED THEN
    UPDATE SET 
        username = source.username,
        password_hash = source.password_hash,
        role = source.role,
        is_super_admin = source.is_super_admin
WHEN NOT MATCHED THEN
    INSERT (username, email, password_hash, role, is_super_admin, created_at)
    VALUES (source.username, source.email, source.password_hash, source.role, source.is_super_admin, GETDATE());
GO

-- Link standard account to admin role if available
IF EXISTS (SELECT 1 FROM dbo.tbl_users WHERE email = 'eesa@local.admin')
BEGIN
    DECLARE @eesa_id INT = (SELECT TOP 1 user_id FROM dbo.tbl_users WHERE email = 'eesa@local.admin');
    DECLARE @admin_role_id INT = (
        SELECT TOP 1 id FROM dbo.tbl_roles WHERE naam IN ('admin','Admin') ORDER BY CASE WHEN naam = 'admin' THEN 0 ELSE 1 END
    );
    IF @admin_role_id IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_user_roles WHERE user_id = @eesa_id AND role_id = @admin_role_id)
            INSERT INTO dbo.tbl_user_roles (user_id, role_id) VALUES (@eesa_id, @admin_role_id);
    END
END
GO

-- Link EESA superadmin to admin role if available
IF EXISTS (SELECT 1 FROM dbo.tbl_users WHERE email = 'eesa@admin.local')
BEGIN
    DECLARE @eesa_admin_id INT = (SELECT TOP 1 user_id FROM dbo.tbl_users WHERE email = 'eesa@admin.local');
    DECLARE @admin_role_id2 INT = (
        SELECT TOP 1 id FROM dbo.tbl_roles WHERE naam IN ('admin','Admin') ORDER BY CASE WHEN naam = 'admin' THEN 0 ELSE 1 END
    );
    IF @admin_role_id2 IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_user_roles WHERE user_id = @eesa_admin_id AND role_id = @admin_role_id2)
            INSERT INTO dbo.tbl_user_roles (user_id, role_id) VALUES (@eesa_admin_id, @admin_role_id2);
    END
END
GO

-- Create demo users for testing (optional - only in development)
PRINT 'Creating demo users for development environment...'

-- Demo users with different roles (all with password 'admin123')
MERGE tbl_users AS target
USING (VALUES 
    ('manager', 'manager@example.com', 'scrypt:32768:8:1$HK5uJI3xDTXlq4xf$5d5c9bccf547366d8bf67326675137631a801fd4bcc90df3a5cc7b394b2867f9acbf056d01863b0c598439096ac00bd0ae6f3bd7d1f56375df66f5b1a8fde672', 'manager', 0),
    ('user', 'user@example.com', 'scrypt:32768:8:1$HK5uJI3xDTXlq4xf$5d5c9bccf547366d8bf67326675137631a801fd4bcc90df3a5cc7b394b2867f9acbf056d01863b0c598439096ac00bd0ae6f3bd7d1f56375df66f5b1a8fde672', 'user', 0),
    ('viewer', 'viewer@example.com', 'scrypt:32768:8:1$HK5uJI3xDTXlq4xf$5d5c9bccf547366d8bf67326675137631a801fd4bcc90df3a5cc7b394b2867f9acbf056d01863b0c598439096ac00bd0ae6f3bd7d1f56375df66f5b1a8fde672', 'viewer', 0)
) AS source (username, email, password_hash, role, is_super_admin)
ON target.username = source.username
WHEN MATCHED THEN
    UPDATE SET 
        email = source.email,
        password_hash = source.password_hash,
        role = source.role,
        is_super_admin = source.is_super_admin
WHEN NOT MATCHED THEN
    INSERT (username, email, password_hash, role, is_super_admin, created_at)
    VALUES (source.username, source.email, source.password_hash, source.role, source.is_super_admin, GETDATE());

PRINT 'Created demo users'
GO
GO
GO

-- Count and report
DECLARE @user_count INT
SELECT @user_count = COUNT(*) FROM tbl_users

PRINT 'Default users seeding completed!'
PRINT 'Total users: ' + CAST(@user_count AS VARCHAR(10))
PRINT ''
PRINT '🔐 IMPORTANT SECURITY NOTICE:'
PRINT 'Default admin credentials:'
PRINT '  Username: admin'
PRINT '  Password: admin123'
PRINT ''
PRINT '⚠️  CHANGE THE DEFAULT PASSWORD IMMEDIATELY AFTER FIRST LOGIN!'
PRINT '🔒 For production, disable or remove demo accounts!'
GO
