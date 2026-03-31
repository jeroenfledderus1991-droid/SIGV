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
