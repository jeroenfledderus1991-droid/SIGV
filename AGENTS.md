# AGENTS.md - React + Express + .NET Template

This file captures the local rules and patterns for this template. Keep changes consistent with the existing structure.

## Core principles
- Read from database views (vw_*) and write to tables (tbl_*). Views isolate schema changes.
- All authenticated API routes must go through `requireAuth` and, when applicable, `requirePermission`.
- Keep CSRF protection intact: the React client should call `client/src/api.js` helpers so the `X-CSRF-Token` header is set.
- Reuse existing UI patterns (ClientTable, modal patterns, layout) instead of custom one-off markup.
- Configure everything via the root `.env`. Do not hardcode secrets or ports.

## Size and modularity rules
- Keep files compact and focused. Prefer many small modules over one large "god file".
- Thresholds (practical defaults for this repo):
  - Preferred: <= 500 lines per file.
  - Mandatory split: > 500 lines.
  - Blocker threshold: > 700 lines (do not continue feature work until split is done).
- Exception:
  - Vendor/third-party files (for example `client/src/vendor/*`) are exempt unless explicitly requested.
- Group styles by concern:
  - Shared styles in `client/src/styles/components.css`, `layout.css`, etc.
  - Page-specific styles in `client/src/styles/pages/*.css`.
  - Keep `client/src/styles/pages.css` as import hub only.
- For any new feature, create/extend focused files instead of appending large sections to existing monolith files.

## Composition model (vibecoding-safe)
- Keep entry files thin:
  - `server/src/index.js` and `client/src/App.jsx` are orchestration only.
  - No heavy business logic in entry files.
- Use feature-first folders:
  - Backend: `server/src/routes/<feature>/` or focused modules under `server/src/routes/`.
  - Frontend: `client/src/pages/<feature>/` with local components/hooks when needed.
- Use explicit composition files:
  - Backend: `register<Feature>Routes({ ...deps })` style is preferred.
  - Frontend: `index.js` barrel files are allowed for page/component exports.
- If a file is over threshold:
  - Do not keep adding logic to that file.
  - First split into feature modules, then continue feature work.
- Dependency rule:
  - Pass dependencies explicitly to route/service modules (object argument), avoid hidden globals.

## Project map
- React (Vite): `client/`
- Express API: `server/src/index.js`
- .NET API (optional): `dotnet/TemplateApi/`
- Database tooling + SQL: `sql/` (`database_setup.py`, `tables/`, `views/`, `procedures/`, `migrations/`)

## New feature checklist (full stack)
1) Database
   - Add table in `sql/tables/00X_feature.sql`.
   - Add view in `sql/views/00X_create_vw_feature.sql` (read model).
   - Run `python sql/database_setup.py tables` and `python sql/database_setup.py views`.
2) Express API
   - Add endpoints in a focused route module (registered from `server/src/index.js`).
   - Use `db.getPool()` and parameterized queries (no string concatenation).
   - Read via views for GETs and write via tables for POST/PUT/DELETE.
   - Guard routes with `requireAuth` and `requirePermission("/feature*")`.
3) Permissions
   - Add a page pattern entry to `PAGE_PATTERNS` in `server/src/index.js`.
   - Ensure the same pattern is used on the client for navigation filtering.
4) React UI
   - Add a page component in `client/src/pages/`.
   - Use `getJson`, `postJson`, `putJson`, `deleteJson` from `client/src/api.js`.
   - Register the route and sidebar entry in `client/src/App.jsx`.
   - For list pages, use `client/src/components/ClientTable.jsx`.
5) Optional .NET API
   - If you add endpoints, keep parity with existing `/api/*` patterns in `dotnet/TemplateApi/Program.cs`.
6) Verification
   - Test login, CRUD, permission gates, and a schema change (view still works after a table change).

## Adding a new page (React + Express)
1) API
   - Define endpoints under `/api/<feature>` in a focused route module.
   - Register the module in `server/src/index.js`.
   - Add `requirePermission("/feature*")`.
2) Permissions and navigation
   - Add a `PAGE_PATTERNS` entry so it appears in the role matrix.
   - Add a `navItems` entry in `client/src/App.jsx` with matching `permissions: ["/feature*"]`.
3) Route
   - Add a `<Route path="/feature" element={<Feature />} />` in `client/src/App.jsx`.
4) Data table
   - Use `ClientTable` with actions wired to window handlers (see `client/src/pages/Stamgegevens.jsx`).

## Database notes
- Views live in `sql/views/`. Tables live in `sql/tables/`.
- Use `sql/database_setup.py views` for view updates.
- Keep computed columns in views, not in tables.

## Auth and settings
- Session auth and CSRF are enforced in Express (security + route modules, wired in `server/src/index.js`).
- App settings and feature flags are served from `/api/settings`.
- React uses `useAuth`, `usePermissions`, `useThemeSettings`, `useAppSettings` hooks; keep that flow intact.
