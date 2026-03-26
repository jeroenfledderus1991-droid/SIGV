#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STRICT_DB_READS = process.argv.includes("--strict-db-reads");
const ENFORCE = process.argv.includes("--enforce");
const SIZE_LIMIT = 500;
const BLOCKER_LIMIT = 700;
const DB_READ_ALLOWLIST = new Set([
  "tbl_users",
  "tbl_auth_attempts",
  "tbl_user_settings",
  "tbl_roles",
  "tbl_feature_flags",
]);
const DEAD_ROUTE_ALLOWLIST = new Set([
  "POST /api/feature-flags/update",
  "GET /api/secure/profile",
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function walk(dir, filterFn, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, filterFn, files);
      continue;
    }
    if (filterFn(full)) files.push(full);
  }
  return files;
}

function countLines(file) {
  const txt = fs.readFileSync(file, "utf8");
  if (!txt) return 0;
  return txt.split(/\r?\n/).length;
}

function checkFileSizes() {
  const clientFiles = walk(path.join(ROOT, "client", "src"), (f) => {
    const n = toPosix(f);
    if (n.includes("/vendor/")) return false;
    return /\.(js|jsx|ts|tsx|css)$/i.test(n);
  });
  const serverFiles = walk(path.join(ROOT, "server", "src"), (f) => /\.(js|ts)$/i.test(f));
  const dotnetFiles = walk(path.join(ROOT, "dotnet", "TemplateApi"), (f) => {
    const n = toPosix(f);
    if (n.includes("/bin/") || n.includes("/obj/")) return false;
    return /\.(cs|csproj|json)$/i.test(n);
  });

  const offenders = [];
  const blockers = [];
  for (const file of [...clientFiles, ...serverFiles, ...dotnetFiles]) {
    const lines = countLines(file);
    if (lines > SIZE_LIMIT) offenders.push({ file, lines });
    if (lines > BLOCKER_LIMIT) blockers.push({ file, lines });
  }
  return { offenders, blockers };
}

function checkClientNetworkAccess() {
  const files = walk(path.join(ROOT, "client", "src"), (f) => /\.(js|jsx|ts|tsx)$/i.test(f));
  const violations = [];
  for (const file of files) {
    const rel = toPosix(path.relative(ROOT, file));
    if (rel === "client/src/api.js") continue;
    if (rel.includes("/vendor/")) continue;
    const txt = fs.readFileSync(file, "utf8");
    if (/\bfetch\s*\(/.test(txt) || /\baxios\b/.test(txt) || /\bXMLHttpRequest\b/.test(txt)) {
      violations.push(rel);
    }
  }
  return violations;
}

function checkClientApiCsrfContract() {
  const apiFile = path.join(ROOT, "client", "src", "api.js");
  const warnings = [];
  if (!fs.existsSync(apiFile)) {
    warnings.push("client/src/api.js ontbreekt.");
    return warnings;
  }
  const txt = fs.readFileSync(apiFile, "utf8");
  if (!/X-CSRF-Token/i.test(txt)) {
    warnings.push("client/src/api.js: mist X-CSRF-Token header usage.");
  }
  if (!/csrf_token/i.test(txt)) {
    warnings.push("client/src/api.js: mist csrf_token cookie usage.");
  }
  if (!/\b(fetch|Request)\b/.test(txt)) {
    warnings.push("client/src/api.js: verwacht centrale fetch-wrapper, maar geen fetch usage gevonden.");
  }
  return warnings;
}

function extractQueryStrings(text) {
  const values = [];
  const patterns = [
    /query\(\s*`([\s\S]*?)`\s*\)/g,
    /query\(\s*"([\s\S]*?)"\s*\)/g,
    /query\(\s*'([\s\S]*?)'\s*\)/g,
  ];
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(text))) {
      values.push(m[1]);
    }
  }
  return values;
}

