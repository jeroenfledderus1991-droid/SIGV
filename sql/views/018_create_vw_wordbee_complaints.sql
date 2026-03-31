/*
    View: vw_wordbee_complaints
    Purpose: Stable read model for handmatige WordBee klachten.
*/

IF OBJECT_ID('dbo.vw_wordbee_complaints', 'V') IS NOT NULL
    DROP VIEW dbo.vw_wordbee_complaints;
GO

CREATE VIEW dbo.vw_wordbee_complaints
AS
SELECT
    id,
    kenmerk,
    complaint_text,
    complaint_date,
    actions_taken,
    resolved_date,
    created_by_user_id,
    created_by_display,
    updated_by_user_id,
    updated_by_display,
    created_at,
    updated_at
FROM dbo.tbl_wordbee_complaints;
GO
