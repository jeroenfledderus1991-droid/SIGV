const { createRemoteJWKSet, jwtVerify } = require("jose");
const config = require("./config");

const tenantId = config.microsoft.tenantId;
const clientId = config.microsoft.clientId;
const lowerTenant = tenantId ? tenantId.toLowerCase() : "";
const validateIssuer = tenantId && !["common", "organizations", "consumers"].includes(lowerTenant);
const issuer = tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : "";
const jwksUrl = issuer ? new URL(`${issuer}/discovery/v2.0/keys`) : null;
const jwks = jwksUrl ? createRemoteJWKSet(jwksUrl) : null;

async function verifyMicrosoftToken(token) {
  if (!clientId || !tenantId) {
    const error = new Error("Microsoft auth is not configured.");
    error.status = 501;
    throw error;
  }

  if (!jwks) {
    const error = new Error("Microsoft JWKS URL is not configured.");
    error.status = 500;
    throw error;
  }

  const options = {
    audience: clientId,
  };

  if (validateIssuer) {
    options.issuer = issuer;
  }

  const { payload } = await jwtVerify(token, jwks, options);
  return payload;
}

function requireMicrosoftAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  verifyMicrosoftToken(token)
    .then((payload) => {
      req.user = payload;
      next();
    })
    .catch((err) => {
      const status = err.status || 401;
      res.status(status).json({ error: err.message || "Unauthorized" });
    });
}

module.exports = {
  requireMicrosoftAuth,
  verifyMicrosoftToken,
};
