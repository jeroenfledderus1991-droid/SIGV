# Project Analysis — React + Express Template

> Generated: 2026-03-05  
> Scope: Full-stack audit — security, architecture, code quality, stack fitness for enterprise use.

---

## Table of Contents

1. [Stack Overview](#1-stack-overview)
2. [Security Issues](#2-security-issues)
3. [Architecture & Code-Quality Issues](#3-architecture--code-quality-issues)
4. [Missing Infrastructure](#4-missing-infrastructure)
5. [What Works Well — Pros](#5-what-works-well--pros)
6. [Remediation Priority](#6-remediation-priority)
7. [Enterprise Readiness Verdict](#7-enterprise-readiness-verdict)

---

## 1. Stack Overview

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend | React + React Router | 19.x / 7.x | Latest, good choice |
| Build tool | Vite | 7.x | Modern, fast |
| Backend | Node.js + Express | 5.x | Latest; CommonJS only |
| Auth | Custom session + scrypt | — | Rolled by hand (see §2) |
| Microsoft SSO | OIDC via `jose` JWKS | 5.x | Well implemented |
| Database | MSSQL via `mssql` | 11.x | Parameterized queries (mostly) |
| Security headers | Helmet | 8.x | Partially overridden |
| Secrets/config | dotenv | 17.x | No validation at startup |
| Optional API | .NET 8 / ASP.NET Core | — | Thin proxy only |
| Monorepo tooling | pnpm workspaces | — | `package.json` at root |

No test runner, no CI pipeline, no container definition, no migration runner are present in the repo.

---

## 2. Security Issues

Severity scale: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low

---

### 🔴 2.1 SQL Injection via Dynamic Table and Column Names

**Files:** `server/src/index.js` — functions `listStamgegevens`, `upsertStamgegevens`, `deleteStamgegevens`, `updateOrder` (~lines 1344–1409)

Table names and column names are interpolated directly into SQL strings without any whitelist check:

```js
// Line 1349
.query(`SELECT ${columns.join(", ")} FROM dbo.${table} ORDER BY volgorde, id`);

// Line 1368
.query(`UPDATE dbo.${table} SET ${setClauses.join(", ")}, updated_at = GETDATE() WHERE id = @id`);

// Line 1374-1375
.query(`INSERT INTO dbo.${table} (${insertColumns}, volgorde, ...) VALUES (...)`);

// Line 1403
.query(`UPDATE dbo.${table} SET volgorde = @volgorde WHERE id = @id`);
```

The value and `id` fields _are_ parameterized, but the structural parts of the query are not. Any user who holds the `/stamgegevens*` permission can send `table = "tbl_statussen; DROP TABLE tbl_users --"`.

**Fix:** add a compile-time whitelist of permitted table names and allowed column sets and reject anything not in that list before building the query.

---

### 🔴 2.2 CSRF Protection Disabled by Default

**File:** `server/src/config.js` line 56

```js
csrfEnabled: process.env.CSRF_ENABLED === "1",   // opt-in, default OFF
```

Unless the operator explicitly sets `CSRF_ENABLED=1`, every state-changing API call (`POST`, `PUT`, `DELETE`) is completely unprotected against cross-site request forgery. This is backwards for a security default.

**Fix:** invert to opt-out (`process.env.CSRF_ENABLED !== "0"`).

---

### 🟠 2.3 Database Connection Is Not Encrypted

**File:** `server/src/db.js` lines 15–18

```js
options: {
  encrypt: false,
  trustServerCertificate: true,
},
```

All traffic between the Express server and MSSQL (including credentials, session tokens, and user data) travels in plaintext on the network. This is a compliance failure for any regulated data.

**Fix:** set `encrypt: true` for non-local environments and only set `trustServerCertificate: true` in local development.

---

### 🟠 2.4 Unauthenticated Auto-Login Toggle Endpoint

**File:** `server/src/index.js` line 1747

```js
app.get(/^\/auto_log=?([12])=(true|false)$/i, async (req, res) => { … });
```

This endpoint:
- requires **no authentication** whatsoever,
- can be called by anyone who knows the URL pattern,
- directly toggles admin auto-login in the database (guarded only by the master flag also being enabled in the database).

If the master feature flag is enabled (e.g., during an incident or demo), any anonymous request to `/auto_log=1=true` grants the configured admin email immediate unauthenticated access to the application.

**Fix:** remove this endpoint entirely, or at the very minimum require a valid authenticated Super Admin session.

---

### 🟠 2.5 Password Reset Token Valid for 24 Hours

**File:** `server/src/index.js` line 1059

```js
reset_token_expires = DATEADD(HOUR, 24, GETDATE())
```

A 24-hour window is excessively long for a one-time reset link. Industry standard is 15–60 minutes.

Additionally, in non-production environments the plaintext token is returned in the API response body (`payload.resetToken = token`), which will appear in server logs and browser history.

**Fix:** reduce expiry to 1–2 hours; remove the debug token leak unconditionally.

---

### 🟠 2.6 No Rate Limiting on Registration or Password-Reset Endpoints

**File:** `server/src/index.js` — `POST /api/auth/register` (line 998), `POST /api/auth/forgot-password` (line 1042)

The login endpoint does implement IP + identifier-based rate limiting backed by the database, but `/register` and `/forgot-password` have no equivalent guard. This allows:
- unlimited account creation (account-spam / resource exhaustion),
- unlimited password-reset emails (potential email-bombing of users).

**Fix:** apply the same rate-limiting pattern used on `/api/auth/login` to both endpoints, or add a global `express-rate-limit` middleware.

---

### 🟠 2.7 Empty Session Secret Allowed Outside Production

**File:** `server/src/config.js` line 52

```js
sessionSecret: process.env.SESSION_SECRET || "",   // empty string is valid
```

The length check only fires in production (`config.env === "production"`). In a staging or CI environment where `ENVIRONMENT` is set to something other than `"production"`, the app starts with an empty HMAC key. Every session signed with an empty secret is trivially forgeable.

**Fix:** validate session secret length at startup for every non-local environment, or at minimum warn loudly and refuse to start.

---

### 🟡 2.8 Hardcoded Super Admin Identity (Email-Based)

**File:** `server/src/index.js` line 49

```js
const EESA_SUPER_ADMIN_EMAIL = "eesa@admin.local";
```

Super Admin privileges are enforced partly through a role flag in the database and partly through a hardcoded email constant in source code. This creates two distinct authority paths that can diverge, and it embeds a privileged identity in the codebase. If the email changes, the check silently breaks.

**Fix:** rely solely on `is_super_admin` in the database; remove the email-based bypass.

---

### 🟡 2.9 Missing Security Headers

**File:** `server/src/index.js` lines 79–115

Helmet is imported but immediately overridden with `contentSecurityPolicy: false`, and a custom CSP is then applied. The custom CSP is correct in production, but several other headers that Helmet provides by default are missing or not verified:

- `X-Content-Type-Options: nosniff` — not explicitly set,
- `X-Frame-Options` / `frame-ancestors 'self'` is in the CSP but the legacy header is absent,
- `Strict-Transport-Security` (HSTS) — not set,
- `Referrer-Policy` — not set,
- `Permissions-Policy` — not set.

In development, the CSP explicitly allows `'unsafe-inline'` and `'unsafe-eval'`, making any XSS exploitable without restriction during development.

---

### 🟡 2.10 No Input Length or Format Validation

**File:** `server/src/index.js` — `/api/auth/register` (line 998), `/api/auth/login` (line 872)

Fields like `username`, `email`, `password`, `voornaam`, and `achternaam` are only checked for presence, not for maximum length, allowed characters, or email format. Accepting an unbounded-length password triggers a costly scrypt computation on every authentication attempt, which is a potential CPU-exhaustion vector.

**Fix:** validate email format, cap all string fields at a sensible maximum length (e.g., 255 characters), and enforce minimum password length.

---

### 🟡 2.11 No Audit Log for Sensitive Operations

There is no audit trail for:
- permission changes (`/api/roles/permissions`),
- account deletion (`DELETE /api/accounts/users/:id`),
- role assignment (`POST /api/accounts/users/:id/role`),
- feature flag changes (`POST /api/feature-flags`),
- Super Admin promotion.

In any environment that handles real user data, these operations must be logged with timestamp, actor identity, and the before/after state.

---

### 🔵 2.12 `X-Forwarded-For` Trusted Without Proxy Verification

**File:** `server/src/index.js` line 886

```js
const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";
```

`X-Forwarded-For` is read directly from the request header for rate-limiting purposes. Unless `TRUST_PROXY=1` is set and Express is configured to trust the proxy, this header can be trivially spoofed to bypass IP-based rate limiting.

**Fix:** use `req.ip` (which is already proxy-aware when `app.set('trust proxy', ...)` is configured) rather than reading the raw header.

---

## 3. Architecture & Code-Quality Issues

---

### 3.1 Monolithic Server File (1 857 Lines)

`server/src/index.js` contains route registration, middleware, business logic, helper functions, HTML templating, and the HTTP server startup — all in a single file. This violates the single-responsibility principle and makes the code hard to navigate, test, and review.

Suggested split:
```
server/src/
  middleware/   csrf.js, auth.js, permissions.js
  routes/       auth.js, accounts.js, roles.js, stamgegevens.js, featureFlags.js
  services/     session.js, bootstrap.js, settings.js
  index.js      (server startup, middleware wiring only)
```

---

### 3.2 No API Versioning

All endpoints are exposed under `/api/…` with no version segment. Any breaking change to a response shape or parameter will immediately break all consumers. For a template that is supposed to evolve, this is a maintenance risk.

**Fix:** prefix routes with `/api/v1/…` from the start.

---

### 3.3 Permission Model Has Two Parallel Authority Paths

Permissions are checked via a role-based system stored in the database (`tbl_roles`, `tbl_role_permissions`, `tbl_user_roles`). In parallel, several checks hard-code the `EESA_SUPER_ADMIN_EMAIL` constant. These two paths can produce contradictory results and make the effective permission model hard to reason about.

---

### 3.4 No Testing Infrastructure

There are no unit tests, integration tests, or end-to-end tests anywhere in the repository. The server has no test script in `package.json`. Without tests, any change to shared utilities (authentication, session, permissions) carries invisible regression risk.

---

### 3.5 No Structured Logging

All server-side logging uses raw `console.log` / `console.error`. This provides no log levels, no JSON output, no request correlation IDs, and no log routing. In production, this makes operational debugging and SIEM integration impractical.

**Fix:** replace with a structured logger such as `pino` or `winston`.

---

### 3.6 Multiple Bootstrap Fetches on Client Startup

The client makes four separate HTTP requests at startup:
- `useAuth` → `GET /api/auth/me`
- `useThemeSettings` → `GET /api/user-settings`
- `useAppSettings` → `GET /api/settings`
- `usePermissions` → `GET /api/auth/permissions`

The server already has a `GET /api/bootstrap` endpoint that returns all of this in one request. The client should use only that endpoint on startup.

---

### 3.7 No `.env.example` File

There is no `.env.example` (or `.env.template`) file in the repository. New developers have no documented list of required environment variables. Critical settings such as `SESSION_SECRET`, `CSRF_ENABLED`, and `DB_SERVER` are invisible until the app crashes or behaves unexpectedly.

---

### 3.8 No Container or Deployment Definition

There is no `Dockerfile`, `docker-compose.yml`, or deployment configuration. The only way to run the project is via the `start.py` script and manual environment setup. For any team environment, containerization is expected.

---

### 3.9 Server Has No Nodemon or Live-Reload in Development

`server/package.json` uses `node src/index.js` for both `dev` and `start`. Developers must manually restart the server after every change, which slows iteration.

**Fix:** add `nodemon` as a dev dependency and use it in the `dev` script.

---

### 3.10 `pnpm-lock.yaml` and `package-lock.json` Both Present

The repository contains both a `pnpm-lock.yaml` and a `package-lock.json` at the root, indicating mixed use of package managers. This can cause dependency resolution divergence between team members.

---

## 4. Missing Infrastructure

The following packages and patterns are absent but expected in an enterprise Node.js/React project:

| Gap | Suggested package / approach |
|---|---|
| Input schema validation (server) | `joi` or `zod` |
| Global rate limiting | `express-rate-limit` |
| Structured logging | `pino` + `pino-http` |
| Startup secrets validation | `envalid` or `dotenv-safe` |
| Client-side sanitisation | `dompurify` |
| Testing (unit + integration) | `vitest` (client), `jest` or `vitest` + `supertest` (server) |
| Database migrations | `flyway` or `db-migrate` |
| Container definition | `Dockerfile` + `docker-compose.yml` |
| CI pipeline | GitHub Actions workflow |
| API documentation | `swagger-jsdoc` + Swagger UI |

---

## 5. What Works Well — Pros

- **Password hashing** uses `scrypt` (via Node `crypto`) with good parameters (`N=32768, r=8, p=1`). This is a modern, memory-hard algorithm — far better than bcrypt alone.
- **Session signing** uses HMAC-SHA256 with `timingSafeEqual` for comparison — resistant to timing attacks.
- **Session cookies** are `HttpOnly`, `SameSite=Lax`, and `Secure` in production — correct cookie hygiene.
- **SQL parameters** — the vast majority of queries use `request.input()` parameterisation correctly. The stamgegevens issue (§2.1) is an isolated exception.
- **Microsoft SSO** is implemented correctly: state parameter, nonce, JWKS validation via `jose`, and proper claims extraction.
- **CSP in production** uses per-request nonces for inline scripts — strong protection against XSS in the built client.
- **Feature flags** are stored in the database and read at runtime, giving operators runtime control without redeployment.
- **Bootstrap endpoint** pre-renders auth state server-side into the HTML shell, avoiding a flash of unauthenticated content.
- **Permission model** is pattern-based (`/accounts*`) and stored in the database, which is flexible and operator-configurable without code changes.
- **Role separation** between `tbl_roles`, `tbl_role_permissions`, and `tbl_user_roles` is a clean, normalised design.
- **Proxy configuration** (`TRUST_PROXY`) is at least exposed as a configurable option.
- **Helmet** is included, providing a sensible baseline even if some headers need tuning.
- **Recent dependency versions** — React 19, Express 5, Vite 7, Helmet 8, jose 5. No obviously outdated packages.
- **Environment-aware behaviour** — many settings (CSP strictness, debug leaks, session cookie `Secure`) already branch on `isProduction`.
- **scrypt verification** resists brute-force even if the database is leaked.

---

## 6. Remediation Priority

### Sprint 0 — Fix Before Any Real Data Touches This System

| # | Issue | Effort |
|---|---|---|
| 1 | SQL injection — whitelist table/column names in stamgegevens functions | Small |
| 2 | Enable CSRF by default (`!== "0"` instead of `=== "1"`) | Trivial |
| 3 | Enable database encryption (`encrypt: true` for non-local) | Trivial |
| 4 | Remove or secure the unauthenticated auto-login toggle endpoint | Small |

### Sprint 1 — Security Hardening

| # | Issue | Effort |
|---|---|---|
| 5 | Validate session secret length outside production too | Trivial |
| 6 | Remove the plaintext reset token from non-production responses | Trivial |
| 7 | Reduce password reset token expiry from 24 h to 1–2 h | Trivial |
| 8 | Add rate limiting to `/register` and `/forgot-password` | Small |
| 9 | Add input length + email format validation to auth endpoints | Small |
| 10 | Remove hardcoded `EESA_SUPER_ADMIN_EMAIL`; use only DB flag | Medium |
| 11 | Fix `req.ip` usage in rate-limit check (remove raw header read) | Trivial |
| 12 | Add missing security headers (HSTS, Referrer-Policy, Permissions-Policy) | Small |

### Sprint 2 — Architecture & Operations

| # | Issue | Effort |
|---|---|---|
| 13 | Split `server/src/index.js` into route/middleware/service modules | Large |
| 14 | Add structured logging (`pino`) | Medium |
| 15 | Add `.env.example` with all variables documented | Small |
| 16 | Add audit log table and hook into sensitive operations | Medium |
| 17 | Consolidate client startup fetches to use `/api/bootstrap` only | Small |
| 18 | Add testing infrastructure (`vitest` + `supertest`) | Large |

### Backlog — Nice to Have

| # | Issue | Effort |
|---|---|---|
| 19 | Add API versioning (`/api/v1/…`) | Medium |
| 20 | Add `Dockerfile` + `docker-compose.yml` | Medium |
| 21 | Add CI pipeline (GitHub Actions) | Medium |
| 22 | Add input schema validation library (`zod`) | Medium |
| 23 | Add API documentation (OpenAPI / Swagger) | Large |
| 24 | Resolve mixed lock-file situation (choose pnpm or npm) | Small |
| 25 | Add `nodemon` for server dev loop | Trivial |

---

## 7. Enterprise Readiness Verdict

| Dimension | Score | Comment |
|---|---|---|
| Authentication | 6/10 | Solid password hashing and session design; no MFA; auto-login backdoor is a blocker |
| Authorisation | 5/10 | Pattern-based RBAC is good; dual authority paths and no audit log are risks |
| Input validation | 3/10 | Most fields unchecked; SQL injection present in stamgegevens |
| Transport security | 4/10 | HTTPS-ready in production; DB encryption disabled; CSRF off by default |
| Logging & observability | 2/10 | Raw console output only; no correlation IDs; no audit trail |
| Testability | 1/10 | No tests, no test runner |
| Deployability | 3/10 | No container, no CI, no migration runner |
| Dependency hygiene | 8/10 | All packages current; no known critical CVEs |
| Code organisation | 4/10 | Monolithic server file; no API versioning |
| Frontend architecture | 7/10 | React 19, clean hooks pattern, bootstrap approach is good |

**Overall: Not enterprise-ready in its current form.**

The frontend and parts of the authentication system are well-implemented and form a solid starting point. However, the SQL injection vulnerability, disabled CSRF, unencrypted database connection, and missing test/CI infrastructure are blockers for any production use with real user data. The code quality issues (monolithic file, no logging, no audit trail) would also present significant operational and compliance challenges at enterprise scale.

With the Sprint 0 and Sprint 1 items addressed this becomes a competent, secure foundation. Adding tests, structured logging, and a deployment pipeline would bring it to a genuine enterprise baseline.
