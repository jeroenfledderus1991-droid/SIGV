function looksLikeDemoIdentity(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("eesa") ||
    normalized.endsWith("@admin.local") ||
    normalized.endsWith("@user.local") ||
    normalized.includes("demo")
  );
}

function runStartupChecks({
  isLocalLike,
  isProduction,
  sessionSecret,
  minSessionSecretLength,
  autoLoginEnabled,
  autoLoginAdminEnabled,
  autoLoginUserEnabled,
  autoLoginAdminEmail,
  autoLoginUserEmail,
  demoSuperAdminEmail,
}) {
  if (isLocalLike) return;
  if (!sessionSecret || sessionSecret.length < minSessionSecretLength) {
    console.error("SESSION_SECRET must be set and at least 32 chars in non-local environments.");
    process.exit(1);
  }

  if (isProduction && (autoLoginEnabled || autoLoginAdminEnabled || autoLoginUserEnabled)) {
    console.error("AUTO_LOGIN_* flags are not allowed in production.");
    process.exit(1);
  }

  if (isProduction) {
    const demoIdentities = [autoLoginAdminEmail, autoLoginUserEmail, demoSuperAdminEmail];
    if (demoIdentities.some(looksLikeDemoIdentity)) {
      console.error("Demo identities are not allowed in production config.");
      process.exit(1);
    }
  }
}

module.exports = { runStartupChecks };
