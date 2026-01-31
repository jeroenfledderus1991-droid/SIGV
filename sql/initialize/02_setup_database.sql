-- =====================================================
-- Database Initialization Script
-- =====================================================
-- Basic database setup and configuration
-- Run: python database_setup.py initialize
-- =====================================================

-- Set database options for optimal performance
IF DB_NAME() IS NOT NULL
BEGIN
    PRINT 'Configuring database options...'
    
    -- Set database to simple recovery model for development
    -- (Change to FULL for production)
    IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = DB_NAME() AND recovery_model = 3)
    BEGIN
        DECLARE @sql NVARCHAR(MAX) = 'ALTER DATABASE ' + QUOTENAME(DB_NAME()) + ' SET RECOVERY SIMPLE'
        EXEC sp_executesql @sql
        PRINT 'Set recovery model to SIMPLE'
    END
    
    -- Enable snapshot isolation for better concurrency
    DECLARE @sql2 NVARCHAR(MAX) = 'ALTER DATABASE ' + QUOTENAME(DB_NAME()) + ' SET ALLOW_SNAPSHOT_ISOLATION ON'
    EXEC sp_executesql @sql2
    PRINT 'Enabled snapshot isolation'
    
    -- Set auto-close and auto-shrink to OFF for performance
    DECLARE @sql3 NVARCHAR(MAX) = 'ALTER DATABASE ' + QUOTENAME(DB_NAME()) + ' SET AUTO_CLOSE OFF'
    EXEC sp_executesql @sql3
    
    DECLARE @sql4 NVARCHAR(MAX) = 'ALTER DATABASE ' + QUOTENAME(DB_NAME()) + ' SET AUTO_SHRINK OFF'
    EXEC sp_executesql @sql4
    
    PRINT 'Database configuration completed'
END
GO

-- Create custom schemas if needed
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'logs')
BEGIN
    EXEC('CREATE SCHEMA logs')
    PRINT 'Created logs schema'
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'config')
BEGIN
    EXEC('CREATE SCHEMA config')
    PRINT 'Created config schema'
END
GO

-- Create audit/logging infrastructure
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'system_log' AND schema_id = SCHEMA_ID('logs'))
BEGIN
    CREATE TABLE logs.system_log (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        timestamp DATETIME2 DEFAULT GETDATE(),
        level VARCHAR(10) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        source VARCHAR(100),
        user_id INT,
        session_id VARCHAR(50),
        ip_address VARCHAR(45),
        INDEX IX_system_log_timestamp (timestamp),
        INDEX IX_system_log_level (level),
        INDEX IX_system_log_source (source)
    )
    
    PRINT 'Created system_log table'
END
GO

-- Create application metadata table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'app_metadata' AND schema_id = SCHEMA_ID('config'))
BEGIN
    CREATE TABLE config.app_metadata (
        key_name VARCHAR(100) PRIMARY KEY,
        value_data NVARCHAR(MAX),
        description NVARCHAR(500),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    )
    
    PRINT 'Created app_metadata table'
END
GO

-- Insert basic application metadata
MERGE config.app_metadata AS target
USING (VALUES 
    ('database_version', '1.0.0', 'Current database schema version'),
    ('app_name', 'Flask Planning Tool', 'Application name'),
    ('setup_date', CONVERT(VARCHAR(19), GETDATE(), 120), 'Database setup date'),
    ('environment', 'development', 'Current environment')
) AS source (key_name, value_data, description)
ON target.key_name = source.key_name
WHEN MATCHED THEN
    UPDATE SET 
        value_data = source.value_data,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (key_name, value_data, description)
    VALUES (source.key_name, source.value_data, source.description);
GO

PRINT 'Database initialization completed successfully!'
PRINT 'Next steps: Run table creation, then data seeding'
GO