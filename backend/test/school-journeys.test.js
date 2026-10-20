// A whole student journey, run for each school that has its own section (Baze, Cosmopolitan), start to finish, the way
// the app uses the server: sign up with the school's email and ID, post a lost item, a finder posts a found item with a
// photo, the owner messages the finder, confirms the return (the finder earns tokens), the leaderboard, a QR sticker made
// by the school's admin and scanned by a stranger, a complaint to the owner and the owner's private view. At every step
// it checks the other schools see none of it. No emails are sent (no RESEND_API_KEY).
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "foundit-journeys-"));
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
const { getSchool } = require("../src/config/schools");

let server;
let base;
let nile; // a Nile student, to prove nothing from the other schools ever reaches Nile
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await call("POST", "/api/auth/signup", { school: "nile", body: { name: "Nile Student", email: `nile${uid()}@nileuniversity.edu.ng`, password: "password123" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  nile = r.body;
});
test.after(() => server.close());

async function call(method, url, { school, token, body, form, headers = {} } = {}) {
  const h = { ...headers };
  if (school) h["X-School"] = school;
  if (token) h.Authorization = `Bearer ${token}`;
  if (body) h["Content-Type"] = "application/json";
  const res = await fetch(base + url, { method, headers: h, body: form || (body ? JSON.stringify(body) : undefined) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const uid = () => crypto.randomUUID().slice(0, 6);
const inSchool = (id, sql, ...args) => db.runWithSchool(id, () => db.prepare(sql).get(...args));

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const SCHOOLS = [
  { id: "baze", ids: ["20231", "20232"] },
  { id: "cosmopolitan", ids: ["25C-ABC-DEF-0123", "0124"] }, // the full card code, and just the number
];

for (const S of SCHOOLS) {
  const school = getSchool(S.id);
  const domain = school.emailDomain;

  test(`${school.name}: a whole student journey works, and stays inside ${school.name}`, async () => {
    assert.equal(school.enabled, true, `${school.name} is open`);
    const as = (who) => ({ school: S.id, token: who.accessToken });

    // ---- sign up: the school's email and ID format
    const owner = (await call("POST", "/api/auth/signup", { school: S.id, body: { name: "Ada Owner", email: `ada${uid()}@${domain}`, password: "password123", idNumber: S.ids[0] } })).body;
    const finder = (await call("POST", "/api/auth/signup", { school: S.id, body: { name: "Ben Finder", email: `ben${uid()}@${domain}`, password: "password123", idNumber: S.ids[1] } })).body;
    assert.ok(owner.accessToken && finder.accessToken, "both students signed up");
    assert.equal(owner.user.theme, school.theme, "a new student starts in the school's own colors");
    assert.equal((await call("POST", "/api/auth/signup", { school: S.id, body: { name: "X", email: `x${uid()}@${domain}`, password: "password123", idNumber: "not-an-id!" } })).status, 400, "a wrong ID is refused");
    assert.equal((await call("GET", "/api/auth/me", as(owner))).body.user.name, "Ada Owner");

    // ---- a lost post: seen at this school only
    const lost = await call("POST", "/api/lost-items", { ...as(owner), body: { description: `Black backpack ${S.id}`, location: "Library" } });
    assert.equal(lost.status, 201, JSON.stringify(lost.body));
    assert.ok((await call("GET", "/api/lost-items", as(finder))).body.items.some((i) => i.id === lost.body.item.id), "a classmate sees it");
    assert.ok(!(await call("GET", "/api/lost-items", { school: "nile", token: nile.accessToken })).body.items.some((i) => i.id === lost.body.item.id), "Nile never does");

    // ---- a found post with a photo: saved in this school's folder and database
    const form = new FormData();
    form.append("photo", new Blob([PNG], { type: "image/png" }), "bag.png");
    form.append("description", "Found a black backpack");
    form.append("location", "Library");
    const found = await call("POST", "/api/found-items", { ...as(finder), form });
    assert.equal(found.status, 201, JSON.stringify(found.body));
    assert.ok(found.body.item.photoUrl.startsWith(`/uploads/found-items/${S.id}/`));
    assert.ok(fs.existsSync(path.join(process.env.UPLOAD_ROOT, found.body.item.photoUrl.replace("/uploads/", ""))));
    assert.ok((await call("GET", "/api/found-items", as(owner))).body.items.some((i) => i.id === found.body.item.id));
    assert.ok(!(await call("GET", "/api/found-items", { school: "nile", token: nile.accessToken })).body.items.some((i) => i.id === found.body.item.id));

    // ---- the owner messages the finder, the finder reads it
    const convo = await call("POST", "/api/conversations", { ...as(owner), body: { foundItemId: found.body.item.id } });
    assert.equal(convo.status, 201, JSON.stringify(convo.body));
    const cid = convo.body.conversation.id;
    assert.equal((await call("POST", `/api/conversations/${cid}/messages`, { ...as(owner), body: { body: "That's mine! Where can we meet?" } })).status, 201);
    const inbox = await call("GET", "/api/conversations", as(finder));
    assert.ok(inbox.body.conversations.some((c) => c.id === cid), "the finder has the chat");
    const msgs = await call("GET", `/api/conversations/${cid}/messages`, as(finder));
    assert.ok(JSON.stringify(msgs.body).includes("Where can we meet?"));
    assert.equal((await call("GET", `/api/conversations/${cid}/messages`, { school: "nile", token: nile.accessToken })).status, 404, "a Nile student cannot open it");

    // ---- the return is confirmed: the finder earns 2 tokens, and shows on this school's leaderboard only
    const confirm = await call("POST", `/api/conversations/${cid}/confirm-return`, { ...as(owner), body: {} });
    assert.ok(confirm.status === 200 || confirm.status === 201, JSON.stringify(confirm.body));
    assert.equal(inSchool(S.id, "SELECT tokens FROM users WHERE id = ?", finder.user.id).tokens, 2);
    // the item leaves the gallery automatically the moment the return is confirmed, and shows on the Wall of Reunions
    assert.ok(!(await call("GET", "/api/found-items", as(owner))).body.items.some((i) => i.id === found.body.item.id), "a returned item is no longer in the gallery");
    assert.ok(!(await call("GET", "/api/found-items", as(finder))).body.items.some((i) => i.id === found.body.item.id), "not for the finder either");
    assert.ok((await call("GET", "/api/found-items?status=reunited", as(owner))).body.items.some((i) => i.id === found.body.item.id), "it shows on the Wall of Reunions");
    assert.ok((await call("GET", "/api/tokens/leaderboard", as(owner))).body.leaderboard.some((r) => r.name === "Ben Finder"));
    assert.ok(!(await call("GET", "/api/tokens/leaderboard", { school: "nile", token: nile.accessToken })).body.leaderboard.some((r) => r.name === "Ben Finder"));

    // ---- the school's own admin (the owner's email, verified at this school) prints a QR sticker; a student activates it
    const admin = (await call("POST", "/api/auth/signup", { school: S.id, body: { name: "FoundIT Owner", email: "owner@foundit.test", password: "password123" } })).body;
    assert.ok(admin.accessToken, "the owner's email may join any school");
    db.runWithSchool(S.id, () => db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(admin.user.id));
    const gen = await call("POST", "/api/tags/admin/generate", { ...as(admin), body: { count: 1 } });
    assert.equal(gen.status, 201, JSON.stringify(gen.body));
    const code = gen.body.codes[0];
    assert.equal((await call("POST", "/api/tags/claim", { ...as(owner), body: { code, label: "Laptop" } })).status, 201);

    // ---- a stranger scans it: the sticker names the school (?school=...), so the tag is found in this school's database
    assert.equal((await call("GET", `/api/tags/public/${code}`, { school: S.id })).body.status, "active");
    assert.equal((await call("GET", `/api/tags/public/${code}`)).status, 404, "without the school it is not Nile's tag");
    const scan = await call("POST", `/api/tags/public/${code}/chat`, { school: S.id, body: { message: "I found your laptop at the cafeteria." } });
    assert.equal(scan.status, 201, JSON.stringify(scan.body));

    // ---- a complaint to the owner, read on the owner's private page for this school
    assert.equal((await call("POST", "/api/support", { ...as(owner), body: { body: "Someone keeps posting fake items." } })).status, 201);
    const sup = await call("GET", "/api/monitor/support", as(admin));
    assert.equal(sup.status, 200, JSON.stringify(sup.body));
    assert.ok(JSON.stringify(sup.body).includes("Ada Owner"), "the owner sees the complaint");
    const activity = await call("GET", "/api/monitor/activity", as(admin));
    assert.equal(activity.status, 200);
    assert.ok(activity.body.activity?.length > 0 || JSON.stringify(activity.body).includes("Ada Owner"), "and the school's activity");
    assert.ok(!JSON.stringify(activity.body).includes("Nile Student"), "no Nile activity in this school's view");
    assert.equal((await call("GET", "/api/monitor/support", { school: "nile", token: admin.accessToken })).status, 401, "this school's sign-in does not open Nile's view");

    // ---- nothing of this school's ended up in Nile's database
    for (const [table, col, val] of [["users", "id", owner.user.id], ["lost_items", "id", lost.body.item.id], ["found_items", "id", found.body.item.id], ["conversations", "id", cid], ["tags", "code", code]]) {
      assert.equal(inSchool("nile", `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`, val).n, 0, `${table} not at Nile`);
      assert.equal(inSchool(S.id, `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`, val).n, 1, `${table} at ${school.name}`);
    }
  });
}

test("the two schools never see each other either", async () => {
  const b = (await call("POST", "/api/auth/signup", { school: "baze", body: { name: "B", email: `b${uid()}@bazeuniversity.edu.ng`, password: "password123" } })).body;
  const c = (await call("POST", "/api/auth/signup", { school: "cosmopolitan", body: { name: "C", email: `c${uid()}@cosmopolitan.edu.ng`, password: "password123" } })).body;
  const word = `umbrella-${uid()}`;
  await call("POST", "/api/lost-items", { school: "baze", token: b.accessToken, body: { description: word } });
  assert.ok(!(await call("GET", "/api/lost-items", { school: "cosmopolitan", token: c.accessToken })).body.items.some((i) => i.description === word));
  assert.equal((await call("GET", "/api/auth/me", { school: "cosmopolitan", token: b.accessToken })).status, 401);
  assert.equal((await call("POST", "/api/auth/signup", { school: "cosmopolitan", body: { name: "X", email: `x${uid()}@bazeuniversity.edu.ng`, password: "password123" } })).status, 400);
});
