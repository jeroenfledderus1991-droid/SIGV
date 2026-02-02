-- =====================================================
-- Feature Flags Data Seeding
-- =====================================================
-- Seeds essential feature flag according to simplified architecture
-- Only SHOW_SETTINGS_TAB is retained as per architecture cleanup
-- Run: python database_setup.py data
-- =====================================================

-- First, ensure the feature flags table exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tbl_feature_flags')
BEGIN
    RAISERROR('Feature flags table does not exist! Run table creation first.', 16, 1)
    RETURN
END
GO

PRINT 'Seeding feature flags data...'

-- Insert/Update essential feature flag
MERGE tbl_feature_flags AS target
USING (VALUES 
    -- User settings feature toggle
    ('ENABLE_USER_SETTINGS', 1, 'SETTINGS', 'Sta gebruikers toe om persoonlijke instellingen aan te passen (thema, kleuren, sidebar)'),
    ('ENABLE_AUTO_LOGINS', 0, 'SYSTEM', 'Sta automatische login via speciale link toe'),
    ('ENABLE_ADMIN_AUTO_LOGIN', 0, 'SYSTEM', 'Log automatisch in als superadmin (EESA)'),
    ('ENABLE_USER_AUTO_LOGIN', 0, 'SYSTEM', 'Log automatisch in als standaard gebruiker')
) AS source (flag_name, enabled, page_key, description)
ON target.flag_name = source.flag_name
WHEN MATCHED THEN
    UPDATE SET 
        enabled = source.enabled,
        page_key = source.page_key,
        description = source.description,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (flag_name, enabled, page_key, description, updated_at)
    VALUES (source.flag_name, source.enabled, source.page_key, source.description, GETDATE());
GO

-- Clean up old/deprecated feature flags
DELETE FROM tbl_feature_flags 
WHERE flag_name NOT IN ('ENABLE_USER_SETTINGS', 'ENABLE_AUTO_LOGINS', 'ENABLE_ADMIN_AUTO_LOGIN', 'ENABLE_USER_AUTO_LOGIN');
GO

-- Count and report
DECLARE @flag_count INT, @enabled_count INT, @disabled_count INT
SELECT @flag_count = COUNT(*) FROM tbl_feature_flags
SELECT @enabled_count = COUNT(*) FROM tbl_feature_flags WHERE enabled = 1
SELECT @disabled_count = COUNT(*) FROM tbl_feature_flags WHERE enabled = 0

PRINT 'Feature flags seeding completed!'
PRINT 'Total feature flags: ' + CAST(@flag_count AS VARCHAR(10))
PRINT 'Enabled flags: ' + CAST(@enabled_count AS VARCHAR(10))
PRINT 'Disabled flags: ' + CAST(@disabled_count AS VARCHAR(10))
GO