function checkDbViewTableConventions() {
  const scanRoots = [
    path.join(ROOT, "server", "src", "routes"),
    path.join(ROOT, "server", "src", "services"),
  ];
  const files = [];
  for (const root of scanRoots) {
    walk(root, (f) => /\.(js|ts)$/i.test(f), files);
  }

  const hardViolations = [];
  const softViolations = [];
  for (const file of files) {
    const rel = toPosix(path.relative(ROOT, file));
    const txt = fs.readFileSync(file, "utf8");
    const queries = extractQueryStrings(txt);
    for (const sqlRaw of queries) {
      const sql = sqlRaw.replace(/\s+/g, " ").trim();
      if (/INSERT\s+INTO\s+dbo\.vw_/i.test(sql) || /UPDATE\s+dbo\.vw_/i.test(sql) || /DELETE\s+FROM\s+dbo\.vw_/i.test(sql)) {
        hardViolations.push({ file: rel, sql });
      }
      // Soft signal: only flag direct SELECT statements reading from tbl_*.
      // Ignore IF EXISTS / mixed IF...SELECT fallback blocks and allowlisted system/auth tables.
      if (/^\s*SELECT\b/i.test(sql) && /\bFROM\s+dbo\.tbl_([a-zA-Z0-9_]+)/i.test(sql)) {
        const tableMatches = [...sql.matchAll(/\bFROM\s+dbo\.(tbl_[a-zA-Z0-9_]+)/gi)].map((m) => m[1].toLowerCase());
        const disallowedTables = tableMatches.filter((t) => !DB_READ_ALLOWLIST.has(t));
        if (disallowedTables.length > 0) {
          softViolations.push({ file: rel, sql, tables: [...new Set(disallowedTables)] });
        }
      }
    }
  }
  return { hardViolations, softViolations };
}

function getNavItemsAndRoutes(appJsPath) {
  if (!fs.existsSync(appJsPath)) {
    return { navItems: [], routePaths: [] };
  }
  const txt = fs.readFileSync(appJsPath, "utf8");
  const navItems = [];
  const routePaths = [];

  const navBlockMatch = txt.match(/const\s+navItems\s*=\s*\[([\s\S]*?)\];/);
  if (navBlockMatch) {
    const navBlock = navBlockMatch[1];
    const itemRe = /\{\s*to:\s*"([^"]+)"[\s\S]*?permissions:\s*\[([^\]]*)\]/g;
    let m;
    while ((m = itemRe.exec(navBlock))) {
      const to = m[1];
      const permsRaw = m[2] || "";
      const perms = [...permsRaw.matchAll(/"([^"]+)"/g)].map((p) => p[1]);
      navItems.push({ to, permissions: perms });
    }
  }

  const routeRe = /<Route\s+path="([^"]+)"/g;
  let r;
  while ((r = routeRe.exec(txt))) {
    routePaths.push(r[1]);
  }

  return { navItems, routePaths };
}

function getPagePatterns(serverIndexPath) {
  if (!fs.existsSync(serverIndexPath)) return [];
  const txt = fs.readFileSync(serverIndexPath, "utf8");
  const patterns = [...txt.matchAll(/pattern:\s*"([^"]+)"/g)].map((m) => m[1]);
  return patterns;
}

function checkRouteNavPatternConsistency() {
  const appJsPath = path.join(ROOT, "client", "src", "App.jsx");
  const serverIndexPath = path.join(ROOT, "server", "src", "index.js");
  const { navItems, routePaths } = getNavItemsAndRoutes(appJsPath);
  const pagePatterns = getPagePatterns(serverIndexPath);

  const warnings = [];
  const patternSet = new Set(pagePatterns);
  const routeSet = new Set(routePaths);

  for (const item of navItems) {
    if (!routeSet.has(item.to)) {
      warnings.push(
        `client/src/App.jsx: nav item '${item.to}' has no matching <Route path="${item.to}">`
      );
    }
    for (const p of item.permissions) {
      if (!patternSet.has(p)) {
        warnings.push(
          `client/src/App.jsx + server/src/index.js: nav permission '${p}' missing in PAGE_PATTERNS`
        );
      }
    }
  }

  return warnings;
}

