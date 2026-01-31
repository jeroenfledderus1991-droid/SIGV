/*
    View: vw_statussen
    Purpose: Stable interface for statussen master data
*/

IF OBJECT_ID('dbo.vw_statussen', 'V') IS NOT NULL
    DROP VIEW dbo.vw_statussen;
GO

CREATE VIEW dbo.vw_statussen
AS
SELECT 
    id,
    status,
    volgorde,
    created_at,
    updated_at
FROM 
    dbo.tbl_statussen;
GO
