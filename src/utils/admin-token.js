function isVerifiedSuperAdmin(decoded, configuredEmail) {
  const expectedEmail = String(configuredEmail || "").trim().toLowerCase();
  const tokenEmail = String(decoded?.email || "").trim().toLowerCase();

  return Boolean(
    expectedEmail &&
    tokenEmail === expectedEmail &&
    decoded?.isAdmin === true &&
    decoded?.role === "super_admin"
  );
}

module.exports = { isVerifiedSuperAdmin };
