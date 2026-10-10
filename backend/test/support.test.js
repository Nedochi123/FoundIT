// Messages to the admin: a student writes a complaint from the app; the owner reads every thread and answers it from
// the owner page. Private per student, owner only on the other side, and the right person is told.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-support-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_EMAILS = "owner-support@example.com,other-admin-support@example.com";
delete process.env.MONITOR_EMAILS;
delete process.env.RESEND_API_KEY;

// capture who gets told what, instead of sending anything (patched before the app loads its helpers)
const pushes = [];
const emails = [];
require("../src/utils/push").notifyUser = async (userId, message) => pushes.push({ userId, ...message });
require("../src/utils/email").sendEmail = async (mail) => emails.push(mail);

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

function makeUser(name, email, verified = false) {
  const id = crypto.randomUUID();
  email = email || `${name.toLowerCase().replace(/\W/g, "")}-${id.slice(0, 6)}@example.com`;
  db.prepare("INSERT INTO users (id, name, email, password_hash, email_verified_at) VALUES (?, ?, ?, 'x', ?)").run(id, name, email, verified ? "2026-10-10 08:00:00" : null);
  return { id, name, email, token: signAccessToken({ id, email, name }) };
}
const owner = makeUser("Owner", "owner-support@example.com", true);
const otherAdmin = makeUser("Other Admin", "other-admin-support@example.com", true);
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const ada = makeUser("Ada");
const eve = makeUser("Eve <b>Bold</b>");
let adaThread;

test("a student can write to the admin, with sensible limits, and only signed-in students can", async () => {
  assert.equal((await call(null, "POST", "/api/support", { body: "hello" })).status, 401);
  assert.equal((await call(null, "GET", "/api/support")).status, 401);
  assert.deepEqual((await call(ada, "GET", "/api/support")).body.messages, [], "nothing yet");

  for (const bad of [{}, { body: "" }, { body: "    " }, { body: "x".repeat(1001) }, { body: 42 }]) {
    assert.equal((await call(ada, "POST", "/api/support", bad)).status, 400, JSON.stringify(bad).slice(0, 30));
  }
  const sent = await call(ada, "POST", "/api/support", { body: "  My laptop bag was taken from the library and nobody is helping me.  " });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.message.from, "student");
  assert.equal(sent.body.message.body, "My laptop bag was taken from the library and nobody is helping me.", "tidied");
  assert.equal((await call(ada, "POST", "/api/support", { body: "x".repeat(1000) })).status, 201, "exactly the limit is fine");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM support_threads WHERE user_id = ?").get(ada.id).n, 1, "one thread per student");
  adaThread = db.prepare("SELECT id FROM support_threads WHERE user_id = ?").get(ada.id).id;
});

test("a student sees only their own conversation", async () => {
  await call(eve, "POST", "/api/support", { body: "Eve's separate problem" });
  const adas = (await call(ada, "GET", "/api/support")).body.messages;
  const eves = (await call(eve, "GET", "/api/support")).body.messages;
  assert.equal(adas.length, 2);
  assert.ok(adas.every((m) => !/Eve/.test(m.body)));
  assert.deepEqual(eves.map((m) => m.body), ["Eve's separate problem"]);
});

test("the owner is told about each new message, without the message text", async () => {
  const ownerPush = pushes.filter((p) => p.userId === owner.id);
  assert.ok(ownerPush.length >= 2, "pushed to the owner's devices");
  assert.match(ownerPush[0].title, /New message for the admin/);
  assert.match(ownerPush[0].body, /Ada sent you a message/);
  assert.match(ownerPush[0].url, /\/owner\/$/);
  assert.ok(!pushes.some((p) => /laptop bag/.test(JSON.stringify(p))), "the complaint's text is never put in a notification");
  assert.ok(!pushes.some((p) => p.userId === otherAdmin.id), "other admins are not told");

  const mail = emails.find((m) => /Eve/.test(m.subject));
  assert.equal(mail.to, "owner-support@example.com");
  assert.ok(!/<b>Bold<\/b>/.test(mail.html), "a student's name can't inject HTML into the email");
  assert.match(mail.html, /Eve &lt;b&gt;Bold&lt;\/b&gt;/);
  assert.ok(!emails.some((m) => /laptop bag/.test(m.html)), "the complaint's text is not in the email");
});

