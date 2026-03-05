function registerCsrfProtection({ app, config, readCookie, csrfCookieName }) {
  if (!config.csrfEnabled) return;

  app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();
    if (req.path.startsWith("/api/auth/login") || req.path.startsWith("/api/auth/register") ||
        req.path.startsWith("/api/auth/forgot-password") || req.path.startsWith("/api/auth/reset-password")) {
      return next();
    }
    const cookieToken = readCookie(req, csrfCookieName);
    const headerToken = req.headers["x-csrf-token"];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ error: "CSRF token mismatch." });
    }
    return next();
  });
}

module.exports = { registerCsrfProtection };
