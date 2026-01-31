-- =====================================================
-- Database Cleanup Script
-- =====================================================
-- USE WITH CAUTION! This script will drop all tables
-- Run: python database_setup.py cleanup
-- =====================================================

-- Disable foreign key constraints temporarily
IF EXISTS(SELECT * FROM sys.foreign_keys)
BEGIN
    PRINT 'Disabling foreign key constraints...'
    
    DECLARE @sql NVARCHAR(MAX) = ''
    SELECT @sql = @sql + 'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ' NOCHECK CONSTRAINT ALL;' + CHAR(13)
    FROM sys.tables
    
    IF @sql != ''
        EXEC sp_executesql @sql
END
GO

-- Drop all views
DECLARE @sql NVARCHAR(MAX) = ''
SELECT @sql = @sql + 'DROP VIEW ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' + CHAR(13)
FROM sys.views

IF @sql != ''
BEGIN
    PRINT 'Dropping all views...'
    EXEC sp_executesql @sql
END
GO

-- Drop all stored procedures
DECLARE @sql NVARCHAR(MAX) = ''
SELECT @sql = @sql + 'DROP PROCEDURE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' + CHAR(13)
FROM sys.procedures
WHERE type = 'P'

IF @sql != ''
BEGIN
    PRINT 'Dropping all stored procedures...'
    EXEC sp_executesql @sql
END
GO

-- Drop all functions
DECLARE @sql NVARCHAR(MAX) = ''
SELECT @sql = @sql + 'DROP FUNCTION ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' + CHAR(13)
FROM sys.objects
WHERE type IN ('FN', 'IF', 'TF')

IF @sql != ''
BEGIN
    PRINT 'Dropping all functions...'
    EXEC sp_executesql @sql
END
GO

-- Drop all tables (in dependency order)
DECLARE @sql NVARCHAR(MAX) = ''

-- First drop tables with foreign keys
WHILE EXISTS(SELECT * FROM sys.foreign_keys)
BEGIN
    SELECT TOP 1 @sql = 'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + '.' + QUOTENAME(t.name) + ' DROP CONSTRAINT ' + QUOTENAME(fk.name)
    FROM sys.foreign_keys fk
    INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
    
    EXEC sp_executesql @sql
END

-- Now drop all tables
SET @sql = ''
SELECT @sql = @sql + 'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' + CHAR(13)
FROM sys.tables

IF @sql != ''
BEGIN
    PRINT 'Dropping all tables...'
    EXEC sp_executesql @sql
END
GO

PRINT 'Database cleanup completed successfully!'
GO