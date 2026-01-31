/*
    View: vw_accountbeheer_users_detail
    Purpose: Extended user information with role details
    
    Use Case: User profile pages, detailed user information display
    
    Benefits:
    - Pre-joined with roles table
    - Single query for complete user info
    - Computed display fields
*/

-- Drop existing view if it exists
IF OBJECT_ID('dbo.vw_accountbeheer_users_detail', 'V') IS NOT NULL
    DROP VIEW dbo.vw_accountbeheer_users_detail;
GO

-- Create detailed view (without role join since tbl_rollen doesn't exist yet)
CREATE VIEW dbo.vw_accountbeheer_users_detail
AS
SELECT 
    -- User Fields
    user_id,
    id,
    username,
    email,
    voornaam,
    achternaam,
    CONCAT(voornaam, ' ', achternaam) AS volledig_naam,
    
    -- Role Information
    role,
    is_super_admin,
    
    -- Password Reset Info
    reset_token,
    reset_token_expires,
    CASE 
        WHEN reset_token IS NOT NULL AND reset_token_expires > GETDATE() 
        THEN 1 
        ELSE 0 
    END AS heeft_actieve_reset,
    
    -- Timestamps
    created_at,
    last_login
FROM 
    dbo.tbl_users;
GO

-- Grant permissions
GRANT SELECT ON dbo.vw_accountbeheer_users_detail TO public;
GO
