// Admin and owner rights need a VERIFIED email. Anyone can type an admin address into the sign-up form, but only
// the real owner of that inbox receives the verification (or password-reset) email.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-verified-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_EMAILS = "owner-v@example.com,old-admin@example.com,legacy-admin@example.com";
delete process.env.MONITOR_EMAILS;
delete process.env.RESEND_API_KEY;

const db = require("../db");
const app = require("../src/app");
const { signAccessToken, hashToken } = require("../src/utils/tokens");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = async (token, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const PASSWORD = "a-long-enough-password";
const rights = async (token) => {
  const me = (await call(token, "GET", "/api/auth/me")).body.user;
  return {
    isAdmin: me.isAdmin,
    isMonitor: me.isMonitor,
    adminRoute: (await call(token, "GET", "/api/admin/backups")).status,
    ownerRoute: (await call(token, "GET", "/api/monitor/activity")).status,
  };
};
const userByEmail = (email) => db.prepare("SELECT * FROM users WHERE email = ?").get(email);

let ownerToken;

test("someone who signs up with an admin address gets an ordinary account until the email is verified", async () => {
  const made = await call(null, "POST", "/api/auth/signup", { name: "Pretender", email: "owner-v@example.com", password: PASSWORD });
  assert.equal(made.status, 201, "the form accepts the address");
  ownerToken = made.body.accessToken;
  assert.equal(made.body.user.isAdmin, false);
  assert.equal(made.body.user.isMonitor, false);
  assert.deepEqual(await rights(ownerToken), { isAdmin: false, isMonitor: false, adminRoute: 403, ownerRoute: 404 });
});

test("clicking the verification link sent to that inbox grants the rights", async () => {
  const raw = crypto.randomBytes(16).toString("hex");
  db.prepare("INSERT INTO email_verification_tokens (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))").run(
    crypto.randomUUID(),
    hashToken(raw),
    userByEmail("owner-v@example.com").id
  );
  assert.equal((await call(null, "POST", "/api/auth/verify-email", { token: raw })).status, 200);
  assert.deepEqual(await rights(ownerToken), { isAdmin: true, isMonitor: true, adminRoute: 200, ownerRoute: 200 });
});

test("completing a password reset (a link sent to the inbox) also counts as verifying it", async () => {
  const email = "old-admin@example.com";
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, 'Old Admin', ?, 'x', datetime('now'))").run(id, email);
  const token = signAccessToken({ id, email, name: "Old Admin" });
  assert.equal((await rights(token)).isAdmin, false, "an unverified account made after the rule is not an admin");

  const raw = crypto.randomBytes(16).toString("hex");
  db.prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))").run(
    crypto.randomUUID(),
    id,
    hashToken(raw)
  );
  assert.equal((await call(null, "POST", "/api/auth/reset-password", { token: raw, password: "a-brand-new-password" })).status, 200);
  assert.ok(userByEmail(email).email_verified_at, "the email is now verified");
  assert.equal((await rights(token)).isAdmin, true);
  assert.equal((await rights(token)).ownerRoute, 404, "and being an admin still doesn't make an account the owner");
});

test("an admin account that existed before this rule keeps its admin access, but the owner must be verified", async () => {
  const email = "legacy-admin@example.com";
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, 'Legacy', ?, 'x', '2026-09-01 08:00:00')").run(id, email);
  const token = signAccessToken({ id, email, name: "Legacy" });

  // made before the rule, never verified: still an admin, as it always was
  assert.equal((await rights(token)).isAdmin, true);
  assert.equal((await rights(token)).adminRoute, 200);

  // ...but if it is named the owner, it must be verified, with no exception for old accounts
  process.env.MONITOR_EMAILS = email;
  try {
    assert.equal((await rights(token)).isMonitor, false);
    assert.equal((await rights(token)).ownerRoute, 404);
    db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(id);
    assert.equal((await rights(token)).isMonitor, true);
    assert.equal((await rights(token)).ownerRoute, 200);
  } finally {
    delete process.env.MONITOR_EMAILS;
  }
});

test("verifying a normal address never makes anyone an admin", async () => {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, name, email, password_hash, email_verified_at) VALUES (?, 'Student', 'student-v@example.com', 'x', datetime('now'))").run(id);
  const token = signAccessToken({ id, email: "student-v@example.com", name: "Student" });
  assert.deepEqual(await rights(token), { isAdmin: false, isMonitor: false, adminRoute: 403, ownerRoute: 404 });
});