function expectedPatternForPath(routePath) {
  if (routePath === "/") return "/home*";
  if (!routePath || !routePath.startsWith("/")) return null;
  return `${routePath}*`;
}

function checkPermissionDrift() {
  const appJsPath = path.join(ROOT, "client", "src", "App.jsx");
  const serverIndexPath = path.join(ROOT, "server", "src", "index.js");
  const { navItems, routePaths } = getNavItemsAndRoutes(appJsPath);
  const pagePatterns = getPagePatterns(serverIndexPath);
  const warnings = [];

  const authRoutes = new Set([
    "/login",
    "/signin-oidc",
    "/register",
    "/wachtwoord-vergeten",
    "/reset-password",
  ]);
  const clientExpectedPatterns = new Set();

  for (const routePath of routePaths) {
    if (routePath.includes("*") || routePath.includes(":")) continue;
    if (authRoutes.has(routePath)) continue;
    const expected = expectedPatternForPath(routePath);
    if (expected) clientExpectedPatterns.add(expected);
  }
  for (const item of navItems) {
    const expected = expectedPatternForPath(item.to);
    if (!expected) continue;
    if (!item.permissions.length) {
      warnings.push(`client/src/App.jsx: nav item '${item.to}' mist permissions[]`);
      continue;
    }
    if (!item.permissions.includes(expected)) {
      warnings.push(
        `client/src/App.jsx: nav item '${item.to}' verwacht permission '${expected}', gevonden: ${item.permissions.join(", ")}`
      );
    }
  }

  const serverPatternSet = new Set(pagePatterns);
  for (const expected of clientExpectedPatterns) {
    if (!serverPatternSet.has(expected)) {
      warnings.push(
        `client/src/App.jsx + server/src/index.js: route/pattern drift, '${expected}' ontbreekt in PAGE_PATTERNS`
      );
    }
  }
  for (const pattern of serverPatternSet) {
    if (!clientExpectedPatterns.has(pattern)) {
      warnings.push(
        `server/src/index.js + client/src/App.jsx: PAGE_PATTERNS bevat '${pattern}' zonder corresponderende client route`
      );
    }
  }

  return warnings;
}

function extractServerApiRoutes() {
  const roots = [
    path.join(ROOT, "server", "src", "index.js"),
    path.join(ROOT, "server", "src", "routes"),
  ];
  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stat = fs.statSync(root);
    if (stat.isDirectory()) {
      walk(root, (f) => /\.(js|ts)$/i.test(f), files);
    } else if (stat.isFile()) {
      files.push(root);
    }
  }

  const routes = [];
  const regex = /app\.(get|post|put|delete)\("([^"]+)"/g;
  for (const file of files) {
    const rel = toPosix(path.relative(ROOT, file));
    const txt = fs.readFileSync(file, "utf8");
    let m;
    while ((m = regex.exec(txt))) {
      const method = m[1].toUpperCase();
      const routePath = m[2];
      if (!routePath.startsWith("/api/")) continue;
      routes.push({ file: rel, method, path: routePath });
    }
  }
  return routes;
}

