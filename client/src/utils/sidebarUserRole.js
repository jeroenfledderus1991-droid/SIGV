const HIDDEN_SIDEBAR_ROLE_VALUES = new Set(["support_admin_int", "user", "gebruiker"]);

export function getSidebarRoleLabel(user) {
  if (!user || user.is_super_admin) {
    return "";
  }
  const normalizedRole = String(user.role || "")
    .trim()
    .toLowerCase();
  if (!normalizedRole || HIDDEN_SIDEBAR_ROLE_VALUES.has(normalizedRole)) {
    return "";
  }
  if (normalizedRole === "admin") {
    return "Admin";
  }
  return String(user.role || "").trim();
}
