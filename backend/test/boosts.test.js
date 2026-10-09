// Paid boosts for lost posts: a student pays by bank transfer, the admin approves, the post is pinned for a while.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-boosts-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_EMAILS = "admin-boost@example.com";
delete process.env.RESEND_API_KEY;

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");
const { BOOST_PLANS, newReference } = require("../src/utils/boosts");

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
const admin = makeUser("Admin", "admin-boost@example.com");
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const lostPost = (user, description = "Black umbrella") => {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO lost_items (id, poster_id, description) VALUES (?, ?, ?)").run(id, user.id, description);
  return id;
};
const PAY = { bank: "GTBank", accountNumber: "0123 456 789", accountName: "Nedochi Publications" };
const boostRow = (id) => db.prepare("SELECT * FROM boosts WHERE id = ?").get(id);

test("the plans, and references that are easy to read out", () => {
  assert.deepEqual(BOOST_PLANS.map((p) => [p.id, p.hours]), [["1d", 24], ["3d", 72], ["7d", 168]]);
  assert.ok(BOOST_PLANS.every((p) => Number.isInteger(p.amount) && p.amount > 0));
  const refs = Array.from({ length: 300 }, newReference);
  assert.ok(refs.every((r) => /^BST-[2-9A-HJ-NP-Z]{6}$/.test(r)));
  assert.equal(new Set(refs).size, 300, "no repeats");
});

test("boosts stay off until the admin has typed in the bank account; only an admin can do that", async () => {
  const ada = makeUser("Ada");
  const post = lostPost(ada);
  assert.equal((await call(ada, "GET", "/api/boosts/plans")).body.enabled, false);
  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "1d" })).status, 503);

  assert.equal((await call(null, "GET", "/api/boosts/plans")).status, 401);
  assert.equal((await call(ada, "PUT", "/api/boosts/admin/settings", PAY)).status, 403);
  assert.equal((await call(ada, "GET", "/api/boosts/admin")).status, 403);
  for (const bad of [{}, { ...PAY, accountNumber: "12ab" }, { ...PAY, accountNumber: "123" }, { ...PAY, bank: "" }, { ...PAY, accountName: "x" }]) {
    assert.equal((await call(admin, "PUT", "/api/boosts/admin/settings", bad)).status, 400, JSON.stringify(bad));
  }
  const saved = await call(admin, "PUT", "/api/boosts/admin/settings", PAY);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.settings.accountNumber, "0123456789", "spaces are tidied away");
  assert.equal((await call(ada, "GET", "/api/boosts/plans")).body.enabled, true);
});

test("a student starts a boost on their own open post, and sees where to pay", async () => {
  const ada = makeUser("Ada Two");
  const other = makeUser("Other");
  const post = lostPost(ada);

  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "9d" })).status, 400, "unknown plan");
  assert.equal((await call(ada, "POST", "/api/boosts", { plan: "1d" })).status, 400, "no post");
  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: "nope", plan: "1d" })).status, 404);
  assert.equal((await call(other, "POST", "/api/boosts", { lostItemId: post, plan: "1d" })).status, 403, "not their post");

  const made = await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "3d" });
  assert.equal(made.status, 201);
  const b = made.body.boost;
  assert.match(b.reference, /^BST-/);
  assert.equal(b.amount, 700);
  assert.equal(b.hours, 72);
  assert.equal(b.state, "awaiting_payment");
  assert.deepEqual(b.paymentDetails, { bank: "GTBank", accountNumber: "0123456789", accountName: "Nedochi Publications" });

  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "1d" })).status, 409, "one boost at a time per post");
  // nobody else can read or act on it
  assert.equal((await call(other, "GET", `/api/boosts/${b.id}`)).status, 404);
  assert.equal((await call(other, "POST", `/api/boosts/${b.id}/paid`, {})).status, 404);
  assert.equal((await call(other, "POST", `/api/boosts/${b.id}/cancel`)).status, 404);
  assert.equal((await call(ada, "GET", `/api/boosts/${b.id}`)).body.boost.reference, b.reference);

  // a post already marked found can't be boosted
  db.prepare("UPDATE lost_items SET status = 'resolved' WHERE id = ?").run(post);
  await call(ada, "POST", `/api/boosts/${b.id}/cancel`);
  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "1d" })).status, 409);
});