function extractClientApiPathUsage() {
  const files = walk(path.join(ROOT, "client", "src"), (f) => /\.(js|jsx|ts|tsx)$/i.test(f));
  const exact = new Set();
  const dynamic = [];
  const directApiRx = /\/api\/[a-zA-Z0-9/_:-]*/g;
  const helperRx = /\b(getJson|postJson|putJson|deleteJson)\(\s*["'`]([^"'`]+)["'`]/g;

  for (const file of files) {
    const txt = fs.readFileSync(file, "utf8");
    const directMatches = txt.match(directApiRx) || [];
    for (const m of directMatches) {
      exact.add(m.replace(/\/+$/, ""));
    }
    let helperMatch;
    while ((helperMatch = helperRx.exec(txt))) {
      const pathCandidate = helperMatch[2].trim();
      if (!pathCandidate || !pathCandidate.startsWith("/")) continue;
      const normalized = pathCandidate.startsWith("/api/")
        ? pathCandidate
        : `/api${pathCandidate}`;
      const clean = normalized.replace(/\/+$/, "");
      if (clean.includes("${")) {
        const wildcarded = clean.replace(/\$\{[^}]+\}/g, "__SEG__");
        const escaped = wildcarded
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/__SEG__/g, "[^/]+");
        dynamic.push(new RegExp(`^${escaped}$`));
        continue;
      }
      exact.add(clean);
    }
  }
  return { exact, dynamic };
}

function isServerOnlyRoute(routePath) {
  return (
    routePath.startsWith("/api/db/") ||
    routePath.startsWith("/api/health") ||
    routePath.startsWith("/api/auth/microsoft/") ||
    routePath.startsWith("/api/auth/reset-password")
  );
}

function checkDeadApiRoutes() {
  const serverRoutes = extractServerApiRoutes();
  const clientUsage = extractClientApiPathUsage();
  const warnings = [];
  for (const route of serverRoutes) {
    const routeKey = `${route.method} ${route.path}`;
    if (DEAD_ROUTE_ALLOWLIST.has(routeKey)) continue;
    if (route.path.includes("*") || route.path.includes(":")) continue;
    if (isServerOnlyRoute(route.path)) continue;
    const matchedDynamically = clientUsage.dynamic.some((rx) => rx.test(route.path));
    if (!clientUsage.exact.has(route.path) && !matchedDynamically) {
      warnings.push(`${route.file}: ${route.method} ${route.path} lijkt ongebruikt in client/src`);
    }
  }
  return warnings;
}

function checkSqlStringConcatenationSafety() {
  const scanRoots = [
    path.join(ROOT, "server", "src", "routes"),
    path.join(ROOT, "server", "src", "services"),
  ];
  const files = [];
  for (const root of scanRoots) {
    walk(root, (f) => /\.(js|ts)$/i.test(f), files);
  }
  const warnings = [];

  for (const file of files) {
    const rel = toPosix(path.relative(ROOT, file));
    const txt = fs.readFileSync(file, "utf8");
    const lines = txt.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      const normalized = line.replace(/\s+/g, " ");
      if (/query\s*\(\s*`[^`]*\$\{/.test(normalized)) {
        warnings.push(`${rel}:${lineNo} query template literal interpolation (\${...}) gedetecteerd`);
      }
      if (/query\s*\([^)]*\+[^)]*\)/.test(normalized)) {
        warnings.push(`${rel}:${lineNo} query string concatenatie (+) gedetecteerd`);
      }
    });
  }
  return warnings;
}

function checkApiEndpointIntegrity() {
  const scanRoots = [
    path.join(ROOT, "server", "src", "index.js"),
    path.join(ROOT, "server", "src", "routes"),
  ];
  const files = [];
  for (const root of scanRoots) {
    if (!fs.existsSync(root)) continue;
    const stat = fs.statSync(root);
    if (stat.isDirectory()) {
      walk(root, (f) => /\.(js|ts)$/i.test(f), files);
    } else if (stat.isFile()) {
      files.push(root);
    }
  }

  const warnings = [];
  const routeOwners = new Map();
  const publicExact = new Set([
    "/api/health",
    "/api/bootstrap",
    "/api/settings",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/logout",
  ]);
  const publicPrefixes = ["/api/auth/microsoft/"];
  const mustAuthPrefixes = [
    "/api/accounts",
    "/api/roles",
    "/api/stamgegevens",
    "/api/feature-flags",
    "/api/user-settings",
    "/api/profile",
    "/api/system-errors",
    "/api/db/",
    "/api/auth/me",
    "/api/auth/permissions",
  ];
  const mustPermissionPrefixes = ["/api/accounts", "/api/roles", "/api/stamgegevens", "/api/feature-flags", "/api/db/"];

  for (const file of files) {
    const rel = toPosix(path.relative(ROOT, file));
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, idx) => {
      const m = line.match(/app\.(get|post|put|delete)\("([^"]+)"/);
      if (!m) return;
      const method = m[1].toUpperCase();
      const routePath = m[2];
      if (!routePath.startsWith("/api/")) return;

      const routeKey = `${method} ${routePath}`;
      const owner = `${rel}:${idx + 1}`;
      if (routeOwners.has(routeKey)) {
        warnings.push(`${owner}: duplicate API route detected (${routeKey}), first seen at ${routeOwners.get(routeKey)}`);
      } else {
        routeOwners.set(routeKey, owner);
      }

      if (/\s/.test(routePath)) {
        warnings.push(`${owner}: API route contains whitespace (${routePath})`);
      }

      const hasRequireAuth = line.includes("requireAuth");
      const hasRequirePermission = line.includes("requirePermission(");
      const isPublic = publicExact.has(routePath) || publicPrefixes.some((prefix) => routePath.startsWith(prefix));

      if (!isPublic && mustAuthPrefixes.some((prefix) => routePath.startsWith(prefix)) && !hasRequireAuth) {
        warnings.push(`${owner}: ${routePath} is missing requireAuth`);
      }
      if (mustPermissionPrefixes.some((prefix) => routePath.startsWith(prefix)) && !hasRequirePermission) {
        warnings.push(`${owner}: ${routePath} is missing requirePermission(...)`);
      }
      if (hasRequirePermission && !hasRequireAuth) {
        warnings.push(`${owner}: ${routePath} uses requirePermission without requireAuth`);
      }
    });
  }

  return warnings;
}

function checkCssHubStructure() {
  const warnings = [];
  const domains = ["client-table", "sidebar", "theme-override"];
  for (const domain of domains) {
    const hub = path.join(ROOT, "client", "src", "styles", `${domain}.css`);
    const folder = path.join(ROOT, "client", "src", "styles", domain);
    const hubRel = toPosix(path.relative(ROOT, hub));

    if (!fs.existsSync(hub)) {
      warnings.push(`${hubRel}: ontbreekt (verwacht import hub).`);
      continue;
    }
    if (!fs.existsSync(folder)) {
      warnings.push(`${hubRel}: map client/src/styles/${domain}/ ontbreekt.`);
      continue;
    }

    const filesInFolder = walk(folder, (f) => /\.css$/i.test(f));
    if (!filesInFolder.length) {
      warnings.push(`${hubRel}: map ${toPosix(path.relative(ROOT, folder))} bevat geen CSS files.`);
    }

    const lines = fs.readFileSync(hub, "utf8").split(/\r?\n/);
    const importTargets = [];
    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      if (!line || line.startsWith("/*") || line.startsWith("*") || line.startsWith("*/")) continue;
      const m = line.match(/^@import\s+"([^"]+)";$/);
      if (m) {
        importTargets.push(m[1]);
        continue;
      }
      warnings.push(`${hubRel}: alleen comments/blank/@import toegestaan, gevonden: '${line.slice(0, 80)}'`);
    }

    for (const target of importTargets) {
      const resolved = path.resolve(path.dirname(hub), target);
      if (!fs.existsSync(resolved)) {
        warnings.push(`${hubRel}: import target bestaat niet: ${target}`);
      }
      if (!toPosix(resolved).includes(`/styles/${domain}/`)) {
        warnings.push(`${hubRel}: import target buiten domeinmap: ${target}`);
      }
    }
  }
  return warnings;
}

function checkEntryFileDiscipline() {
  const warnings = [];
  const serverIndex = path.join(ROOT, "server", "src", "index.js");
  const clientApp = path.join(ROOT, "client", "src", "App.jsx");

  if (fs.existsSync(serverIndex)) {
    const txt = fs.readFileSync(serverIndex, "utf8");
    const lines = countLines(serverIndex);
    if (lines > SIZE_LIMIT) {
      warnings.push(`server/src/index.js: ${lines}/${SIZE_LIMIT} (entry file too large).`);
    }
    const apiRouteDefs = [...txt.matchAll(/app\.(get|post|put|delete)\("\/api\//g)];
    if (apiRouteDefs.length) {
      warnings.push("server/src/index.js: bevat directe /api route-definities; verwacht route modules.");
    }
    if (/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(txt) && /query\(/i.test(txt)) {
      warnings.push("server/src/index.js: bevat query/SQL logica; verwacht service/route modules.");
    }
  }

  if (fs.existsSync(clientApp)) {
    const txt = fs.readFileSync(clientApp, "utf8");
    const lines = countLines(clientApp);
    if (lines > SIZE_LIMIT) {
      warnings.push(`client/src/App.jsx: ${lines}/${SIZE_LIMIT} (entry file too large).`);
    }
    if (/\bfetch\s*\(|\baxios\b|\bXMLHttpRequest\b/.test(txt)) {
      warnings.push("client/src/App.jsx: directe network calls gevonden; gebruik hooks/api helpers.");
    }
  }
  return warnings;
}

function printSection(title) {
  console.log(`\n== ${title} ==`);
}

function main() {
  let hasError = false;

  const size = checkFileSizes();
  printSection("File Size");
  if (!size.offenders.length) {
    console.log("OK: no files above 500 lines.");
  } else {
    console.log(`Found ${size.offenders.length} file(s) above 500 lines:`);
    for (const row of size.offenders.sort((a, b) => b.lines - a.lines)) {
      console.log(`- ${toPosix(path.relative(ROOT, row.file))} (${row.lines}/${SIZE_LIMIT})`);
    }
    if (ENFORCE) hasError = true;
  }
  if (size.blockers.length) {
    console.log(`HIGH WARNING: ${size.blockers.length} file(s) above 700 lines:`);
    for (const row of size.blockers.sort((a, b) => b.lines - a.lines)) {
      console.log(`- ${toPosix(path.relative(ROOT, row.file))} (${row.lines}/${BLOCKER_LIMIT})`);
    }
  }

  const clientNet = checkClientNetworkAccess();
  printSection("Client Network Access");
  if (!clientNet.length) {
    console.log("OK: no fetch/axios/XMLHttpRequest usage outside client/src/api.js.");
  } else {
    console.log("WARNING: Found disallowed network calls outside client/src/api.js:");
    for (const rel of clientNet) console.log(`- ${rel}`);
    if (ENFORCE) hasError = true;
  }

  const apiCsrfWarnings = checkClientApiCsrfContract();
  printSection("Client API CSRF Contract");
  if (!apiCsrfWarnings.length) {
    console.log("OK: client/src/api.js bevat CSRF contract signalen.");
  } else {
    console.log("WARNING: mogelijke CSRF-contract issues in client API layer:");
    for (const w of apiCsrfWarnings) console.log(`- ${w}`);
    if (ENFORCE) hasError = true;
  }

  const dbRules = checkDbViewTableConventions();
  printSection("DB View/Table Conventions");
  if (!dbRules.hardViolations.length) {
    console.log("OK: no writes to vw_* detected.");
  } else {
    console.log("CRITICAL WARNING: writes to vw_* detected:");
    for (const v of dbRules.hardViolations) {
      console.log(`- ${v.file}: ${v.sql.slice(0, 180)}...`);
    }
    if (ENFORCE) hasError = true;
  }
  if (!dbRules.softViolations.length) {
    console.log("OK: no SELECT FROM tbl_* detected.");
  } else {
    const header = STRICT_DB_READS
      ? "HIGH WARNING (strict signal): SELECT FROM tbl_* detected:"
      : "Warning: SELECT FROM tbl_* detected (run --strict-db-reads for stronger signal):";
    console.log(header);
    for (const v of dbRules.softViolations) {
      const tblInfo = v.tables?.length ? ` [tables: ${v.tables.join(", ")}]` : "";
      console.log(`- ${v.file}${tblInfo}: ${v.sql.slice(0, 180)}...`);
    }
    if (STRICT_DB_READS && ENFORCE) hasError = true;
  }

  const routeNavWarnings = checkRouteNavPatternConsistency();
  printSection("Route/Nav/PAGE_PATTERNS Consistency");
  if (!routeNavWarnings.length) {
    console.log("OK: route, navItems, and PAGE_PATTERNS appear consistent.");
  } else {
    console.log("WARNING: route/nav/pattern consistency issues:");
    for (const w of routeNavWarnings) console.log(`- ${w}`);
    if (ENFORCE) hasError = true;
  }

  const permissionDriftWarnings = checkPermissionDrift();
  printSection("Permission Drift");
  if (!permissionDriftWarnings.length) {
    console.log("OK: permissions in nav/routes and PAGE_PATTERNS are aligned.");
  } else {
    console.log("WARNING: permission drift issues:");
    for (const w of permissionDriftWarnings) console.log(`- ${w}`);
    if (ENFORCE) hasError = true;
  }

  const deadApiWarnings = checkDeadApiRoutes();
  printSection("Dead API Routes");
  if (!deadApiWarnings.length) {
    console.log("OK: no obvious server API routes without client usage.");
  } else {
    console.log("WARNING: potential dead/unreferenced API routes:");
    for (const w of deadApiWarnings) console.log(`- ${w}`);
    if (ENFORCE) hasError = true;
  }

  const sqlConcatWarnings = checkSqlStringConcatenationSafety();
  printSection("SQL Concatenation Safety");
  if (!sqlConcatWarnings.length) {
    console.log("OK: no obvious SQL string concatenation in query(...) calls.");
  } else {
    console.log("WARNING: possible SQL string concatenation risks:");
    for (const w of sqlConcatWarnings) console.log(`- ${w}`);
    if (ENFORCE) hasError = true;
  }

  const apiEndpointWarnings = checkApiEndpointIntegrity();
  printSection("API Endpoint Integrity");
  if (!apiEndpointWarnings.length) {
    console.log("OK: endpoint auth/permission/duplicate checks passed.");
  } else {
    console.log("WARNING: potential API endpoint integrity issues:");
    for (const w of apiEndpointWarnings) console.log(`- ${w}`);
    if (ENFORCE) hasError = true;
  }

  const cssHubWarnings = checkCssHubStructure();
  printSection("CSS Hub Structure");
  if (!cssHubWarnings.length) {
    console.log("OK: CSS domain hubs and folder structure are consistent.");
  } else {
    console.log("WARNING: CSS hub structure issues:");
    for (const w of cssHubWarnings) console.log(`- ${w}`);
    if (ENFORCE) hasError = true;
  }

  const entryWarnings = checkEntryFileDiscipline();
  printSection("Entry File Discipline");
  if (!entryWarnings.length) {
    console.log("OK: entry files look orchestration-only.");
  } else {
    console.log("WARNING: entry file discipline issues:");
    for (const w of entryWarnings) console.log(`- ${w}`);
    if (ENFORCE) hasError = true;
  }

  if (hasError) {
    console.error("\nGuardrails failed (enforced mode).");
    process.exit(1);
  }
  console.log(ENFORCE ? "\nGuardrails passed (enforced mode)." : "\nGuardrails completed (signal mode).");
}

main();
