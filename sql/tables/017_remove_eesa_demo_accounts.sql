SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
  Remove legacy EESA demo accounts.
  Related rows in tbl_user_roles, tbl_active_sessions, tbl_user_settings and
  tbl_user_actions are deleted automatically through ON DELETE CASCADE.
*/
DELETE FROM dbo.tbl_users
WHERE username IN ('EESA', 'eesa', 'EESA_USER')
   OR email IN ('eesa@admin.local', 'eesa@local.admin', 'eesa@user.local');
GO
