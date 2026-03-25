const crypto = require("crypto");
const config = require("./config");
const db = require("./db");

const SESSION_COOKIE = config.sessionCookieName;
const SESSION_TTL_HOURS = config.sessionDurationHours;
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SCRYPT_KEYLEN = 64;

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

function signSessionId(sessionId) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(sessionId)
    .digest("base64url");
}

function createSignedSession(sessionId) {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

function verifySignedSession(signedValue) {
  if (!signedValue || !signedValue.includes(".")) return null;
  const [sessionId, signature] = signedValue.split(".");
  if (!sessionId || !signature) return null;
  const expected = signSessionId(sessionId);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) return null;
  return sessionId;
}

function parseScryptHash(stored) {
  if (!stored || !stored.startsWith("scrypt:")) return null;
  const parts = stored.split("$");
  if (parts.length < 3) return null;
  const [prefix, salt, hashHex] = parts;
  if (!prefix || !salt || !hashHex) return null;
  const params = prefix.replace("scrypt:", "").split(":").map(Number);
  if (params.length !== 3) return null;
  const [N, r, p] = params;
  return { N, r, p, salt, hashHex };
}

function createScryptHash(password) {
  const salt = crypto.randomBytes(16).toString("base64");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}$${salt}$${hash.toString("hex")}`;
}

function verifyScryptHash(password, stored) {
  const parsed = parseScryptHash(stored);
  if (!parsed) return false;
  const hash = crypto.scryptSync(password, parsed.salt, SCRYPT_KEYLEN, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });
  const storedBuf = Buffer.from(parsed.hashHex, "hex");
  if (storedBuf.length !== hash.length) return false;
  return crypto.timingSafeEqual(storedBuf, hash);
}

function buildSessionCookieOptions() {
  const secure = config.env.toLowerCase() === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

async function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const signed = cookies[SESSION_COOKIE];
  const sessionId = verifySignedSession(signed);
  if (!sessionId) return null;

  const pool = await db.getPool();
  const request = pool.request();
  request.input("session_id", sessionId);
  const result = await request.query(`
    SELECT u.user_id,
           u.username,
           u.email,
           u.voornaam,
           u.achternaam,
           r.role_naam AS role,
           u.is_super_admin,
           s.login_time,
           s.last_seen
    FROM dbo.tbl_active_sessions s
    JOIN dbo.tbl_users u ON u.user_id = s.user_id
    OUTER APPLY (
      SELECT TOP 1 ur.role_naam, ur.role_volgorde
      FROM dbo.vw_user_roles ur
      WHERE ur.user_id = u.user_id
      ORDER BY ur.role_volgorde
    ) r
    WHERE s.session_id = @session_id
  `);
  const user = result.recordset[0];
  if (!user) return null;

  const lastSeen = user.last_seen || user.login_time;
  if (lastSeen) {
    const expiry = Date.now() - SESSION_TTL_HOURS * 60 * 60 * 1000;
    if (new Date(lastSeen).getTime() < expiry) {
      await clearSession(sessionId);
      return null;
    }
  }

  const update = pool.request();
  update.input("session_id", sessionId);
  await update.query("UPDATE dbo.tbl_active_sessions SET last_seen = SYSDATETIME() WHERE session_id = @session_id");

  return { sessionId, user };
}

async function createSessionForUser(userId) {
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const pool = await db.getPool();
  const request = pool.request();
  request.input("user_id", userId);
  request.input("session_id", sessionId);
  await request.query(`
    INSERT INTO dbo.tbl_active_sessions (user_id, session_id)
    VALUES (@user_id, @session_id)
  `);
  return sessionId;
}

async function clearSession(sessionId) {
  if (!sessionId) return;
  const pool = await db.getPool();
  const request = pool.request();
  request.input("session_id", sessionId);
  await request.query("DELETE FROM dbo.tbl_active_sessions WHERE session_id = @session_id");
}

module.exports = {
  SESSION_COOKIE,
  buildSessionCookieOptions,
  createSignedSession,
  verifyScryptHash,
  createScryptHash,
  getSessionUser,
  createSessionForUser,
  clearSession,
};
