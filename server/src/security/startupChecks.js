function runStartupChecks({ isProduction, sessionSecret, minSessionSecretLength }) {
  if (!isProduction) return;
  if (!sessionSecret || sessionSecret.length < minSessionSecretLength) {
    console.error("SESSION_SECRET must be set and at least 32 chars in production.");
    process.exit(1);
  }
}

module.exports = { runStartupChecks };
