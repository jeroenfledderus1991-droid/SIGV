-- ==============================================================================
-- View: vw_user_actions
-- Purpose: Stable interface voor user activity tracking
-- Table: tbl_user_actions
-- Domain: Accountbeheer / Audit
-- ==============================================================================

IF OBJECT_ID('dbo.vw_user_actions', 'V') IS NOT NULL
    DROP VIEW dbo.vw_user_actions;
GO

CREATE VIEW dbo.vw_user_actions AS
SELECT 
    -- Primary key
    ua.id,
    
    -- Foreign keys
    ua.user_id,
    
    -- Action details
    ua.action_code,
    ua.action_label,
    ua.meta,
    
    -- Request details
    ua.ip_address,
    ua.user_agent,
    
    -- Timestamps
    ua.created_at,
    
    -- =============================================
    -- Computed columns voor convenience
    -- =============================================
    
    -- Action category (extracted from action_code)
    CASE 
        WHEN ua.action_code LIKE 'auth.%' THEN 'Authenticatie'
        WHEN ua.action_code LIKE 'user.%' THEN 'Gebruikersbeheer'
        WHEN ua.action_code LIKE 'role.%' THEN 'Rollenbeheer'
        WHEN ua.action_code LIKE 'settings.%' THEN 'Instellingen'
        WHEN ua.action_code LIKE 'data.%' THEN 'Data operaties'
        ELSE 'Overig'
    END AS action_category,
    
    -- Action severity level
    CASE 
        WHEN ua.action_code IN ('auth.login_failed', 'auth.unauthorized', 'security.breach') THEN 'CRITICAL'
        WHEN ua.action_code LIKE 'auth.%' THEN 'HIGH'
        WHEN ua.action_code LIKE 'data.delete%' THEN 'MEDIUM'
        ELSE 'LOW'
    END AS action_severity,
    
    -- Time since action (voor recent activity)
    DATEDIFF(MINUTE, ua.created_at, SYSDATETIME()) AS minutes_ago,
    
    -- Shortened user agent (voor display)
    CASE 
        WHEN LEN(ua.user_agent) > 50 THEN LEFT(ua.user_agent, 47) + '...'
        ELSE ua.user_agent
    END AS user_agent_short,
    
    -- Friendly timestamp
    CASE 
        WHEN DATEDIFF(HOUR, ua.created_at, SYSDATETIME()) < 1 THEN 'Minder dan een uur geleden'
        WHEN DATEDIFF(DAY, ua.created_at, SYSDATETIME()) < 1 THEN 'Vandaag'
        WHEN DATEDIFF(DAY, ua.created_at, SYSDATETIME()) = 1 THEN 'Gisteren'
        WHEN DATEDIFF(DAY, ua.created_at, SYSDATETIME()) < 7 THEN CAST(DATEDIFF(DAY, ua.created_at, SYSDATETIME()) AS NVARCHAR) + ' dagen geleden'
        ELSE CONVERT(NVARCHAR(20), ua.created_at, 105)
    END AS created_at_friendly

FROM dbo.tbl_user_actions ua;
GO

-- ==============================================================================
-- View metadata en documentatie
-- ==============================================================================
-- Created: 2025-01-XX
-- Purpose: Protect application from schema changes in tbl_user_actions
-- Usage: SELECT * FROM vw_user_actions WHERE user_id = ? ORDER BY created_at DESC
-- Computed Columns:
--   - action_category: Extracted categorie van action code
--   - action_severity: Severity level voor alerting
--   - minutes_ago: Time since action voor filtering
--   - user_agent_short: Truncated user agent voor UI
--   - created_at_friendly: Human-readable timestamp
-- ==============================================================================
