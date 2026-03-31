/*
    Table patch: tbl_wordbee_complaints
    Purpose: Extra klachtvelden voor handmatige opvolging en PDF-rapportage.
*/

IF COL_LENGTH('dbo.tbl_wordbee_complaints', 'complaint_date') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_wordbee_complaints
    ADD complaint_date DATE NULL;
END
GO

IF COL_LENGTH('dbo.tbl_wordbee_complaints', 'actions_taken') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_wordbee_complaints
    ADD actions_taken NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.tbl_wordbee_complaints', 'resolved_date') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_wordbee_complaints
    ADD resolved_date DATE NULL;
END
GO
