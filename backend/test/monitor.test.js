// The owner's security view: what students did and where their phone said it was, and the chats. Only the owner's
// account can open it, it is read only, and what it stores is limited (no passwords, no message text in the log).
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-monitor-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
// the FIRST admin is the owner; the second only reviews cash-outs and must not see the monitor
process.env.ADMIN_EMAILS = "owner-mon@example.com,other-admin@example.com";
delete process.env.MONITOR_EMAILS;
delete process.env.MONITOR_SHOW_NUMBERS;
delete process.env.RESEND_API_KEY;

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");
const { parseGeo, maskNumbers, purgeOldActivity, monitorEmails } = require("../src/utils/monitor");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const uid = () => crypto.randomUUID();
function makeUser(name, email) {
  const id = uid();
  email = email || `${name.toLowerCase().replace(/\W/g, "")}-${id.slice(0, 6)}@example.com`;
  db.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, 'x')").run(id, name, email);
  return { id, name, email, token: signAccessToken({ id, email, name }) };
}
const owner = makeUser("Owner", "owner-mon@example.com");
const otherAdmin = makeUser("Other Admin", "other-admin@example.com");
for (const u of [owner, otherAdmin]) db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(u.id); // admins need a verified email
const call = async (user, method, url, body, headers = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const logged = (user) => db.prepare("SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at, rowid").all(user.id);
// activity is written when the response finishes, a moment after the client has it
const settle = () => new Promise((r) => setTimeout(r, 60));

test("the phone's location is read carefully and rounded", () => {
  assert.deepEqual(parseGeo("9.07845671,7.39851234,18.4"), { lat: 9.0785, lng: 7.3985, accuracy: 18 });
  assert.deepEqual(parseGeo(" -33.8688 , 151.2093 "), { lat: -33.8688, lng: 151.2093, accuracy: null });
  for (const bad of [undefined, "", "hello", "91,0", "0,181", "1,2,3,4", "1;2", "NaN,1", "9.07,7.39,-5"]) {
    assert.equal(parseGeo(bad), null, `refuses ${JSON.stringify(bad)}`);
  }
  assert.equal(parseGeo("1,2,999999").accuracy, 100000, "an absurd accuracy is capped");
  assert.equal(parseGeo("1,2,9999999"), null, "and a longer one is refused outright");
});

test("long numbers are hidden down to their last 4 digits", () => {
  assert.equal(maskNumbers("send it to 0123456789 please"), "send it to •••• 6789 please");
  assert.equal(maskNumbers("call 0803 123 4567 or +234 803 123 4567"), "call •••• 4567 or •••• 4567");
  assert.equal(maskNumbers("account 0123-4567-89"), "account •••• 6789");
  assert.equal(maskNumbers("Room 204, 2 keys, 15000 naira"), "Room 204, 2 keys, 15000 naira", "short numbers stay");
  assert.equal(maskNumbers(null), null);
});

test("only the owner can open the monitor; everyone else is told there is nothing there", async () => {
  const student = makeUser("Student");
  assert.deepEqual(monitorEmails(), ["owner-mon@example.com"]);
  for (const url of ["/api/monitor/activity", "/api/monitor/people", "/api/monitor/chats", "/api/monitor/access-log"]) {
    assert.equal((await call(null, "GET", url)).status, 401, `${url} signed out`);
    assert.equal((await call(student, "GET", url)).status, 404, `${url} as a student`);
    assert.equal((await call(otherAdmin, "GET", url)).status, 404, `${url} as another admin`);
    assert.equal((await call(owner, "GET", url)).status, 200, `${url} as the owner`);
  }
  assert.equal((await call(owner, "GET", "/api/auth/me")).body.user.isMonitor, true);
  assert.equal((await call(otherAdmin, "GET", "/api/auth/me")).body.user.isMonitor, false);
  assert.equal((await call(student, "GET", "/api/auth/me")).body.user.isMonitor, false);
  // it can only read
  assert.equal((await call(owner, "POST", "/api/monitor/activity", {})).status, 404);
  assert.equal((await call(owner, "DELETE", "/api/monitor/chats/item/x")).status, 404);
});

test("what a student does is logged with where their phone said it was, and nothing sensitive", async () => {
  const ada = makeUser("Ada");
  const geo = { "X-Geo": "9.07845671,7.39851234,18" };

  assert.equal((await call(ada, "POST", "/api/lost-items", { description: "Black laptop bag with a red keychain", location: "Library" }, geo)).status, 201);
  await call(ada, "POST", "/api/lost-items", { description: "" }, geo); // refused (400): not logged
  await call(ada, "GET", "/api/lost-items", undefined, geo); // reading is not logged
  await call(ada, "POST", "/api/activity/checkin", undefined, geo);
  await call(ada, "POST", "/api/activity/checkin", undefined, geo); // same 10 minutes: not logged again
  await call(ada, "POST", "/api/reports", { targetType: "lost_item", targetId: "nothing", reason: "spam" }); // no location sent
  await settle();

  const rows = logged(ada);
  assert.deepEqual(rows.map((r) => r.action), ["Posted a lost item", "Opened the app", "Reported a post or person"].slice(0, rows.length));
  assert.equal(rows[0].detail, "Black laptop bag with a red keychain");
  assert.deepEqual([rows[0].lat, rows[0].lng, rows[0].accuracy], [9.0785, 7.3985, 18], "rounded to about 11 m");
  assert.equal(rows.filter((r) => r.action === "Opened the app").length, 1);
  const last = rows.find((r) => r.action.startsWith("Reported")) || rows.at(-1);
  if (last.action.startsWith("Reported")) assert.equal(last.lat, null, "no location sent, none stored");
});

test("sign-up and sign-in are logged by name, and a password never reaches the log", async () => {
  const password = "Sup3r-Secret-Pass!";
  const email = `grace-${uid().slice(0, 6)}@nileuniversity.edu.ng`;
  const made = await call(null, "POST", "/api/auth/signup", { name: "Grace", email, password }, { "X-Geo": "9.1,7.4,30" });
  assert.equal(made.status, 201);
  assert.equal((await call(null, "POST", "/api/auth/login", { email, password: "wrong password" })).status, 401);
  assert.equal((await call(null, "POST", "/api/auth/login", { email, password })).status, 200);
  await settle();

  const grace = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  const rows = db.prepare("SELECT * FROM activity_log WHERE user_id = ? ORDER BY rowid").all(grace.id);
  assert.deepEqual(rows.map((r) => r.action), ["Created an account", "Signed in"], "the wrong-password attempt is not logged as a sign-in");
  assert.equal(rows[0].lat, 9.1);
  const everything = JSON.stringify(db.prepare("SELECT * FROM activity_log").all());
  assert.ok(!everything.includes(password) && !everything.includes("Sup3r"), "no password anywhere in the log");
});

test("the owner can browse, filter and page through the activity", async () => {
  const batch = makeUser("Batch Person");
  for (let i = 0; i < 7; i++) {
    db.prepare("INSERT INTO activity_log (id, user_id, action, detail, created_at) VALUES (?, ?, 'Posted a found item', ?, datetime('now', ?))").run(uid(), batch.id, `Item ${i}`, `-${i} minutes`);
  }
  const page1 = (await call(owner, "GET", `/api/monitor/activity?user=${batch.id}&limit=3`)).body;
  assert.equal(page1.items.length, 3);
  assert.deepEqual(page1.items.map((i) => i.detail), ["Item 0", "Item 1", "Item 2"], "newest first");
  assert.equal(page1.items[0].userName, "Batch Person");
  assert.ok(page1.next);
  const page2 = (await call(owner, "GET", `/api/monitor/activity?user=${batch.id}&limit=3&before=${encodeURIComponent(page1.next)}`)).body;
  assert.deepEqual(page2.items.map((i) => i.detail), ["Item 3", "Item 4", "Item 5"]);
  const page3 = (await call(owner, "GET", `/api/monitor/activity?user=${batch.id}&limit=3&before=${encodeURIComponent(page2.next)}`)).body;
  assert.deepEqual(page3.items.map((i) => i.detail), ["Item 6"]);
  assert.equal(page3.next, null);
  assert.equal((await call(owner, "GET", "/api/monitor/activity?q=Batch%20Person&limit=200")).body.items.every((i) => i.userName === "Batch Person"), true);
  assert.equal((await call(owner, "GET", "/api/monitor/activity?q=%25")).body.items.length, 0, "a % in the search is just text");
});

test("people list shows the last place each person was seen and how many actions had no location", async () => {
  const ife = makeUser("Ife");
  db.prepare("INSERT INTO activity_log (id, user_id, action, lat, lng, accuracy, created_at) VALUES (?, ?, 'Opened the app', 9.0, 7.0, 20, datetime('now', '-2 hours'))").run(uid(), ife.id);
  db.prepare("INSERT INTO activity_log (id, user_id, action, lat, lng, accuracy, created_at) VALUES (?, ?, 'Posted a found item', 9.5, 7.5, 10, datetime('now', '-1 hours'))").run(uid(), ife.id);
  db.prepare("INSERT INTO activity_log (id, user_id, action, created_at) VALUES (?, ?, 'Sent a chat message', datetime('now'))").run(uid(), ife.id);
  const person = (await call(owner, "GET", "/api/monitor/people?q=Ife")).body.people.find((p) => p.id === ife.id);
  assert.equal(person.actions, 3);
  assert.equal(person.actionsWithoutLocation, 1);
  assert.deepEqual([person.lastLocation.lat, person.lastLocation.lng], [9.5, 7.5], "the most recent place, not the last action");
});

test("the owner can read item chats and QR tag chats, without marking anything as read, and every opening is recorded", async () => {
  const finder = makeUser("Finder");
  const seeker = makeUser("Seeker");
  const itemId = uid();
  db.prepare("INSERT INTO found_items (id, poster_id, photo_url, description, location) VALUES (?, ?, '/uploads/x.jpg', 'A grey wallet', 'Cafeteria')").run(itemId, finder.id);
  const convo = uid();
  db.prepare("INSERT INTO conversations (id, found_item_id, finder_id, seeker_id) VALUES (?, ?, ?, ?)").run(convo, itemId, finder.id, seeker.id);
  for (const [sender, body, at] of [
    [seeker.id, "Hi, I think that wallet is mine", "-3 minutes"],
    [finder.id, "Sure. Send your account number 0123456789 for the reward", "-2 minutes"],
  ]) {
    db.prepare("INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, datetime('now', ?))").run(uid(), convo, sender, body, at);
  }

  const tagOwner = makeUser("Tag Owner");
  const tagId = uid();
  db.prepare("INSERT INTO tags (id, code, owner_id, label, status) VALUES (?, 'ABCD-1234', ?, 'My keys', 'active')").run(tagId, tagOwner.id);
  const thread = uid();
  db.prepare("INSERT INTO tag_threads (id, tag_id, finder_token_hash) VALUES (?, ?, ?)").run(thread, tagId, uid());
  db.prepare("INSERT INTO tag_messages (id, thread_id, sender, kind, body) VALUES (?, ?, 'finder', 'text', 'I found your keys near the gate')").run(uid(), thread);
  db.prepare("INSERT INTO tag_messages (id, thread_id, sender, kind, contact_name, contact_phone) VALUES (?, ?, 'finder', 'contact', 'Musa', '08031234567')").run(uid(), thread);

  const list = (await call(owner, "GET", "/api/monitor/chats")).body.chats;
  const item = list.find((c) => c.id === convo);
  assert.equal(item.kind, "item");
  assert.match(item.people, /Finder .*Seeker/);
  assert.equal(item.messageCount, 2);
  assert.match(item.lastMessage, /•••• 6789/, "the account number is hidden in the list too");
  assert.ok(list.find((c) => c.id === thread && c.kind === "tag" && /ABCD-1234/.test(c.title)));
  assert.equal((await call(owner, "GET", "/api/monitor/chats?q=wallet")).body.chats.some((c) => c.id === convo), true, "search finds the item");
  assert.equal((await call(owner, "GET", "/api/monitor/chats?q=near%20the%20gate")).body.chats.some((c) => c.id === thread), true, "and the message text");

  const opened = (await call(owner, "GET", `/api/monitor/chats/item/${convo}`)).body;
  assert.equal(opened.item.description, "A grey wallet");
  assert.deepEqual(opened.messages.map((m) => m.senderName), ["Seeker", "Finder"]);
  assert.match(opened.messages[1].body, /account number •••• 6789 for the reward/);
  assert.ok(!JSON.stringify(opened).includes("0123456789"), "the full number never leaves the server");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND read_at IS NOT NULL").get(convo).n, 0, "nothing was marked as read");

  const tag = (await call(owner, "GET", `/api/monitor/chats/tag/${thread}`)).body;
  assert.equal(tag.tag.code, "ABCD-1234");
  assert.equal(tag.owner.name, "Tag Owner");
  assert.equal(tag.messages[1].contactName, "Musa");
  assert.equal(tag.messages[1].contactPhone, "•••• 4567");

  assert.equal((await call(owner, "GET", "/api/monitor/chats/item/nope")).status, 404);
  assert.equal((await call(otherAdmin, "GET", `/api/monitor/chats/item/${convo}`)).status, 404, "nobody else can open it");
  const trail = (await call(owner, "GET", "/api/monitor/access-log")).body.items;
  assert.equal(trail.filter((t) => t.targetId === convo).length, 1);
  assert.equal(trail.filter((t) => t.targetId === thread).length, 1);
});

test("numbers can be shown in full only by switching the safeguard off on the server", async () => {
  const a = makeUser("Num A");
  const b = makeUser("Num B");
  const itemId = uid();
  db.prepare("INSERT INTO found_items (id, poster_id, photo_url, description) VALUES (?, ?, '/x.jpg', 'Phone')").run(itemId, a.id);
  const convo = uid();
  db.prepare("INSERT INTO conversations (id, found_item_id, finder_id, seeker_id) VALUES (?, ?, ?, ?)").run(convo, itemId, a.id, b.id);
  db.prepare("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, 'call 08031234567')").run(uid(), convo, a.id);
  process.env.MONITOR_SHOW_NUMBERS = "1";
  try {
    assert.match((await call(owner, "GET", `/api/monitor/chats/item/${convo}`)).body.messages[0].body, /08031234567/);
  } finally {
    delete process.env.MONITOR_SHOW_NUMBERS;
  }
});

test("old activity is deleted, and deleting an account deletes its activity", () => {
  const dana = makeUser("Dana");
  db.prepare("INSERT INTO activity_log (id, user_id, action, created_at) VALUES (?, ?, 'Old thing', datetime('now', '-91 days'))").run(uid(), dana.id);
  db.prepare("INSERT INTO activity_log (id, user_id, action, created_at) VALUES (?, ?, 'Recent thing', datetime('now', '-89 days'))").run(uid(), dana.id);
  db.prepare("INSERT INTO monitor_access_log (id, user_id, what, created_at) VALUES (?, ?, 'opened an item chat', datetime('now', '-1 days'))").run(uid(), owner.id);
  const purged = purgeOldActivity();
  assert.ok(purged.activity >= 1);
  assert.deepEqual(db.prepare("SELECT action FROM activity_log WHERE user_id = ?").all(dana.id).map((r) => r.action), ["Recent thing"]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM monitor_access_log WHERE created_at > datetime('now', '-2 days')").get().n >= 1, true, "the owner's trail is kept longer");

  db.prepare("DELETE FROM users WHERE id = ?").run(dana.id);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM activity_log WHERE user_id = ?").get(dana.id).n, 0);
});
