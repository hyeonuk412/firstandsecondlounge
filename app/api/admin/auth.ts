function adminPassword() {
  return process.env.DM_ADMIN_PASSWORD || "";
}

export function requireAdmin(request: Request) {
  const configuredPassword = adminPassword();
  if (!configuredPassword) return false;

  const token = request.headers.get("x-admin-token") || "";
  return token.length > 0 && token === configuredPassword;
}

export function adminConfigured() {
  return Boolean(adminPassword());
}
