function createViteProxyHelpers({ VITE_ORIGIN, http, https }) {
  function shouldProxyToVite(pathname) {
    if (!VITE_ORIGIN) return false;
    if (pathname.startsWith("/api")) return false;
    if (pathname.startsWith("/@vite")) return true;
    if (pathname.startsWith("/@react-refresh")) return true;
    if (pathname.startsWith("/src/")) return true;
    if (pathname.startsWith("/node_modules/")) return true;
    if (pathname.endsWith(".js") || pathname.endsWith(".css") || pathname.endsWith(".map")) return true;
    return pathname === "/" || pathname.endsWith(".html");
  }

  function proxyToVite(req, res) {
    if (!VITE_ORIGIN) {
      res.status(502).send("Vite origin not configured.");
      return;
    }
    const target = new URL(req.originalUrl || req.url || "/", VITE_ORIGIN);
    const client = target.protocol === "https:" ? https : http;
    const proxyReq = client.request(
      target,
      {
        method: req.method,
        headers: {
          ...req.headers,
          host: target.host,
        },
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 500);
        Object.entries(proxyRes.headers || {}).forEach(([key, value]) => {
          if (value !== undefined) res.setHeader(key, value);
        });
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", () => {
      res.status(502).send("Failed to reach Vite dev server.");
    });

    req.pipe(proxyReq, { end: true });
  }

  return { shouldProxyToVite, proxyToVite };
}

module.exports = { createViteProxyHelpers };
