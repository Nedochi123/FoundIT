// Each university is its own private space. These tests try to get from one university into another the ways an
// attacker would: a real session sent with another school's name (X-School), ids copied from another school, photo links
// edited or reused, an admin of one school acting on another, a suspended student's still-valid session, and no session
// at all. Every attempt must fail, and the server (not the device) must say which university an account belongs to.
// Synthetic accounts only; no emails are sent (no RESEND_API_KEY).
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "foundit-isolation-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(dir, "test.db");
process.env.UPLOAD_ROOT = path.join(dir, "uploads");
process.env.JWT_ACCESS_SECRET = "test-access-secret-test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-test-refresh-secret";
process.env.ADMIN_EMAILS = "owner@foundit.test";
process.env.MONITOR_EMAILS = "owner@foundit.test";
delete process.env.RESEND_API_KEY;
delete process.env.ALLOWED_EMAIL_DOMAIN;

const db = require("../db");
const app = require("../src/app");
const { signPhotoUrl } = require("../src/utils/photoLinks");

let server;
let base;
const uid = () => crypto.randomUUID().slice(0, 6);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function call(method, url, { school, token, body, form } = {}) {
  const h = {};
  if (school) h["X-School"] = school;
  if (token) h.Authorization = `Bearer ${token}`;
  if (body) h["Content-Type"] = "application/json";
  const res = await fetch(base + url, { method, headers: h, body: form || (body ? JSON.stringify(body) : undefined) });
  return { status: res.status, body: await res.json().catch(() => ({})), headers: res.headers };
}
const signup = async (school, email, extra = {}) => {
  const r = await call("POST", "/api/auth/signup", { school, body: { name: "Test Student", email, password: "password123", ...extra } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};
async function postFound(school, token, description) {
  const form = new FormData();
  form.append("photo", new Blob([PNG], { type: "image/png" }), "item.png");
  form.append("description", description);
  const r = await call("POST", "/api/found-items", { school, token, form });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.item;
}

// Two students at Nile, two at Baze, Baze's admin, and a found item with a photo at each school.
let nileA, nileB, bazeA, bazeB, bazeAdmin, nileItem, bazeItem, nileConvo;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
  nileA = await signup("nile", `na${uid()}@nileuniversity.edu.ng`);
  nileB = await signup("nile", `nb${uid()}@nileuniversity.edu.ng`);
  bazeA = await signup("baze", `ba${uid()}@bazeuniversity.edu.ng`, { idNumber: "20231" });
  bazeB = await signup("baze", `bb${uid()}@bazeuniversity.edu.ng`, { idNumber: "20232" });
  bazeAdmin = await signup("baze", "owner@foundit.test");
  db.runWithSchool("baze", () => db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(bazeAdmin.user.id));
  nileItem = await postFound("nile", nileA.accessToken, "Nile-only red umbrella");
  bazeItem = await postFound("baze", bazeA.accessToken, "Baze-only blue flask");
  const c = await call("POST", "/api/conversations", { school: "nile", token: nileB.accessToken, body: { foundItemId: nileItem.id } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  nileConvo = c.body.conversation;
});
test.after(() => server.close());

// ------------------------------------------------------------------------------------------- identity from the server

test("the server says which university an account belongs to (the device does not decide it)", async () => {
  const nile = await call("GET", "/api/auth/me", { school: "nile", token: nileA.accessToken });
  assert.deepEqual(nile.body.user.school, { id: "nile", name: "Nile University", emailDomain: "nileuniversity.edu.ng" });
  const baze = await call("GET", "/api/auth/me", { school: "baze", token: bazeA.accessToken });
  assert.deepEqual(baze.body.user.school, { id: "baze", name: "Baze University", emailDomain: "bazeuniversity.edu.ng" });
  assert.equal(bazeA.user.school.id, "baze", "sign-up answers with the university too");
  const login = await call("POST", "/api/auth/login", { school: "baze", body: { email: bazeA.user.email, password: "password123" } });
  assert.equal(login.body.user.school.id, "baze", "and so does sign-in");
});

test("membership is decided by the university's email ending: another school's address is refused", async () => {
  const r = await call("POST", "/api/auth/signup", { school: "baze", body: { name: "X", email: `x${uid()}@nileuniversity.edu.ng`, password: "password123", idNumber: "20239" } });
  assert.equal(r.status, 400);
  const login = await call("POST", "/api/auth/login", { school: "baze", body: { email: nileA.user.email, password: "password123" } });
  assert.notEqual(login.status, 200, "a Nile account cannot sign in to Baze");
});

// ----------------------------------------------------------------------------------- switching university is refused

test("a real session sent with another university's name is refused on every kind of route", async () => {
  const forged = { school: "baze", token: nileA.accessToken }; // Nile's session, Baze's name
  const routes = [
    ["GET", "/api/auth/me"],
    ["GET", "/api/found-items"],
    ["GET", "/api/found-items?status=reunited"],
    ["GET", "/api/lost-items"],
    ["GET", "/api/conversations"],
    ["GET", `/api/conversations/${nileConvo.id}/messages`],
    ["POST", "/api/push/subscribe", { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "a", auth: "b" } }],
    ["POST", "/api/reports", { targetType: "found_item", targetId: bazeItem.id, reason: "spam" }],
    ["GET", "/api/tokens/leaderboard"],
    ["GET", "/api/tags"],
    ["GET", "/api/support"],
    ["GET", "/api/boosts/mine"],
    ["PATCH", "/api/users/me", { name: "Hijacked" }],
  ];
  for (const [method, url, body] of routes) {
    const r = await call(method, url, { ...forged, body });
    assert.equal(r.status, 401, `${method} ${url} answered ${r.status}`);
  }
  // and with no school named at all, a Baze session is not taken as the default school's either
  assert.equal((await call("GET", "/api/found-items", { token: bazeA.accessToken })).status, 401);
});

test("an unknown university, or one that is not open yet, is refused before anything else", async () => {
  assert.equal((await call("GET", "/api/found-items", { school: "hogwarts", token: nileA.accessToken })).status, 400);
  assert.equal((await call("GET", "/api/found-items", { school: "veritas", token: nileA.accessToken })).status, 403);
});

// ------------------------------------------------------------------------------------- data stays in its university

test("each university lists only its own items, and ids copied from another university find nothing", async () => {
  const nileList = (await call("GET", "/api/found-items", { school: "nile", token: nileB.accessToken })).body.items.map((i) => i.id);
  const bazeList = (await call("GET", "/api/found-items", { school: "baze", token: bazeB.accessToken })).body.items.map((i) => i.id);
  assert.ok(nileList.includes(nileItem.id) && !nileList.includes(bazeItem.id));
  assert.ok(bazeList.includes(bazeItem.id) && !bazeList.includes(nileItem.id));

  const asBaze = { school: "baze", token: bazeB.accessToken };
  assert.equal((await call("GET", `/api/conversations/${nileConvo.id}/messages`, asBaze)).status, 404, "a Nile chat id opens nothing at Baze");
  assert.equal((await call("POST", "/api/conversations", { ...asBaze, body: { foundItemId: nileItem.id } })).status, 404, "nor can a Baze student start a chat on a Nile item");
  assert.equal((await call("PATCH", `/api/found-items/${nileItem.id}/resolve`, asBaze)).status, 404);
  assert.equal((await call("GET", "/api/conversations", asBaze)).body.conversations.length, 0);
});

// ----------------------------------------------------------------------------------------------- private photos

test("photos open only with the signed link their university's students receive", async () => {
  // what a Nile student is given opens the photo
  const link = (await call("GET", "/api/found-items", { school: "nile", token: nileB.accessToken })).body.items.find((i) => i.id === nileItem.id).photoUrl;
  const ok = await fetch(base + link);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("cache-control"), /^private, max-age=\d+$/, "browsers may keep it for a while, shared caches never");
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), PNG);

  const [file, query] = link.split("?");
  const params = new URLSearchParams(query);
  const variant = (changes) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) p.set(k, v);
    return `${file}?${p}`;
  };
  const statusOf = async (url) => (await fetch(base + url)).status;

  assert.equal(await statusOf(file), 403, "the plain file address does not open it");
  assert.equal(await statusOf(variant({ school: "baze" })), 403, "naming another university breaks the signature");
  assert.equal(await statusOf(variant({ exp: String(Number(params.get("exp")) + 3600) })), 403, "nor can the expiry be stretched");
  assert.equal(await statusOf(variant({ sig: "A".repeat(43) })), 403);
  // a Baze link's signature does not open a Nile photo, nor the other way round
  const bazeLink = (await call("GET", "/api/found-items", { school: "baze", token: bazeB.accessToken })).body.items.find((i) => i.id === bazeItem.id).photoUrl;
  assert.equal(await statusOf(bazeLink), 200);
  assert.equal(await statusOf(`${file}?${bazeLink.split("?")[1]}`), 403);
  assert.equal(await statusOf(`${bazeLink.split("?")[0]}?${query}`), 403);
});

