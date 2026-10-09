const test = require("node:test");
const assert = require("node:assert/strict");
const { isVerifiedSuperAdmin } = require("../utils/admin-token");

test("accepts only the configured super-admin token claims", () => {
  assert.equal(isVerifiedSuperAdmin({
    email: "ADMIN@example.com", role: "super_admin", isAdmin: true
  }, "admin@example.com"), true);
});

test("rejects regular user, wrong email, and non-super-admin claims", () => {
  assert.equal(isVerifiedSuperAdmin({
    email: "admin@example.com", role: "member", isAdmin: true
  }, "admin@example.com"), false);
  assert.equal(isVerifiedSuperAdmin({
    email: "other@example.com", role: "super_admin", isAdmin: true
  }, "admin@example.com"), false);
  assert.equal(isVerifiedSuperAdmin({
    email: "admin@example.com", role: "super_admin", isAdmin: false
  }, "admin@example.com"), false);
  assert.equal(isVerifiedSuperAdmin({
    email: "admin@example.com", role: "super_admin", isAdmin: true
  }, ""), false);
});
