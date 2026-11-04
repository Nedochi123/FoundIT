// Editing and deleting your own posts: the Update and Delete halves of CRUD for lost and found items. Only the poster may
// change or remove a post; bad input is refused with a clear message; records that money or confirmed returns depend on
// are kept; a deleted found item takes its photo with it.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "foundit-crud-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(tmp, "test.db");
process.env.UPLOAD_ROOT = path.join(tmp, "uploads");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
delete process.env.RESEND_API_KEY;
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

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

const uid = () => crypto.randomUUID();
function makeUser(name) {
  const id = uid();
  const email = `${name.toLowerCase()}-${id.slice(0, 6)}@example.com`;
  db.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, 'x')").run(id, name, email);
  return { id, name, email, token: signAccessToken({ id, email, name }) };
}
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const lostRow = (id) => db.prepare("SELECT * FROM lost_items WHERE id = ?").get(id);
function makeFound(user, { confirmed = false } = {}) {
  const id = uid();
  const name = `${uid()}.jpg`;
  const dir = path.join(process.env.UPLOAD_ROOT, "found-items");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), "not really a photo");
  db.prepare(
    "INSERT INTO found_items (id, poster_id, photo_url, description, location, category, return_confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, user.id, `/uploads/found-items/${name}`, "Black water bottle", "Lecture Hall B", "bottle", confirmed ? "2026-11-01 10:00:00" : null);
  return { id, file: path.join(dir, name) };
}

test("the poster edits a lost post, and the change is saved in the database", async () => {
  const tunde = makeUser("Tunde");
  const made = await call(tunde, "POST", "/api/lost-items", { description: "Black water bottle", location: "Lecture Hall B" });
  assert.equal(made.status, 201);
  const id = made.body.item.id;

  const edited = await call(tunde, "PATCH", `/api/lost-items/${id}`, { description: "Black steel water bottle with a dent", location: "Lecture Hall B, back row" });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.item.description, "Black steel water bottle with a dent");
  assert.equal(lostRow(id).location, "Lecture Hall B, back row"); // really in the database, not just in the reply

  const list = await call(tunde, "GET", "/api/lost-items");
  assert.ok(list.body.items.some((i) => i.id === id && i.description === "Black steel water bottle with a dent"));
});

test("editing is refused for someone else's post, bad input, a closed post and a post that does not exist", async () => {
  const tunde = makeUser("Tunde");
  const chioma = makeUser("Chioma");
  const id = (await call(tunde, "POST", "/api/lost-items", { description: "Blue umbrella" })).body.item.id;

  assert.equal((await call(null, "PATCH", `/api/lost-items/${id}`, { description: "x" })).status, 401);
  assert.equal((await call(chioma, "PATCH", `/api/lost-items/${id}`, { description: "Mine now" })).status, 403);
  const empty = await call(tunde, "PATCH", `/api/lost-items/${id}`, { description: "   " });
  assert.equal(empty.status, 400);
  assert.match(empty.body.error, /Describe what you lost/);
  assert.equal((await call(tunde, "PATCH", `/api/lost-items/${id}`, { description: "Umbrella", category: "Spaceships" })).status, 400);
  assert.equal(lostRow(id).description, "Blue umbrella"); // nothing bad was saved

  assert.equal((await call(tunde, "PATCH", "/api/lost-items/does-not-exist", { description: "x" })).status, 404);
  await call(tunde, "PATCH", `/api/lost-items/${id}/resolve`);
  assert.equal((await call(tunde, "PATCH", `/api/lost-items/${id}`, { description: "Too late" })).status, 409);
});

test("the poster deletes a lost post: it is gone from the database and the list", async () => {
  const tunde = makeUser("Tunde");
  const chioma = makeUser("Chioma");
  const id = (await call(tunde, "POST", "/api/lost-items", { description: "Duplicate post" })).body.item.id;

  assert.equal((await call(chioma, "DELETE", `/api/lost-items/${id}`)).status, 403);
  assert.ok(lostRow(id), "someone else cannot delete it");

  assert.deepEqual((await call(tunde, "DELETE", `/api/lost-items/${id}`)).body, { ok: true });
  assert.equal(lostRow(id), undefined);
  const list = await call(tunde, "GET", "/api/lost-items");
  assert.ok(!list.body.items.some((i) => i.id === id));

  const again = await call(tunde, "DELETE", `/api/lost-items/${id}`);
  assert.equal(again.status, 404); // deleting something that is not there
  assert.match(again.body.error, /not found/i);
});

test("a boosted lost post keeps its record (a payment is tied to it)", async () => {
  const tunde = makeUser("Tunde");
  const id = (await call(tunde, "POST", "/api/lost-items", { description: "Laptop charger" })).body.item.id;
  db.prepare("INSERT INTO boosts (id, lost_item_id, user_id, plan, hours, amount, reference) VALUES (?, ?, ?, '24h', 24, 500, ?)").run(uid(), id, tunde.id, uid());
  const refused = await call(tunde, "DELETE", `/api/lost-items/${id}`);
  assert.equal(refused.status, 409);
  assert.match(refused.body.error, /resolved/);
  assert.ok(lostRow(id));
});

test("the poster edits and deletes a found post; the photo file goes with it", async () => {
  const chioma = makeUser("Chioma");
  const tunde = makeUser("Tunde");
  const { id, file } = makeFound(chioma);

  assert.equal((await call(tunde, "PATCH", `/api/found-items/${id}`, { description: "x" })).status, 403);
  const edited = await call(chioma, "PATCH", `/api/found-items/${id}`, { description: "Black bottle with a sticker", category: "bottle" });
  assert.equal(edited.status, 200);
  assert.equal(db.prepare("SELECT description FROM found_items WHERE id = ?").get(id).description, "Black bottle with a sticker");

  assert.equal((await call(tunde, "DELETE", `/api/found-items/${id}`)).status, 403);
  assert.equal((await call(chioma, "DELETE", `/api/found-items/${id}`)).status, 200);
  assert.equal(db.prepare("SELECT 1 FROM found_items WHERE id = ?").get(id), undefined);
  for (let i = 0; i < 40 && fs.existsSync(file); i++) await new Promise((r) => setTimeout(r, 25));
  assert.equal(fs.existsSync(file), false);
});

test("a found post whose return was confirmed is kept (tokens and the Wall of Reunions depend on it)", async () => {
  const chioma = makeUser("Chioma");
  const { id, file } = makeFound(chioma, { confirmed: true });
  const refused = await call(chioma, "DELETE", `/api/found-items/${id}`);
  assert.equal(refused.status, 409);
  assert.ok(db.prepare("SELECT 1 FROM found_items WHERE id = ?").get(id));
  assert.ok(fs.existsSync(file));
});
