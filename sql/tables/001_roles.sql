/* =========================================================
   ROLES & PERMISSIONS TABLES
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Roles table
IF OBJECT_ID('dbo.tbl_roles', 'U') IS NULL
CREATE TABLE dbo.tbl_roles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    naam NVARCHAR(50) NOT NULL UNIQUE,
    omschrijving NVARCHAR(200) NULL,
    volgorde INT NOT NULL DEFAULT 0
);
GO

-- Role permissions table
IF OBJECT_ID('dbo.tbl_role_permissions', 'U') IS NULL
CREATE TABLE dbo.tbl_role_permissions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    role_id INT NOT NULL FOREIGN KEY REFERENCES dbo.tbl_roles(id),
    page NVARCHAR(50) NOT NULL,
    allowed BIT NOT NULL DEFAULT 0
);
GO

-- Seed basis admin rol
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_roles WHERE naam = 'admin')
    INSERT INTO dbo.tbl_roles (naam, omschrijving, volgorde) VALUES ('admin','Volledige toegang',1);
GO

-- ALL wildcard permissie voor admin rol
IF EXISTS (SELECT 1 FROM dbo.tbl_roles WHERE naam='admin')
    AND NOT EXISTS (SELECT 1 FROM dbo.tbl_role_permissions rp JOIN dbo.tbl_roles r ON r.id = rp.role_id WHERE r.naam='admin' AND rp.page='ALL')
BEGIN
    INSERT INTO dbo.tbl_role_permissions (role_id, page, allowed)
    SELECT r.id, 'ALL', 1 FROM dbo.tbl_roles r WHERE r.naam='admin';
END
GO