test("a photo link stops working once it expires, and the server never signs a link for another school's folder", async () => {
  const stored = db.runWithSchool("nile", () => db.prepare("SELECT photo_url FROM found_items WHERE id = ?").get(nileItem.id).photo_url);
  const old = signPhotoUrl(stored, "nile", Date.now() - 3 * 60 * 60 * 1000);
  assert.equal((await fetch(base + old)).status, 403, "a link handed out three hours ago");
  // a Nile photo signed as if it were Baze's: the folder does not match, so it is refused even with a valid signature
  assert.equal((await fetch(base + signPhotoUrl(stored, "baze"))).status, 403);
  // and every way a photo leaves the server is signed: the chats list too
  const convos = (await call("GET", "/api/conversations", { school: "nile", token: nileB.accessToken })).body.conversations;
  assert.match(convos[0].itemPhotoUrl, /\?school=nile&exp=\d+&sig=/);
  assert.equal((await fetch(base + convos[0].itemPhotoUrl)).status, 200);
});

// ------------------------------------------------------------------------------------------------ scoped admins

test("an admin manages only their own university", async () => {
  const asAdmin = { school: "baze", token: bazeAdmin.accessToken };
  assert.equal((await call("GET", "/api/auth/me", asAdmin)).body.user.isAdmin, true);
  assert.equal((await call("GET", "/api/admin/stats", asAdmin)).status, 200);
  for (const url of ["/api/admin/stats", "/api/admin/reports", "/api/admin/cashout-requests", "/api/monitor/activity", "/api/monitor/chats"]) {
    assert.equal((await call("GET", url, { school: "nile", token: bazeAdmin.accessToken })).status, 401, `Baze's admin at Nile: ${url}`);
  }
  // students are never admins
  assert.equal((await call("GET", "/api/admin/stats", { school: "baze", token: bazeB.accessToken })).status, 403);

  // a report filed at Baze about a Nile account: Baze's admin "suspends" it, and the Nile account is untouched
  await call("POST", "/api/reports", { school: "baze", token: bazeB.accessToken, body: { targetType: "user", targetId: nileA.user.id, reason: "spam" } });
  const report = (await call("GET", "/api/admin/reports?status=pending", asAdmin)).body.reports.find((r) => r.targetId === nileA.user.id);
  assert.ok(report);
  assert.equal((await call("PATCH", `/api/admin/reports/${report.id}`, { ...asAdmin, body: { action: "suspend_user" } })).status, 200);
  assert.equal((await call("GET", "/api/auth/me", { school: "nile", token: nileA.accessToken })).status, 200, "the Nile student still works");
  assert.equal(db.runWithSchool("nile", () => db.prepare("SELECT suspended_at FROM users WHERE id = ?").get(nileA.user.id).suspended_at), null);
});

