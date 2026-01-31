/*
    View: vw_fases
    Purpose: Stable interface for fases master data
*/

IF OBJECT_ID('dbo.vw_fases', 'V') IS NOT NULL
    DROP VIEW dbo.vw_fases;
GO

CREATE VIEW dbo.vw_fases
AS
SELECT 
    id,
    fases,
    getal,
    volgorde,
    created_at,
    updated_at
FROM 
    dbo.tbl_fases;
GO
