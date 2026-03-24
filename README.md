# Node + React + Express + .NET Template

This template provides a separated front-end, Node/Express API, and .NET API with shared secrets via the root `.env`.

## Structure
- `client/` React (Vite)
- `server/` Node/Express API
- `dotnet/TemplateApi/` .NET API

## Quick Start
1) Copy `.env.example` to `.env` and fill in real values.
2) Install and run each service.

All-in-one start:
```bash
npm install
npm run dev
```

React UI:
```bash
cd client
npm install
npm run dev
```

Express API:
```bash
cd server
npm install
npm run dev
```

.NET API:
```bash
cd dotnet/TemplateApi
dotnet run
```

## Auth (Microsoft Entra ID)
- Configure `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `MICROSOFT_TENANT_ID`.
- Express exposes `/api/secure/profile` for a JWT-protected example.
- .NET exposes `/api/secure/profile` for a JWT-protected example.

## Database (MSSQL)
- Uses `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
- Optional: set `APP_DEFAULT_USER_EMAIL` to pick the default user for theme settings.
- Optional central failed-login audit database (shared across tools):
  - Run `sql/security_audit/001_create_auth_audit_database.sql` once.
  - Configure:
    - `AUTH_AUDIT_ENABLED=1`
    - `AUTH_AUDIT_DB_NAME=TemplateSecurityAudit`
    - `AUTH_AUDIT_DB_SERVER`, `AUTH_AUDIT_DB_USER`, `AUTH_AUDIT_DB_PASSWORD`
    - Optional: `AUTH_AUDIT_APP_NAME=<tool-naam>` to identify each template app
  - If enabled and configured, failed login attempts are stored in `dbo.tbl_failed_login_events`.
  - For generic server errors, also run `sql/security_audit/002_create_system_error_table.sql`.
  - General 5xx/process errors are stored in `dbo.tbl_system_errors`.
  - Relevante client console errors (window errors, unhandled rejections, console.error) worden gefilterd en ook opgeslagen in `dbo.tbl_system_errors` met `source='client'`.
- Express endpoints:
  - `/api/db/health`
  - `/api/db/info`
  - `/api/user-settings` (GET/POST)
  - `/api/roles/matrix`
  - `/api/roles` (POST)
  - `/api/roles/permissions` (POST)
  - `/api/roles/order` (POST)
  - `/api/roles/:id/delete` (POST)
  - `/api/stamgegevens/statussen` (GET/POST/PUT/DELETE)
  - `/api/stamgegevens/statussen/order` (POST)
- .NET endpoints:
  - `/api/db/health`
  - `/api/db/info`

## Environment Notes
- Express reads the root `.env` automatically.
- .NET loads the root `.env` at startup using DotNetEnv.
- Configure CORS with `CORS_ORIGIN` when front-end and APIs run on different ports.

## Engineering Standards
- Keep code compact and modular. Avoid large, mixed-responsibility files.
- Recommended size targets:
  - React pages/components/hooks: <= 250 lines.
  - CSS module files: <= 200 lines.
  - Services/helpers: <= 300 lines.
- Review threshold:
  - Around 400+ lines in one file means the file should usually be split.
- CSS organization:
  - Use `client/src/styles/pages.css` only as an import hub.
  - Put page-level styles in `client/src/styles/pages/*.css`.
  - Keep shared primitives in existing shared styles (`components.css`, `layout.css`, `themes.css`).