test("a suspension takes effect on the very next request, even with a session issued before it", async () => {
  const student = await signup("baze", `s${uid()}@bazeuniversity.edu.ng`, { idNumber: "20250" });
  const as = { school: "baze", token: student.accessToken };
  assert.equal((await call("GET", "/api/found-items", as)).status, 200);
  await call("POST", "/api/reports", { school: "baze", token: bazeB.accessToken, body: { targetType: "user", targetId: student.user.id, reason: "scam" } });
  const report = (await call("GET", "/api/admin/reports?status=pending", { school: "baze", token: bazeAdmin.accessToken })).body.reports.find((r) => r.targetId === student.user.id);
  await call("PATCH", `/api/admin/reports/${report.id}`, { school: "baze", token: bazeAdmin.accessToken, body: { action: "suspend_user" } });
  assert.equal((await call("GET", "/api/found-items", as)).status, 403);
  assert.equal((await call("GET", "/api/conversations", as)).status, 403);
  const refresh = await call("POST", "/api/auth/refresh", { school: "baze", body: { refreshToken: student.refreshToken } });
  assert.notEqual(refresh.status, 200, "and the session cannot be renewed");
});

// ---------------------------------------------------------------------------------------------- no session at all

test("without a session nothing private answers", async () => {
  for (const school of ["nile", "baze"]) {
    for (const url of ["/api/auth/me", "/api/found-items", "/api/found-items?status=reunited", "/api/lost-items", "/api/conversations", "/api/tokens/leaderboard", "/api/admin/stats", "/api/monitor/chats", "/api/support"]) {
      assert.equal((await call("GET", url, { school })).status, 401, `${school} ${url}`);
    }
  }
  // the only public school data: the list of universities (names, and whether each is open)
  const schools = (await call("GET", "/api/schools")).body.schools;
  assert.deepEqual(Object.keys(schools[0]).sort(), ["id", "name", "open"]);
});
