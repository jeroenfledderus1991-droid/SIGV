# AGENTS.md - React + Express + .NET Template

This file captures the local rules and patterns for this template. Keep changes consistent with the existing structure.

## Rollenhandboek — verplichte eerste stap

> **Lees `AGENTS_ROLLEN.md` vóórdat je iets uitvoert.**
> Rollen worden standaard automatisch geactiveerd op basis van taaktype (zie `AGENTS_ROLLEN.md`). Als een prompt expliciet een rol/rolvolgorde noemt, dan geldt die expliciete instructie.
>
> Standaard workflow:
> 1. Gebruiker verwoordt zijn wens aan de **Prompt Engineer**.
> 2. Optioneel kan de gebruiker direct de **Project manager** starten (`ROL: Project manager` + `Start`) voor end-to-end orkestratie.
> 3. De Prompt Engineer schrijft anders een gestructureerde Codex-prompt met per-rol instructies.
> 4. Bij plan-/scope-/architectuurvragen: **Product Owner** en **Architect** worden automatisch samen geactiveerd tot een bouwklaar plan.
> 5. Elke betrokken rol voert daarna zijn eigen sectie uit.
> 6. Besluiten over architectuur/scope/fasering kunnen standaard door **Project manager + Architect** worden genomen zonder aparte gebruikersakkoordstap, tenzij expliciet anders gevraagd.
>
> Beschikbare rollen: `Project manager` · `Prompt Engineer` · `Product Owner` · `Architect` · `Builder` · `Tester` · `Designer` · `Data-engineer` · `Cyber-security`

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

## CSS governance (semantic split)
- Do not split CSS by raw line numbers; split by meaning/concern.
- For large style domains, use an import hub + folder model:
  - Hub file: `client/src/styles/<domain>.css` contains only ordered `@import` rules.
  - Detail files: `client/src/styles/<domain>/*.css` grouped by concern (example: `sidebar-menu.css`, `sidebar-footer.css`).
- CSS size policy:
  - Preferred: <= 300 lines per semantic CSS file.
  - Mandatory split: > 500 lines.
  - Blocker threshold: > 700 lines.
- Keep import order intentional:
  - Consider hub import order functional and stable.
  - Add new CSS files in the correct cascade order; do not reorder unrelated imports.
- Feature-specific placement rules:
  - Sidebar changes go in `client/src/styles/sidebar/*`.
  - Client table changes go in `client/src/styles/client-table/*`.
  - Theme override changes go in `client/src/styles/theme-override/*`.
  - Do not re-introduce large monolithic CSS files for these domains.

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

## ClientTable settings intake (verplicht)
- Component-keuze:
  - Standaard altijd `client/src/components/ClientTable.jsx`.
  - Gebruik `client/src/components/ClientTableEditable.jsx` alleen als de gebruiker expliciet vraagt om inline wijzigen in de tabel zelf i.p.v. via modal/scherm.
- Bij elke **nieuwe** tabel (`ClientTable`) moet de agent **altijd eerst** de instelbare tabelsettings uitvragen en bevestigen vóór implementatie.
- Vaste defaults (altijd aan, alleen wijzigen bij expliciete user-vraag):
  - Actiekolom altijd aanwezig en sticky rechts (`actions` + sticky gedrag).
  - Filters/export altijd aanwezig (`enableColumnFilters`, `exportEnabled`).
  - Kolomvoorkeuren altijd opslaan per user/device (verbergen/verplaatsen/breedtes/rijen).
- Minimale vragenlijst per tabel:
  - Rijgedrag: `enableRowClickAction`, `rowClickActionType`
  - Scrollgedrag: `horizontalScroll` (`auto|on|off`)
  - Actiekolom: alleen afwijkingen op default, bijvoorbeeld `actionsColumnWidth` of expliciet uitschakelen
  - Kolommen: `enableColumnResize`, `enableColumnCustomization`, volgorde/verbergen toegestaan ja/nee
  - Filters/export: alleen afwijkingen op default, plus `searchEnabled`
  - Paginering: standaard `rowsPerPage`, toegestane `rowsOptions`, `Alle` toegestaan ja/nee
  - Default breedtes: per kolom `width`, `minWidth`, eventueel `widthWeight`
  - Persistente voorkeuren: alleen uitvragen bij expliciete wens om af te wijken
- Als de gebruiker niet alle keuzes aanlevert:
  - Eerst gericht navragen.
  - Daarna pas bouwen met expliciet vastgelegde defaults.
- Extra intake voor `ClientTableEditable` (alleen bij expliciete inline-edit wens):
  - Welke kolommen zijn bewerkbaar (`editableColumns` of `column.editable`)?
  - Nieuwe regels toegestaan ja/nee (`enableRowAdd`)?
  - Callbackgedrag bij wijzigen/toevoegen (`onDataChange`, `onAddRow`)?

## Dropdown widget-keuze (verplicht)
- Bij elke **nieuwe dropdown** moet de agent eerst expliciet het widget-type vastleggen vóór implementatie.
- Toegestane standaardtypes:
  - `ComboboxPartialMatchingWidget` (selectie met typen/partial match)
  - `ComboboxMultiSelectFilterWidget` (meerdere selectie-opties met filter-checkboxes)
- Zonder expliciete keuze: **altijd eerst navragen** met simpele opties.
- Vastleggen in code-review/oplevering:
  - gekozen widget-type
  - reden van keuze
  - of het single-select of multi-select gedrag is
- Toekomstvast:
  - nieuwe dropdown-widgets mogen worden toegevoegd als nieuw type, maar bestaande types niet stilzwijgend vervangen.
  - bij een nieuw type altijd eerst naam + doel + gebruikssituatie bevestigen.

## Database notes
- Views live in `sql/views/`. Tables live in `sql/tables/`.
- Use `sql/database_setup.py views` for view updates.
- Keep computed columns in views, not in tables.

## Auth and settings
- Session auth and CSRF are enforced in Express (security + route modules, wired in `server/src/index.js`).
- App settings and feature flags are served from `/api/settings`.
- React uses `useAuth`, `usePermissions`, `useThemeSettings`, `useAppSettings` hooks; keep that flow intact.

