function createAuthFlowHelpers({
  crypto,
  config,
  isProduction,
  csrfCookieName,
  microsoftAuthCookiePath,
  microsoftAuthStateTtlMs,
  microsoftStateCookieName,
  microsoftRedirectCookieName,
}) {
  function readCookie(req, name) {
    const cookieHeader = req.headers.cookie || "";
    const cookies = cookieHeader.split(";").reduce((acc, part) => {
      const [rawKey, ...rest] = part.trim().split("=");
      if (!rawKey) return acc;
      acc[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join("=") || "");
      return acc;
    }, {});
    return cookies[name];
  }

  function setCsrfCookie(res, token) {
    const secure = isProduction;
    res.cookie(csrfCookieName, token, {
      httpOnly: false,
      sameSite: "lax",
      secure,
      path: "/",
    });
  }

  function setMicrosoftAuthCookie(res, name, value) {
    const secure = isProduction;
    res.cookie(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: microsoftAuthCookiePath,
      maxAge: microsoftAuthStateTtlMs,
    });
  }

  function clearMicrosoftAuthCookies(res) {
    const secure = isProduction;
    const options = {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: microsoftAuthCookiePath,
    };
    res.clearCookie(microsoftStateCookieName, options);
    res.clearCookie(microsoftRedirectCookieName, options);
  }

  function resolveAppBaseUrl(req) {
    const configuredOrigin = process.env.VITE_APP_ORIGIN || process.env.VITE_ORIGIN || config.corsOrigin || "";
    if (configuredOrigin) {
      try {
        return new URL(configuredOrigin).toString();
      } catch {}
    }
    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http")
      .toString()
      .split(",")[0]
      .trim();
    const host = (req.headers["x-forwarded-host"] || req.get("host") || "").toString().split(",")[0].trim();
    if (!host) return "http://localhost:5173";
    return `${proto}://${host}`;
  }

  function buildAppRedirectUrl(req, pathname, searchParams) {
    const base = resolveAppBaseUrl(req);
    const target = new URL(pathname, base);
    if (searchParams && typeof searchParams === "object") {
      for (const [key, value] of Object.entries(searchParams)) {
        if (value === undefined || value === null || value === "") continue;
        target.searchParams.set(key, String(value));
      }
    }
    return target.toString();
  }

  function resolveMicrosoftRedirectUri(req) {
    if (config.microsoft.redirectUri) return config.microsoft.redirectUri;
    return buildAppRedirectUrl(req, "/api/auth/microsoft/callback");
  }

  function buildMicrosoftAuthorizeUrl(req) {
    const state = crypto.randomBytes(24).toString("base64url");
    const redirectUri = resolveMicrosoftRedirectUri(req);
    const authorizeUrl = new URL(
      `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/authorize`
    );
    authorizeUrl.searchParams.set("client_id", config.microsoft.clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_mode", "query");
    authorizeUrl.searchParams.set("scope", "openid profile email");
    authorizeUrl.searchParams.set("prompt", "select_account");
    authorizeUrl.searchParams.set("state", state);
    return { state, redirectUri, authorizeUrl: authorizeUrl.toString() };
  }

  async function exchangeMicrosoftCodeForToken(code, redirectUri) {
    const tokenUrl = `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: config.microsoft.clientId,
      client_secret: config.microsoft.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const description =
        payload.error_description || payload.error || `HTTP ${response.status}`;
      throw new Error(`Microsoft token exchange failed: ${description}`);
    }
    return payload;
  }

  function getMicrosoftAccountEmail(payload) {
    if (!payload || typeof payload !== "object") return "";
    const email =
      payload.email || payload.preferred_username || payload.upn || payload.unique_name || "";
    return String(email || "").trim().toLowerCase();
  }

  return {
    readCookie,
    setCsrfCookie,
    setMicrosoftAuthCookie,
    clearMicrosoftAuthCookies,
    buildAppRedirectUrl,
    resolveMicrosoftRedirectUri,
    buildMicrosoftAuthorizeUrl,
    exchangeMicrosoftCodeForToken,
    getMicrosoftAccountEmail,
  };
}

module.exports = { createAuthFlowHelpers };
