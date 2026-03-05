function registerClientShellRoutes({
  app,
  express,
  fs,
  isProduction,
  viteOrigin,
  clientDistDir,
  clientDistIndex,
  clientDevIndex,
  shouldProxyToVite,
  proxyToVite,
  buildBootstrap,
  buildBootstrapMarkup,
  defaultSettings,
  normalizeHex,
  clamp,
  mixWithBlack,
}) {
  if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
  }

  if (!isProduction && viteOrigin) {
    app.use((req, res, next) => {
      if (shouldProxyToVite(req.path || req.url || "")) {
        proxyToVite(req, res);
        return;
      }
      next();
    });
  }

  app.get(/^(?!\/api).*/, async (req, res) => {
    if (!isProduction && viteOrigin) {
      const redirectUrl = new URL(req.originalUrl, viteOrigin);
      res.redirect(redirectUrl.toString());
      return;
    }
    const indexPath = fs.existsSync(clientDistIndex) ? clientDistIndex : clientDevIndex;
    if (!fs.existsSync(indexPath)) {
      res.status(404).send("Client index not found.");
      return;
    }

    try {
      const template = fs.readFileSync(indexPath, "utf-8");
      const bootstrap = await buildBootstrap(req, res);
      const nonce = isProduction ? res.locals.cspNonce : null;
      const markup = buildBootstrapMarkup(bootstrap, nonce, {
        defaultSettings,
        normalizeHex,
        clamp,
        mixWithBlack,
      });
      const html = template
        .replace("<!-- APP_BOOTSTRAP -->", markup)
        .replace(/__CSP_NONCE__/g, nonce || "");
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      res.status(500).send("Failed to load app.");
    }
  });
}

module.exports = { registerClientShellRoutes };
