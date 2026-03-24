function extractMessage(responseBody, statusCode) {
  if (!responseBody) return `HTTP ${statusCode}`;
  if (typeof responseBody === "string") return responseBody.slice(0, 1024);
  if (typeof responseBody === "object") {
    if (typeof responseBody.error === "string") return responseBody.error.slice(0, 1024);
    if (typeof responseBody.message === "string") return responseBody.message.slice(0, 1024);
  }
  return `HTTP ${statusCode}`;
}

function createErrorAuditCaptureMiddleware({ systemErrorAudit }) {
  return (req, res, next) => {
    let responseBody;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    res.send = (body) => {
      if (responseBody === undefined) responseBody = body;
      return originalSend(body);
    };

    res.on("finish", () => {
      if (res.statusCode < 500 || req._systemErrorLogged) return;
      req._systemErrorLogged = true;
      void systemErrorAudit?.logErrorEvent?.({
        severity: "error",
        source: "http",
        category: "response_5xx",
        message: extractMessage(responseBody, res.statusCode),
        requestPath: req.path || req.originalUrl || "",
        httpMethod: req.method || "",
        statusCode: res.statusCode,
        userId: Number.isInteger(req.user?.user_id) ? req.user.user_id : null,
        username: req.user?.username || null,
        ipAddress: (req.ip || "").trim(),
        userAgent: req.headers["user-agent"] || "",
      });
    });

    next();
  };
}

function createExpressErrorAuditHandler({ systemErrorAudit, isProduction }) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    req._systemErrorLogged = true;
    void systemErrorAudit?.logErrorEvent?.({
      severity: "critical",
      source: "http",
      category: "uncaught_route_exception",
      message: error?.message || "Unhandled route exception",
      stackTrace: error?.stack || null,
      requestPath: req.path || req.originalUrl || "",
      httpMethod: req.method || "",
      statusCode: 500,
      userId: Number.isInteger(req.user?.user_id) ? req.user.user_id : null,
      username: req.user?.username || null,
      ipAddress: (req.ip || "").trim(),
      userAgent: req.headers["user-agent"] || "",
    });
    const payload = isProduction
      ? { error: "Interne serverfout." }
      : { error: "Interne serverfout.", detail: error?.message || "Unknown error" };
    return res.status(500).json(payload);
  };
}

module.exports = {
  createErrorAuditCaptureMiddleware,
  createExpressErrorAuditHandler,
};

