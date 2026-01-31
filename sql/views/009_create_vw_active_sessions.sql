-- ==============================================================================
-- View: vw_active_sessions
-- Purpose: Stable interface voor session tracking
-- Table: tbl_active_sessions
-- Domain: Accountbeheer / Security
-- ==============================================================================

IF OBJECT_ID('dbo.vw_active_sessions', 'V') IS NOT NULL
    DROP VIEW dbo.vw_active_sessions;
GO

CREATE VIEW dbo.vw_active_sessions AS
SELECT 
    -- Primary key
    s.id,
    
    -- Foreign keys
    s.user_id,
    
    -- Session details
    s.session_id,
    
    -- Timestamps
    s.login_time,
    s.last_seen,
    
    -- =============================================
    -- Computed columns voor convenience
    -- =============================================
    
    -- Session duration in minutes
    DATEDIFF(MINUTE, s.login_time, COALESCE(s.last_seen, SYSDATETIME())) AS session_duration_minutes,
    
    -- Session is active (last seen within 30 minutes)
    CASE 
        WHEN DATEDIFF(MINUTE, s.last_seen, SYSDATETIME()) <= 30 THEN 1
        ELSE 0
    END AS is_active,
    
    -- Session status label
    CASE 
        WHEN DATEDIFF(MINUTE, s.last_seen, SYSDATETIME()) <= 5 THEN 'Actief'
        WHEN DATEDIFF(MINUTE, s.last_seen, SYSDATETIME()) <= 30 THEN 'Inactief'
        ELSE 'Verlopen'
    END AS session_status,
    
    -- Status badge kleur
    CASE 
        WHEN DATEDIFF(MINUTE, s.last_seen, SYSDATETIME()) <= 5 THEN 'success'
        WHEN DATEDIFF(MINUTE, s.last_seen, SYSDATETIME()) <= 30 THEN 'warning'
        ELSE 'danger'
    END AS status_badge,
    
    -- Minutes since last activity
    DATEDIFF(MINUTE, s.last_seen, SYSDATETIME()) AS minutes_since_last_seen,
    
    -- Friendly login time
    CASE 
        WHEN DATEDIFF(HOUR, s.login_time, SYSDATETIME()) < 1 THEN 'Minder dan een uur geleden'
        WHEN DATEDIFF(DAY, s.login_time, SYSDATETIME()) < 1 THEN 'Vandaag ingelogd'
        WHEN DATEDIFF(DAY, s.login_time, SYSDATETIME()) = 1 THEN 'Gisteren ingelogd'
        ELSE CONVERT(NVARCHAR(20), s.login_time, 105)
    END AS login_time_friendly,
    
    -- Masked session ID (voor security - alleen laatste 8 chars)
    '****' + RIGHT(s.session_id, 8) AS session_id_masked

FROM dbo.tbl_active_sessions s;
GO

-- ==============================================================================
-- View metadata en documentatie
-- ==============================================================================
-- Created: 2025-01-XX
-- Purpose: Protect application from schema changes in tbl_active_sessions
-- Usage: SELECT * FROM vw_active_sessions WHERE is_active = 1
-- Computed Columns:
--   - session_duration_minutes: Total session duration
--   - is_active: Boolean check voor active sessions (<30 min)
--   - session_status: Readable status string
--   - status_badge: Bootstrap badge class
--   - minutes_since_last_seen: Time since last activity
--   - login_time_friendly: Human-readable login time
--   - session_id_masked: Partially hidden session ID
-- Security Note: session_id_masked gebruikt voor admin UI om volledige IDs te verbergen
-- ==============================================================================
