-- =====================================================
-- Sync user-role links from tbl_users.role to tbl_user_roles
-- =====================================================
-- Purpose:
--   Backfill missing records in tbl_user_roles for existing users
--   that already have a role name in tbl_users.role.
-- Run:
--   python database_setup.py data
-- =====================================================

PRINT 'Syncing user role links from tbl_users.role...'

IF OBJECT_ID('dbo.tbl_users', 'U') IS NULL
BEGIN
    RAISERROR('Users table does not exist.', 16, 1)
    RETURN
END
GO

IF OBJECT_ID('dbo.tbl_roles', 'U') IS NULL
BEGIN
    RAISERROR('Roles table does not exist.', 16, 1)
    RETURN
END
GO

IF OBJECT_ID('dbo.tbl_user_roles', 'U') IS NULL
BEGIN
    RAISERROR('User roles table does not exist.', 16, 1)
    RETURN
END
GO

;WITH mapped_roles AS (
    SELECT u.user_id, r.id AS role_id
    FROM dbo.tbl_users u
    INNER JOIN dbo.tbl_roles r
        ON LOWER(r.naam) = LOWER(LTRIM(RTRIM(ISNULL(u.role, ''))))
    WHERE LTRIM(RTRIM(ISNULL(u.role, ''))) <> ''
)
INSERT INTO dbo.tbl_user_roles (user_id, role_id)
SELECT m.user_id, m.role_id
FROM mapped_roles m
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.tbl_user_roles ur
    WHERE ur.user_id = m.user_id
      AND ur.role_id = m.role_id
);
GO

PRINT 'User role link sync completed.'
GO
