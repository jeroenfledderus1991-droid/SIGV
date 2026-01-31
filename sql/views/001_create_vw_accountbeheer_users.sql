/*
    View: vw_accountbeheer_users
    Purpose: Stable interface for user account data
    
    Benefits:
    - Protects against schema changes in tbl_users
    - Explicit column selection (no SELECT *)
    - Can add computed columns without changing table
    - Backwards compatible when new columns added
*/

-- Drop existing view if it exists
IF OBJECT_ID('dbo.vw_accountbeheer_users', 'V') IS NOT NULL
    DROP VIEW dbo.vw_accountbeheer_users;
GO

-- Create view with explicit column selection
CREATE VIEW dbo.vw_accountbeheer_users
AS
SELECT 
    -- Primary Key
    user_id,
    id,
    
    -- Authentication
    username,
    email,
    password_hash,
    
    -- Personal Information
    voornaam,
    achternaam,
    
    -- Authorization
    role,
    is_super_admin,
    
    -- Password Reset
    reset_token,
    reset_token_expires,
    
    -- Timestamps
    created_at,
    last_login,
    
    -- Computed Fields (add without changing table!)
    CONCAT(voornaam, ' ', achternaam) AS volledig_naam,
    CASE 
        WHEN is_super_admin = 1 THEN 'Super Admin'
        WHEN role IS NOT NULL THEN role
        ELSE 'User'
    END AS role_label
FROM 
    dbo.tbl_users;
GO

-- Grant permissions
GRANT SELECT ON dbo.vw_accountbeheer_users TO public;
GO
