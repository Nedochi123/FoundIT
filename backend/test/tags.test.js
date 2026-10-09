// "Return me" QR tags: the admin makes them, a student activates one, a finder (no account) leaves a
// message, and only the owner sees it. The finder never learns anything about the owner.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-tags-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_EMAILS = "admin-tags@example.com";
delete process.env.RESEND_API_KEY;

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");
const { newTagCode, normalizeCode } = require("../src/utils/tags");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

function makeUser(name, email) {
  const id = crypto.randomUUID();
  email = email || `${name.toLowerCase().replace(/\W/g, "")}-${id.slice(0, 6)}@example.com`;
  db.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, 'x')").run(id, name, email);
  return { id, name, email, token: signAccessToken({ id, email, name }) };
}
const admin = makeUser("Admin", "admin-tags@example.com");
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const freshCode = async () => (await call(admin, "POST", "/api/tags/admin/generate", { count: 1 })).body.codes[0];
const tagRow = (code) => db.prepare("SELECT * FROM tags WHERE code = ?").get(code);

test("codes use an unambiguous alphabet, are 8 characters, and are tidied up when typed", () => {
  for (let i = 0; i < 200; i++) assert.match(newTagCode(), /^[2-9A-HJ-NP-Z]{8}$/);
  assert.equal(normalizeCode(" k7m2-qx4p "), "K7M2QX4P");
  assert.equal(new Set(Array.from({ length: 500 }, newTagCode)).size, 500, "no repeats");
});

test("only an admin can make tags, between 1 and 200 at a time", async () => {
  const student = makeUser("Student A");
  assert.equal((await call(null, "POST", "/api/tags/admin/generate", { count: 3 })).status, 401);
  assert.equal((await call(student, "POST", "/api/tags/admin/generate", { count: 3 })).status, 403);
  for (const bad of [0, 201, -1, 2.5, "10"]) {
    assert.equal((await call(admin, "POST", "/api/tags/admin/generate", { count: bad })).status, 400, `count ${bad}`);
  }
  const ok = await call(admin, "POST", "/api/tags/admin/generate", { count: 25 });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.codes.length, 25);
  assert.equal(new Set(ok.body.codes).size, 25);
  const summary = await call(admin, "GET", "/api/tags/admin/summary");
  assert.ok(summary.body.counts.unclaimed >= 25);
  assert.ok(summary.body.unclaimedCodes.includes(ok.body.codes[0]));
  assert.equal((await call(student, "GET", "/api/tags/admin/summary")).status, 403);
});

test("a scanned unclaimed or unknown tag says so, and tells a stranger nothing else", async () => {
  const code = await freshCode();
  const unclaimed = await call(null, "GET", `/api/tags/public/${code}`);
  assert.deepEqual(unclaimed.body, { status: "unclaimed", label: null });
  assert.equal((await call(null, "GET", "/api/tags/public/ZZZZZZZZ")).status, 404);
  assert.equal((await call(null, "GET", `/api/tags/public/${code.toLowerCase()}`)).body.status, "unclaimed", "lowercase is fine");
});

test("a student activates a tag once; others can't take it", async () => {
  const owner = makeUser("Owner One");
  const other = makeUser("Other One");
  const code = await freshCode();

  assert.equal((await call(null, "POST", "/api/tags/claim", { code })).status, 401);
  assert.equal((await call(owner, "POST", "/api/tags/claim", { code: "NOPE1234" })).status, 404);
  assert.equal((await call(owner, "POST", "/api/tags/claim", {})).status, 400);
  assert.equal((await call(owner, "POST", "/api/tags/claim", { code, label: "x".repeat(61) })).status, 400);

  const claimed = await call(owner, "POST", "/api/tags/claim", { code: ` ${code.slice(0, 4)}-${code.slice(4)} `, label: "Blue backpack" });
  assert.equal(claimed.status, 201);
  assert.equal(claimed.body.tag.label, "Blue backpack");
  assert.equal(claimed.body.tag.status, "active");
  assert.equal((await call(other, "POST", "/api/tags/claim", { code })).status, 409);
  assert.equal((await call(owner, "POST", "/api/tags/claim", { code })).status, 409);

  const mine = await call(owner, "GET", "/api/tags");
  assert.equal(mine.body.tags.length, 1);
  assert.equal((await call(other, "GET", "/api/tags")).body.tags.length, 0);
});

test("a person can only hold 10 tags", async () => {
  const owner = makeUser("Collector");
  for (let i = 0; i < 10; i++) {
    assert.equal((await call(owner, "POST", "/api/tags/claim", { code: await freshCode() })).status, 201);
  }
  assert.equal((await call(owner, "POST", "/api/tags/claim", { code: await freshCode() })).status, 400);
});

