# Build Prompt Guide (Template)

Use this prompt baseline when extending this template with AI tooling.

## Core constraints
- Keep changes small, modular, and reviewable.
- Do not create large mixed-responsibility files.
- Reuse existing patterns before introducing new abstractions.

## Stack-specific rules
- React client:
  - Use API helpers from `client/src/api.js` (`getJson`, `postJson`, `putJson`, `deleteJson`).
  - Keep page-specific styles in `client/src/styles/pages/*.css`.
  - Keep `client/src/styles/pages.css` as import hub only.
- Express API:
  - Protect authenticated routes with `requireAuth`.
  - Apply `requirePermission("/feature*")` where relevant.
  - Read via `vw_*` objects and write via `tbl_*` objects.
  - Use parameterized SQL only.
- Config:
  - Use root `.env`; do not hardcode credentials, ports, or secrets.

## File size guardrails
- React pages/components/hooks: target <= 250 lines.
- CSS module files: target <= 200 lines.
- Services/helpers: target <= 300 lines.
- If a file approaches 400+ lines, split it into focused modules.

## Delivery checklist per feature
1. Add/adjust DB table + view (if data model changes).
2. Add secured API endpoints.
3. Register permission pattern and matching nav permission.
4. Add React page + route.
5. Keep styles modular under `client/src/styles/pages/`.
6. Validate auth flow, permissions, and CRUD behavior.