test("only the owner can open the Messages section", async () => {
  for (const [method, url, body] of [["GET", "/api/monitor/support"], ["GET", `/api/monitor/support/${adaThread}`], ["POST", `/api/monitor/support/${adaThread}/reply`, { body: "hi" }]]) {
    assert.equal((await call(null, method, url, body)).status, 401, `${url} signed out`);
    assert.equal((await call(ada, method, url, body)).status, 404, `${url} as a student`);
    assert.equal((await call(otherAdmin, method, url, body)).status, 404, `${url} as another admin`);
  }
});

test("the owner sees every thread with unread counts, and opening one marks it read", async () => {
  const list = (await call(owner, "GET", "/api/monitor/support")).body;
  assert.equal(list.unreadTotal, 3);
  const adas = list.threads.find((t) => t.id === adaThread);
  assert.equal(adas.name, "Ada");
  assert.equal(adas.unread, 2);
  assert.equal(adas.lastFrom, "student");
  assert.equal(list.threads.length, 2);

  const opened = (await call(owner, "GET", `/api/monitor/support/${adaThread}`)).body;
  assert.equal(opened.student.name, "Ada");
  assert.equal(opened.messages.length, 2);
  assert.match(opened.messages[0].body, /laptop bag/, "full text, in order");
  assert.equal((await call(owner, "GET", "/api/monitor/support")).body.unreadTotal, 1, "Ada's two are now read, Eve's one is not");
  assert.equal((await call(owner, "GET", "/api/monitor/support/nope")).status, 404);
});

test("the owner replies, the student is told and sees it, and replies are never logged as student activity", async () => {
  for (const bad of [{}, { body: " " }, { body: "x".repeat(1001) }]) {
    assert.equal((await call(owner, "POST", `/api/monitor/support/${adaThread}/reply`, bad)).status, 400);
  }
  assert.equal((await call(owner, "POST", "/api/monitor/support/nope/reply", { body: "hi" })).status, 404);

  assert.equal((await call(ada, "GET", "/api/support/unread")).body.unread, 0);
  const reply = await call(owner, "POST", `/api/monitor/support/${adaThread}/reply`, { body: "I'm sorry. Please come to the admin block now and I'll help you." });
  assert.equal(reply.status, 201);
  assert.equal(reply.body.message.from, "admin");

  const told = pushes.find((p) => p.userId === ada.id);
  assert.match(told.title, /The FoundIT admin replied/);
  assert.equal(told.url, "/?support=1");
  assert.ok(!/come to the admin block/.test(JSON.stringify(told)), "the reply's text isn't in the notification");

  assert.equal((await call(ada, "GET", "/api/support/unread")).body.unread, 1);
  const mine = (await call(ada, "GET", "/api/support")).body.messages;
  assert.deepEqual(mine.map((m) => m.from), ["student", "student", "admin"], "in order");
  assert.equal((await call(ada, "GET", "/api/support/unread")).body.unread, 0, "reading it clears the badge");
  assert.equal((await call(eve, "GET", "/api/support")).body.messages.some((m) => m.from === "admin"), false, "Eve got no reply");

  const owners = db.prepare("SELECT action FROM activity_log WHERE user_id = ?").all(owner.id).map((r) => r.action);
  assert.ok(!owners.some((a) => /reply|support/i.test(a)), "the owner's replies are not recorded as activity");
  const adasLog = db.prepare("SELECT action FROM activity_log WHERE user_id = ?").all(ada.id).map((r) => r.action);
  assert.ok(adasLog.includes("Sent a message to the admin"));
});

test("deleting a student's account removes their conversation with the admin", () => {
  db.prepare("DELETE FROM users WHERE id = ?").run(eve.id);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM support_threads WHERE user_id = ?").get(eve.id).n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM support_messages WHERE body = 'Eve''s separate problem'").get().n, 0);
});