test("at most three boosts can be waiting at once", async () => {
  const ada = makeUser("Busy Ada");
  const posts = [1, 2, 3, 4].map((n) => lostPost(ada, `Thing ${n}`));
  for (const p of posts.slice(0, 3)) assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: p, plan: "1d" })).status, 201);
  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: posts[3], plan: "1d" })).status, 429);
});

test("paid -> approved: the post goes live for the plan's length, pinned first, and only its owner sees the boost details", async () => {
  const ada = makeUser("Ada Three");
  const other = makeUser("Other Two");
  const older = lostPost(other, "An older post by someone else");
  const post = lostPost(ada, "Blue backpack with a dented bottle");
  db.prepare("UPDATE lost_items SET created_at = datetime('now', '-5 days') WHERE id = ?").run(post);
  const b = (await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "1d" })).body.boost;

  // not boosted yet: newest first
  const before = await call(other, "GET", "/api/lost-items");
  assert.ok(before.body.items.findIndex((i) => i.id === older) < before.body.items.findIndex((i) => i.id === post));

  assert.equal((await call(ada, "POST", `/api/boosts/${b.id}/cancel`)).status, 200, "can back out before paying");
  const again = (await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "1d" })).body.boost;

  const claimed = await call(ada, "POST", `/api/boosts/${again.id}/paid`, { note: "Sent from Ada's GTB app" });
  assert.equal(claimed.body.boost.state, "payment_claimed");
  assert.equal((await call(ada, "POST", `/api/boosts/${again.id}/paid`, {})).status, 409, "only once");
  assert.equal((await call(ada, "POST", `/api/boosts/${again.id}/cancel`)).status, 409, "can't cancel after saying paid");
  assert.equal((await call(ada, "POST", `/api/boosts/${again.id}/paid`, { note: "x".repeat(121) })).status, 400, "a too-long note is refused");

  // the admin sees it waiting
  const overview = await call(admin, "GET", "/api/boosts/admin");
  const waiting = overview.body.queue.find((q) => q.id === again.id);
  assert.equal(waiting.state, "payment_claimed");
  assert.equal(waiting.payerNote, "Sent from Ada's GTB app");
  assert.equal(waiting.requester.name, "Ada Three");
  assert.equal(waiting.reference, again.reference);

  // a student can't approve their own boost
  assert.equal((await call(ada, "POST", `/api/boosts/admin/${again.id}/approve`)).status, 403);
  assert.equal((await call(null, "POST", `/api/boosts/admin/${again.id}/approve`)).status, 401);
  assert.equal((await call(admin, "POST", "/api/boosts/admin/does-not-exist/approve")).status, 404);

  const revenueBefore = (await call(admin, "GET", "/api/boosts/admin")).body.revenue;
  const approved = await call(admin, "POST", `/api/boosts/admin/${again.id}/approve`);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.boost.state, "live");
  const row = boostRow(again.id);
  const hours = db.prepare("SELECT ROUND((julianday(?) - julianday(?)) * 24) AS h").get(row.expires_at, row.starts_at).h;
  assert.equal(hours, 24, "a 24-hour plan lasts 24 hours");
  assert.equal((await call(admin, "POST", `/api/boosts/admin/${again.id}/approve`)).status, 409, "only once");
  assert.equal((await call(admin, "POST", `/api/boosts/admin/${again.id}/reject`, {})).status, 409);

  const revenueAfter = (await call(admin, "GET", "/api/boosts/admin")).body.revenue;
  assert.equal(revenueAfter.total - revenueBefore.total, 300);
  assert.equal(revenueAfter.count - revenueBefore.count, 1);

  // pinned above a newer post, flagged, and the details of the boost are the owner's alone
  const list = await call(other, "GET", "/api/lost-items");
  const ids = list.body.items.map((i) => i.id);
  assert.equal(ids[0], post, "boosted post is first even though it is the oldest");
  const mineItem = (await call(ada, "GET", "/api/lost-items")).body.items.find((i) => i.id === post);
  const theirView = list.body.items.find((i) => i.id === post);
  assert.ok(theirView.boostedUntil);
  assert.equal(theirView.boost, undefined, "others never see the reference or amount");
  assert.equal(mineItem.boost.state, "live");
  assert.equal(mineItem.boost.reference, again.reference);
  assert.equal((await call(ada, "GET", `/api/boosts/${again.id}`)).body.boost.paymentDetails, null, "no payment details once it is paid for");
  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "1d" })).status, 409, "already boosted");
});

