// The last security pass: the gallery is for signed-in students only, a phone's push address must be a real push service (the
// server sends requests to it later), a session for an account that is gone stops working, and text inputs have a length limit.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

const work = fs.mkdtempSync(path.join(os.tmpdir(), "foundit-final-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(work, "test.db");
process.env.UPLOAD_ROOT = path.join(work, "uploads");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ALLOWED_ORIGINS = "https://app.example";
delete process.env.RESEND_API_KEY;
// real-looking push keys, so the sending code runs (every actual send is replaced below)
const webpush = require("web-push");
const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");
const { hashPassword } = require("../src/utils/password");
const { validEndpoint, cleanSubscription } = require("../src/utils/pushEndpoint");
const { broadcastPush } = require("../src/utils/push");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const uid = () => crypto.randomUUID();
async function makeUser(name) {
  const id = uid();
  const email = `${name.toLowerCase().replace(/\W/g, "")}-${id.slice(0, 6)}@example.com`;
  db.prepare("INSERT INTO users (id, name, email, password_hash, tokens) VALUES (?, ?, ?, ?, 0)").run(id, name, email, await hashPassword("a good password"));
  return { id, name, email, token: signAccessToken({ id, email, name }) };
}
const call = async (user, method, url, body, headers = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

// real browsers' keys: a 65-byte P-256 point (87 characters) and a 16-byte secret (22 characters), base64url
const KEYS = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
const FCM = "https://fcm.googleapis.com/fcm/send/abc:APA91bExample";

// ---------------------------------------------------------------------------------------------- the gallery
test("the gallery of found items needs a signed-in student, for the open list and for the Wall of Reunions", async () => {
  const student = await makeUser("Gallery Student");
  for (const url of ["/api/found-items", "/api/found-items?status=open", "/api/found-items?status=reunited"]) {
    const anonymous = await call(null, "GET", url);
    assert.equal(anonymous.status, 401, `${url} without signing in`);
    assert.ok(!("items" in anonymous.body), "no items leak in the refusal");
    const signedIn = await call(student, "GET", url);
    assert.equal(signedIn.status, 200, `${url} signed in`);
    assert.ok(Array.isArray(signedIn.body.items));
  }
});

// ---------------------------------------------------------------------------------------------- push addresses
test("only a real push service's address is accepted, always over https on the normal port", () => {
  for (const good of [FCM, "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://web.push.apple.com/abc", "https://wns2-par02p.notify.windows.com/w/?token=abc", "https://fcm.googleapis.com/wp/xyz"]) {
    assert.equal(validEndpoint(good), true, good);
  }
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc", // not https
    "https://evil.example/fcm", // not a push service
    "https://fcm.googleapis.com.evil.example/fcm/send/abc", // a push service's name inside someone else's
    "https://evil.example/?x=fcm.googleapis.com",
    "https://169.254.169.254/latest/meta-data/", // a cloud's private address
    "https://127.0.0.1/",
    "https://localhost/",
    "https://[::1]/",
    "https://user:password@fcm.googleapis.com/fcm/send/abc", // a login inside the address
    "https://fcm.googleapis.com:8443/fcm/send/abc", // another port
    "https://foundit-backend.railway.internal/",
    "ftp://fcm.googleapis.com/x",
    "javascript:alert(1)",
    "//fcm.googleapis.com/x",
    "",
    "x".repeat(1300),
    null,
    undefined,
    42,
    {},
    ["https://fcm.googleapis.com/x"],
  ]) {
    assert.equal(validEndpoint(bad), false, String(bad).slice(0, 60));
  }
});

test("a subscription needs well-formed keys too", () => {
  assert.deepEqual(cleanSubscription({ endpoint: FCM, keys: KEYS, extra: "ignored" }), { endpoint: FCM, keys: KEYS });
  for (const bad of [null, "text", {}, { endpoint: FCM }, { endpoint: FCM, keys: {} }, { endpoint: FCM, keys: { p256dh: KEYS.p256dh } }, { endpoint: FCM, keys: { p256dh: "x", auth: KEYS.auth } }, { endpoint: FCM, keys: { p256dh: KEYS.p256dh, auth: "not base64!" } }, { endpoint: FCM, keys: { p256dh: "a".repeat(300), auth: KEYS.auth } }, { endpoint: FCM, keys: { p256dh: 5, auth: KEYS.auth } }, { endpoint: "https://evil.example/", keys: KEYS }]) {
    assert.equal(cleanSubscription(bad), null, JSON.stringify(bad).slice(0, 80));
  }
});

test("the subscribe route saves a real subscription and refuses an address that would make the server call somewhere else", async () => {
  const student = await makeUser("Push Student");
  assert.equal((await call(student, "POST", "/api/push/subscribe", { endpoint: FCM, keys: KEYS })).status, 201);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM push_subscriptions WHERE user_id = ?").get(student.id).n, 1);

  for (const endpoint of ["https://169.254.169.254/latest/meta-data/", "http://127.0.0.1:8080/admin", "https://evil.example/collect", "https://fcm.googleapis.com.evil.example/x"]) {
    const r = await call(student, "POST", "/api/push/subscribe", { endpoint, keys: KEYS });
    assert.equal(r.status, 400, endpoint);
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM push_subscriptions WHERE user_id = ?").get(student.id).n, 1, "nothing bad was saved");
  assert.equal((await call(null, "POST", "/api/push/subscribe", { endpoint: FCM, keys: KEYS })).status, 401);
});

test("the server never sends to a saved address that is not a push service, even one saved before the check existed", async () => {
  const student = await makeUser("Old Row");
  const other = await makeUser("Poster");
  const ok = "https://fcm.googleapis.com/fcm/send/real-" + uid();
  const planted = "http://127.0.0.1:9/internal-" + uid();
  const insert = db.prepare("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)");
  insert.run(uid(), student.id, ok, KEYS.p256dh, KEYS.auth);
  insert.run(uid(), student.id, planted, KEYS.p256dh, KEYS.auth);

  const sentTo = [];
  const original = webpush.sendNotification;
  webpush.sendNotification = async (sub) => void sentTo.push(sub.endpoint);
  try {
    await broadcastPush({ title: "Lost", body: "Something", excludeUserId: other.id });
  } finally {
    webpush.sendNotification = original;
  }
  assert.ok(sentTo.includes(ok), "a real push address still gets its notification");
  assert.ok(!sentTo.includes(planted), "the planted address was never requested");
});

// ---------------------------------------------------------------------------------------------- sessions
test("a session for an account that no longer exists at all stops working, a suspended one is refused, a normal one works", async () => {
  const gone = await makeUser("Vanished");
  assert.equal((await call(gone, "GET", "/api/auth/me")).status, 200);
  db.exec("PRAGMA foreign_keys = OFF");
  db.prepare("DELETE FROM users WHERE id = ?").run(gone.id);
  db.exec("PRAGMA foreign_keys = ON");
  const r = await call(gone, "GET", "/api/auth/me");
  assert.equal(r.status, 401);
  assert.match(r.body.error, /no longer exists/);

  const suspended = await makeUser("Suspended");
  db.prepare("UPDATE users SET suspended_at = datetime('now') WHERE id = ?").run(suspended.id);
  assert.equal((await call(suspended, "GET", "/api/auth/me")).status, 403);

  const deleted = await makeUser("Deleted");
  db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(deleted.id);
  assert.equal((await call(deleted, "GET", "/api/auth/me")).status, 401);
});

// ---------------------------------------------------------------------------------------------- length limits
test("names, emails and ids have a length limit, so one huge value cannot bloat chats, the leaderboard or notifications", async () => {
  const student = await makeUser("Limits Student");
  const long = "N".repeat(81);

  const signup = await call(null, "POST", "/api/auth/signup", { name: long, email: "limit.test@example.com", password: "a good password" });
  assert.equal(signup.status, 400);
  assert.match(signup.body.error, /too long|valid|Nile|Signup requires/i);

  assert.equal((await call(student, "PATCH", "/api/users/me", { name: long })).status, 400);
  assert.equal((await call(student, "PATCH", "/api/users/me", { name: "N".repeat(80) })).status, 200);

  assert.equal((await call(null, "POST", "/api/auth/login", { email: `${"a".repeat(300)}@example.com`, password: "x" })).status, 400);
  assert.equal((await call(student, "POST", "/api/reports", { targetType: "user", targetId: "x".repeat(65), reason: "spam" })).status, 400);
  assert.equal((await call(student, "POST", "/api/boosts", { lostItemId: "x".repeat(65), plan: "day" })).status, 400);
  assert.equal((await call(student, "POST", "/api/tags/claim", { code: "x".repeat(41) })).status, 400);
});
