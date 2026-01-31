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
- Express endpoints:
  - `/api/db/health`
  - `/api/db/info`
  - `/api/user-settings` (GET/POST)
  - `/api/roles/matrix`
  - `/api/roles` (POST)
  - `/api/roles/permissions` (POST)
  - `/api/roles/order` (POST)
  - `/api/roles/:id/delete` (POST)
  - `/api/stamgegevens/bedrijven` (GET/POST/PUT/DELETE)
  - `/api/stamgegevens/statussen` (GET/POST/PUT/DELETE)
  - `/api/stamgegevens/fases` (GET/POST/PUT/DELETE)
  - `/api/stamgegevens/*/order` (POST)
- .NET endpoints:
  - `/api/db/health`
  - `/api/db/info`

## Environment Notes
- Express reads the root `.env` automatically.
- .NET loads the root `.env` at startup using DotNetEnv.
- Configure CORS with `CORS_ORIGIN` when front-end and APIs run on different ports.
