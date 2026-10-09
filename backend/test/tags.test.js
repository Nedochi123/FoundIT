// "Return me" QR tags: the admin makes them, a student activates one, a finder (no account) starts a
// private chat with the owner, and either side may choose to share a name or number. Nothing else leaks.
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


// ---------- the private chat between a finder (no account) and the owner ----------

const finderCall = async (code, method, suffix, token, body) => {
  const res = await fetch(`${base}/api/tags/public/${code}${suffix}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { "X-Chat-Token": token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

/** A claimed tag with an owner; returns what the chat tests need. */
async function activeTag(ownerName, label = "Black laptop bag") {
  const owner = makeUser(ownerName, `${ownerName.toLowerCase().replace(/\W/g, "")}@example.com`);
  const code = await freshCode();
  const claimed = await call(owner, "POST", "/api/tags/claim", { code, label });
  return { owner, code, id: claimed.body.tag.id };
}

test("a finder with no account starts a chat; the page shows only the item, never the owner", async () => {
  const { owner, code } = await activeTag("Owner Two");

  const info = await call(null, "GET", `/api/tags/public/${code}`);
  assert.deepEqual(info.body, { status: "active", label: "Black laptop bag" });

  const started = await finderCall(code, "POST", "/chat", null, { message: "I found your bag at the library" });
  assert.equal(started.status, 201);
  assert.ok(started.body.token.length >= 20, "the finder gets a secret token");
  assert.equal(started.body.messages.length, 1);
  assert.equal(started.body.messages[0].sender, "finder");
  assert.equal(started.body.messages[0].body, "I found your bag at the library");
  const everything = JSON.stringify(started.body) + JSON.stringify(info.body);
  assert.ok(!everything.includes("Owner Two") && !everything.includes("ownertwo@example.com"), "nothing about the owner");

  const stored = db.prepare("SELECT finder_token_hash FROM tag_threads").all();
  assert.ok(stored.every((t) => t.finder_token_hash !== started.body.token), "only a hash of the token is kept");

  const list = await call(owner, "GET", "/api/tags");
  assert.equal(list.body.tags[0].chatCount, 1);
  assert.equal(list.body.tags[0].unreadCount, 1);
});

test("the owner and finder chat; reading marks messages read; contact is shared only when someone chooses to", async () => {
  const { owner, code, id } = await activeTag("Owner Three");
  const { body: started } = await finderCall(code, "POST", "/chat", null, { message: "Found your keys" });
  const token = started.token;

  const threads = await call(owner, "GET", `/api/tags/${id}/threads`);
  assert.equal(threads.body.threads.length, 1);
  assert.equal(threads.body.threads[0].unreadCount, 1);
  assert.equal(threads.body.threads[0].preview, "Found your keys");
  assert.equal(threads.body.threads[0].finderName, null, "no name until the finder shares one");
  const threadId = threads.body.threads[0].id;

  const opened = await call(owner, "GET", `/api/tags/${id}/threads/${threadId}`);
  assert.equal(opened.body.messages.length, 1);
  assert.equal(opened.body.open, true);
  assert.equal((await call(owner, "GET", "/api/tags")).body.tags[0].unreadCount, 0, "opening the chat marks it read");

  // owner replies; the finder sees it
  const reply = await call(owner, "POST", `/api/tags/${id}/threads/${threadId}/messages`, { message: "Thank you! Where are you?" });
  assert.equal(reply.status, 201);
  const finderView = await finderCall(code, "GET", "/chat", token);
  assert.deepEqual(finderView.body.messages.map((m) => [m.sender, m.body]), [["finder", "Found your keys"], ["owner", "Thank you! Where are you?"]]);
  assert.ok(!JSON.stringify(finderView.body).includes("ownerthree"), "still nothing about the owner");

  // the finder decides to share a name and number; the owner sees them as a contact card
  assert.equal((await finderCall(code, "POST", "/chat/contact", token, {})).status, 400, "name or number needed");
  assert.equal((await finderCall(code, "POST", "/chat/contact", token, { phone: "12" })).status, 400, "bad number");
  const shared = await finderCall(code, "POST", "/chat/contact", token, { name: "Musa", phone: "0803 123 4567" });
  assert.equal(shared.status, 201);
  const list = await call(owner, "GET", `/api/tags/${id}/threads`);
  assert.equal(list.body.threads[0].finderName, "Musa");
  assert.equal(list.body.threads[0].unreadCount, 1);
  const afterShare = await call(owner, "GET", `/api/tags/${id}/threads/${threadId}`);
  const card = afterShare.body.messages.at(-1);
  assert.deepEqual([card.sender, card.kind, card.contactName, card.contactPhone], ["finder", "contact", "Musa", "0803 123 4567"]);

  // the owner shares back, name only is fine
  assert.equal((await call(owner, "POST", `/api/tags/${id}/threads/${threadId}/contact`, {})).status, 400);
  const back = await call(owner, "POST", `/api/tags/${id}/threads/${threadId}/contact`, { name: "Ada" });
  assert.equal(back.status, 201);
  const finderAfter = await finderCall(code, "GET", "/chat", token);
  const last = finderAfter.body.messages.at(-1);
  assert.deepEqual([last.sender, last.kind, last.contactName, last.contactPhone], ["owner", "contact", "Ada", null]);
});

test("a chat can only be read or written with its own secret token", async () => {
  const a = await activeTag("Owner Four");
  const b = await activeTag("Owner Five");
  const fa = (await finderCall(a.code, "POST", "/chat", null, { message: "Hello from A" })).body.token;
  const fb = (await finderCall(b.code, "POST", "/chat", null, { message: "Hello from B" })).body.token;

  assert.equal((await finderCall(a.code, "GET", "/chat", null)).status, 404, "no token");
  assert.equal((await finderCall(a.code, "GET", "/chat", "x".repeat(32))).status, 404, "made-up token");
  assert.equal((await finderCall(a.code, "GET", "/chat", fb)).status, 404, "another tag's token");
  assert.equal((await finderCall(b.code, "POST", "/chat/messages", fa, { message: "sneaky" })).status, 404);
  assert.equal((await finderCall(a.code, "GET", "/chat", fa)).status, 200);

  // a second finder on the same tag gets a separate chat
  const second = await finderCall(a.code, "POST", "/chat", null, { message: "I'm another finder" });
  const secondView = await finderCall(a.code, "GET", "/chat", second.body.token);
  assert.equal(secondView.body.messages.length, 1);

  // an owner can't see or write into someone else's chat
  const aThreads = (await call(a.owner, "GET", `/api/tags/${a.id}/threads`)).body.threads;
  assert.equal(aThreads.length, 2);
  const bThread = (await call(b.owner, "GET", `/api/tags/${b.id}/threads`)).body.threads[0].id;
  assert.equal((await call(a.owner, "GET", `/api/tags/${a.id}/threads/${bThread}`)).status, 404);
  assert.equal((await call(a.owner, "GET", `/api/tags/${b.id}/threads`)).status, 404);
  assert.equal((await call(a.owner, "POST", `/api/tags/${a.id}/threads/${bThread}/messages`, { message: "hi" })).status, 404);
  assert.equal((await call(a.owner, "DELETE", `/api/tags/${a.id}/threads/${bThread}`)).status, 404);
  assert.equal((await call(null, "GET", `/api/tags/${a.id}/threads`)).status, 401);
});

test("messages are checked: empty, too long, a bot, an unclaimed or paused tag", async () => {
  const owner = makeUser("Owner Six");
  const code = await freshCode();
  assert.equal((await finderCall(code, "POST", "/chat", null, { message: "Hi" })).status, 409, "an unclaimed tag takes no chats");
  const claimed = await call(owner, "POST", "/api/tags/claim", { code, label: "Keys" });
  const id = claimed.body.tag.id;

  for (const message of [undefined, "", "   ", "x".repeat(501)]) {
    assert.equal((await finderCall(code, "POST", "/chat", null, { message })).status, 400, `message ${String(message).slice(0, 5)}`);
  }
  assert.equal((await finderCall("ZZZZZZZZ", "POST", "/chat", null, { message: "Hi" })).status, 404);

  const before = db.prepare("SELECT COUNT(*) n FROM tag_messages").get().n;
  const bot = await finderCall(code, "POST", "/chat", null, { message: "buy now", website: "http://spam.example" });
  assert.equal(bot.status, 201, "a bot is told it worked");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_messages").get().n, before, "but nothing is saved");

  const started = await finderCall(code, "POST", "/chat", null, { message: "Real message" });
  const token = started.body.token;
  const threadId = (await call(owner, "GET", `/api/tags/${id}/threads`)).body.threads[0].id;
  assert.equal((await finderCall(code, "POST", "/chat/messages", token, { message: "" })).status, 400);
  assert.equal((await call(owner, "POST", `/api/tags/${id}/threads/${threadId}/messages`, { message: "x".repeat(501) })).status, 400);

  // text is stored exactly as typed (the app shows it as plain text, never as markup)
  const odd = await finderCall(code, "POST", "/chat/messages", token, { message: "<img src=x onerror=alert(1)>" });
  assert.equal(odd.body.messages.at(-1).body, "<img src=x onerror=alert(1)>");

  // pausing the tag: the finder can still read, but nobody can send
  await call(owner, "PATCH", `/api/tags/${id}`, { status: "paused" });
  assert.equal((await call(null, "GET", `/api/tags/public/${code}`)).body.status, "paused");
  const paused = await finderCall(code, "GET", "/chat", token);
  assert.equal(paused.status, 200);
  assert.equal(paused.body.open, false);
  assert.equal((await finderCall(code, "POST", "/chat/messages", token, { message: "Still there?" })).status, 409);
  assert.equal((await finderCall(code, "POST", "/chat/contact", token, { name: "Musa" })).status, 409);
  assert.equal((await finderCall(code, "POST", "/chat", null, { message: "New person" })).status, 409);
  assert.equal((await call(owner, "POST", `/api/tags/${id}/threads/${threadId}/messages`, { message: "hi" })).status, 409, "owner resumes first");
  await call(owner, "PATCH", `/api/tags/${id}`, { status: "active" });
  assert.equal((await finderCall(code, "POST", "/chat/messages", token, { message: "Back" })).status, 201);
});

test("a tag and a chat can't be flooded", async () => {
  const { code, id } = await activeTag("Owner Seven");
  for (let i = 0; i < 5; i++) assert.equal((await finderCall(code, "POST", "/chat", null, { message: `finder ${i}` })).status, 201);
  const sixth = await finderCall(code, "POST", "/chat", null, { message: "one too many" });
  assert.equal(sixth.status, 429);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_threads WHERE tag_id = ?").get(id).n, 5);

  const { body } = await finderCall(code, "GET", "/chat", null); // no token: nothing leaks about the other chats
  assert.equal(body.messages, undefined);

  const other = await activeTag("Owner Eight");
  const token = (await finderCall(other.code, "POST", "/chat", null, { message: "m1" })).body.token;
  for (let i = 2; i <= 30; i++) assert.equal((await finderCall(other.code, "POST", "/chat/messages", token, { message: `m${i}` })).status, 201);
  assert.equal((await finderCall(other.code, "POST", "/chat/messages", token, { message: "m31" })).status, 429, "30 messages an hour from one finder");
  // the owner is not throttled by the finder's flood and can still answer
  const threadId = (await call(other.owner, "GET", `/api/tags/${other.id}/threads`)).body.threads[0].id;
  assert.equal((await call(other.owner, "POST", `/api/tags/${other.id}/threads/${threadId}/messages`, { message: "Please stop" })).status, 201);
});

test("only the owner can rename, pause, release or delete; releasing and deleting erase the chats", async () => {
  const { owner, code, id } = await activeTag("Owner Nine", "Laptop");
  const stranger = makeUser("Stranger");
  const token = (await finderCall(code, "POST", "/chat", null, { message: "Found it" })).body.token;
  await finderCall(code, "POST", "/chat/contact", token, { name: "Musa", phone: "08031234567" });

  assert.equal((await call(stranger, "PATCH", `/api/tags/${id}`, { label: "Mine now" })).status, 404);
  assert.equal((await call(stranger, "POST", `/api/tags/${id}/release`)).status, 404);
  assert.equal(tagRow(code).label, "Laptop");

  const renamed = await call(owner, "PATCH", `/api/tags/${id}`, { label: "Dell laptop", status: "paused" });
  assert.equal(renamed.body.tag.label, "Dell laptop");
  assert.equal(renamed.body.tag.status, "paused");
  assert.equal((await call(owner, "PATCH", `/api/tags/${id}`, { status: "weird" })).status, 400);
  assert.equal((await call(owner, "PATCH", `/api/tags/${id}`, { status: "active" })).body.tag.status, "active");

  // deleting one chat erases it and its shared number, and the finder's link stops working
  const threadId = (await call(owner, "GET", `/api/tags/${id}/threads`)).body.threads[0].id;
  assert.equal((await call(owner, "DELETE", `/api/tags/${id}/threads/${threadId}`)).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_messages WHERE thread_id = ?").get(threadId).n, 0);
  assert.equal((await finderCall(code, "GET", "/chat", token)).status, 404);

  // releasing the tag erases whatever chats are left and makes it free again
  await finderCall(code, "POST", "/chat", null, { message: "Another finder" });
  assert.equal((await call(owner, "POST", `/api/tags/${id}/release`)).status, 200);
  assert.equal(tagRow(code).owner_id, null);
  assert.equal(tagRow(code).status, "unclaimed");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_threads WHERE tag_id = ?").get(id).n, 0);
  assert.equal((await call(null, "GET", `/api/tags/public/${code}`)).body.status, "unclaimed");
});

test("a tag whose owner deleted their account stops taking chats", async () => {
  const { owner, code } = await activeTag("Leaver");
  db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(owner.id);
  assert.equal((await call(null, "GET", `/api/tags/public/${code}`)).body.status, "inactive");
  assert.equal((await finderCall(code, "POST", "/chat", null, { message: "Hi" })).status, 409);
});

test("deleting an account erases the chats on its tags and retires them", async () => {
  const { owner, code, id } = await activeTag("Quitter");
  const token = (await finderCall(code, "POST", "/chat", null, { message: "Found it" })).body.token;
  await finderCall(code, "POST", "/chat/contact", token, { name: "Musa", phone: "08031234567" });
  const threadId = (await call(owner, "GET", `/api/tags/${id}/threads`)).body.threads[0].id;
  const { retireTagsOf } = require("../src/utils/tags");
  retireTagsOf(db, owner.id);

  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_threads WHERE tag_id = ?").get(id).n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tag_messages WHERE thread_id = ?").get(threadId).n, 0);
  assert.equal(tagRow(code).owner_id, null);
  assert.equal((await call(null, "GET", `/api/tags/public/${code}`)).body.status, "inactive", "a scan says to hand it in");
  assert.equal((await finderCall(code, "POST", "/chat", null, { message: "Hi" })).status, 409);
  assert.equal((await call(admin, "POST", "/api/tags/claim", { code })).status, 409, "and nobody can claim it again");
});