test("a boost that ends stops pinning, and the post can be boosted again", async () => {
  const ada = makeUser("Ada Four");
  const post = lostPost(ada);
  const b = (await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "1d" })).body.boost;
  await call(admin, "POST", `/api/boosts/admin/${b.id}/approve`);
  assert.ok((await call(ada, "GET", "/api/lost-items")).body.items.find((i) => i.id === post).boostedUntil);

  db.prepare("UPDATE boosts SET expires_at = datetime('now', '-1 minute') WHERE id = ?").run(b.id);
  const item = (await call(ada, "GET", "/api/lost-items")).body.items.find((i) => i.id === post);
  assert.equal(item.boostedUntil, null);
  assert.equal(item.boost, undefined);
  assert.equal((await call(ada, "GET", `/api/boosts/${b.id}`)).body.boost.state, "ended");
  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "7d" })).status, 201, "can boost again");
});

test("the admin can reject a boost with a reason, and the student can try again", async () => {
  const ada = makeUser("Ada Five");
  const post = lostPost(ada);
  const b = (await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "3d" })).body.boost;
  await call(ada, "POST", `/api/boosts/${b.id}/paid`, {});
  assert.equal((await call(ada, "POST", `/api/boosts/admin/${b.id}/reject`, { reason: "x" })).status, 403);
  const rejected = await call(admin, "POST", `/api/boosts/admin/${b.id}/reject`, { reason: "We couldn't find a payment of that amount" });
  assert.equal(rejected.status, 200);
  const mine = (await call(ada, "GET", `/api/boosts/${b.id}`)).body.boost;
  assert.equal(mine.state, "rejected");
  assert.equal(mine.rejectReason, "We couldn't find a payment of that amount");
  assert.equal(mine.paymentDetails, null);
  const item = (await call(ada, "GET", "/api/lost-items")).body.items.find((i) => i.id === post);
  assert.equal(item.boostedUntil, null);
  assert.equal(item.boost, undefined, "a rejected boost no longer shows on the post");
  assert.equal((await call(ada, "POST", "/api/boosts", { lostItemId: post, plan: "3d" })).status, 201);
});

test("approving is refused if the post was already marked found; unpaid boosts lapse after two days", async () => {
  const ada = makeUser("Ada Six");
  const found = lostPost(ada, "Found already");
  const b = (await call(ada, "POST", "/api/boosts", { lostItemId: found, plan: "1d" })).body.boost;
  await call(ada, "POST", `/api/boosts/${b.id}/paid`, {});
  db.prepare("UPDATE lost_items SET status = 'resolved' WHERE id = ?").run(found);
  const refused = await call(admin, "POST", `/api/boosts/admin/${b.id}/approve`);
  assert.equal(refused.status, 409);
  assert.match(refused.body.error, /marked found/);
  assert.equal(boostRow(b.id).status, "payment_claimed", "nothing was activated");

  const stale = lostPost(ada, "Never paid for");
  const s = (await call(ada, "POST", "/api/boosts", { lostItemId: stale, plan: "1d" })).body.boost;
  db.prepare("UPDATE boosts SET created_at = datetime('now', '-3 days') WHERE id = ?").run(s.id);
  const again = await call(ada, "POST", "/api/boosts", { lostItemId: stale, plan: "1d" });
  assert.equal(again.status, 201, "the old unpaid one no longer blocks the post");
  assert.equal(boostRow(s.id).status, "cancelled");
});

test("a student's own list shows their boosts and never anyone else's", async () => {
  const ada = makeUser("Ada Seven");
  const bob = makeUser("Bob Seven");
  const a = (await call(ada, "POST", "/api/boosts", { lostItemId: lostPost(ada, "Ada's thing"), plan: "1d" })).body.boost;
  const b = (await call(bob, "POST", "/api/boosts", { lostItemId: lostPost(bob, "Bob's thing"), plan: "1d" })).body.boost;
  const adas = (await call(ada, "GET", "/api/boosts/mine")).body.boosts.map((x) => x.id);
  assert.deepEqual(adas, [a.id]);
  assert.ok(!adas.includes(b.id));
  assert.equal((await call(ada, "GET", "/api/boosts/mine")).body.boosts[0].itemDescription, "Ada's thing");
});