test("a finder with no account can leave a message; the public page shows only the label", async () => {
  const owner = makeUser("Owner Two", "owner-two@example.com");
  const code = await freshCode();
  await call(owner, "POST", "/api/tags/claim", { code, label: "Black laptop bag" });

  const info = await call(null, "GET", `/api/tags/public/${code}`);
  assert.deepEqual(info.body, { status: "active", label: "Black laptop bag" });
  assert.ok(!JSON.stringify(info.body).includes(owner.name) && !JSON.stringify(info.body).includes("owner-two"), "nothing about the owner");

  const sent = await call(null, "POST", `/api/tags/public/${code}/found`, { name: "Musa", phone: "0803 123 4567", message: "At the library desk" });
  assert.equal(sent.status, 201);
  assert.deepEqual(sent.body, { ok: true }, "the finder is told nothing more");

  const list = await call(owner, "GET", "/api/tags");
  assert.equal(list.body.tags[0].unreadCount, 1);
  const msgs = await call(owner, "GET", `/api/tags/${list.body.tags[0].id}/messages`);
  assert.equal(msgs.body.messages[0].finderPhone, "0803 123 4567");
  assert.equal(msgs.body.messages[0].finderName, "Musa");
  assert.equal(msgs.body.messages[0].message, "At the library desk");
  assert.equal(msgs.body.messages[0].unread, true);
  assert.equal((await call(owner, "GET", "/api/tags")).body.tags[0].unreadCount, 0, "reading marks them read");
});

test("a bad or missing phone number, a bot, or an unusable tag is refused", async () => {
  const owner = makeUser("Owner Three");
  const code = await freshCode();
  const url = (c) => `/api/tags/public/${c}/found`;

  assert.equal((await call(null, "POST", url(code), { phone: "0803 123 4567" })).status, 409, "an unclaimed tag takes no messages");
  await call(owner, "POST", "/api/tags/claim", { code, label: "Keys" });

  assert.equal((await call(null, "POST", url(code), {})).status, 400, "phone is required");
  for (const phone of ["12", "abcdefghij", "1".repeat(16)]) {
    assert.equal((await call(null, "POST", url(code), { phone })).status, 400, `phone ${phone}`);
  }
  assert.equal((await call(null, "POST", url(code), { phone: "08031234567", message: "x".repeat(301) })).status, 400);
  assert.equal((await call(null, "POST", url("ZZZZZZZZ"), { phone: "08031234567" })).status, 404);

  const before = db.prepare("SELECT COUNT(*) n FROM tag_messages").get().n;
  const bot = await call(null, "POST", url(code), { phone: "08031234567", website: "http://spam.example" });
  assert.equal(bot.status, 201, "a bot is told it worked");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_messages").get().n, before, "but nothing is saved");

  const id = tagRow(code).id;
  await call(owner, "PATCH", `/api/tags/${id}`, { status: "paused" });
  assert.equal((await call(null, "GET", `/api/tags/public/${code}`)).body.status, "paused");
  assert.equal((await call(null, "POST", url(code), { phone: "08031234567" })).status, 409, "a paused tag takes no messages");
});

test("a tag can't be flooded with messages", async () => {
  const owner = makeUser("Owner Four");
  const code = await freshCode();
  await call(owner, "POST", "/api/tags/claim", { code });
  for (let i = 0; i < 5; i++) assert.equal((await call(null, "POST", `/api/tags/public/${code}/found`, { phone: "08031234567" })).status, 201);
  const sixth = await call(null, "POST", `/api/tags/public/${code}/found`, { phone: "08031234567" });
  assert.equal(sixth.status, 429);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_messages WHERE tag_id = ?").get(tagRow(code).id).n, 5);
});

test("only the owner can read messages, rename, pause or release; releasing deletes the finders' numbers", async () => {
  const owner = makeUser("Owner Five");
  const stranger = makeUser("Stranger");
  const code = await freshCode();
  const claimed = await call(owner, "POST", "/api/tags/claim", { code, label: "Laptop" });
  const id = claimed.body.tag.id;
  await call(null, "POST", `/api/tags/public/${code}/found`, { phone: "08031234567", message: "Found it" });

  assert.equal((await call(stranger, "GET", `/api/tags/${id}/messages`)).status, 404);
  assert.equal((await call(stranger, "PATCH", `/api/tags/${id}`, { label: "Mine now" })).status, 404);
  assert.equal((await call(stranger, "POST", `/api/tags/${id}/release`)).status, 404);
  assert.equal((await call(null, "GET", `/api/tags/${id}/messages`)).status, 401);
  assert.equal(tagRow(code).label, "Laptop");

  const renamed = await call(owner, "PATCH", `/api/tags/${id}`, { label: "Dell laptop", status: "paused" });
  assert.equal(renamed.body.tag.label, "Dell laptop");
  assert.equal(renamed.body.tag.status, "paused");
  assert.equal((await call(owner, "PATCH", `/api/tags/${id}`, { status: "weird" })).status, 400);
  assert.equal((await call(owner, "PATCH", `/api/tags/${id}`, { status: "active" })).body.tag.status, "active");

  assert.equal((await call(owner, "POST", `/api/tags/${id}/release`)).status, 200);
  assert.equal(tagRow(code).owner_id, null);
  assert.equal(tagRow(code).status, "unclaimed");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_messages WHERE tag_id = ?").get(id).n, 0, "the finders' numbers are deleted");
  assert.equal((await call(null, "GET", `/api/tags/public/${code}`)).body.status, "unclaimed");
});

test("a tag whose owner deleted their account stops taking messages", async () => {
  const owner = makeUser("Leaver");
  const code = await freshCode();
  await call(owner, "POST", "/api/tags/claim", { code });
  db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(owner.id);
  assert.equal((await call(null, "GET", `/api/tags/public/${code}`)).body.status, "inactive");
  assert.equal((await call(null, "POST", `/api/tags/public/${code}/found`, { phone: "08031234567" })).status, 409);
});
