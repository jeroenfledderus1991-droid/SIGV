function buildCspHeader(isProduction, nonce) {
  if (!isProduction) {
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' http: https: ws: wss:",
      "frame-ancestors 'self'",
      "object-src 'none'",
    ].join("; ");
  }
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' https:`,
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: http: ws: wss:",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ];
  return directives.join("; ");
}

module.exports = { buildCspHeader };
