// The voluntary thank-you reward: who can give it, when, which amounts, and the sent / received steps.
// FoundIT never handles the money, so nothing here moves or stores any account details.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-rewards-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");
const { REWARD_AMOUNTS } = require("../src/utils/rewards");

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
  const email = `${name.toLowerCase().replace(/\W/g, "")}-${id.slice(0, 6)}@example.com`;
  db.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, 'x')").run(id, name, email);
  return { id, name, token: signAccessToken({ id, email, name }) };
}
/** A found item posted by `finder`, with a chat opened by each of `seekers`. */
function makeItem(finder, seekers) {
  const itemId = uid();
  db.prepare("INSERT INTO found_items (id, poster_id, photo_url, description) VALUES (?, ?, '/uploads/x.jpg', 'A black wallet')").run(itemId, finder.id);
  const convos = seekers.map((s) => {
    const id = uid();
    db.prepare("INSERT INTO conversations (id, found_item_id, finder_id, seeker_id) VALUES (?, ?, ?, ?)").run(id, itemId, finder.id, s.id);
    return id;
  });
  return { itemId, convos };
}
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const view = (user, convo) => call(user, "GET", `/api/conversations/${convo}/messages`);
const rewardRow = (itemId) => db.prepare("SELECT * FROM rewards WHERE found_item_id = ?").get(itemId);
const tokensOf = (u) => db.prepare("SELECT tokens FROM users WHERE id = ?").get(u.id).tokens;

test("the reward choices are ₦3,000 to ₦20,000", () => {
  assert.deepEqual(REWARD_AMOUNTS, [3000, 5000, 7000, 10000, 15000, 20000]);
});

test("an owner can choose a reward while confirming the return; the finder is told in the chat", async () => {
  const owner = makeUser("Owner One");
  const finder = makeUser("Finder One");
  const { itemId, convos } = makeItem(finder, [owner]);

  const r = await call(owner, "POST", `/api/conversations/${convos[0]}/confirm-return`, { note: "Thank you!", rewardAmount: 5000 });
  assert.equal(r.status, 200);
  assert.equal(r.body.rewardAmount, 5000);
  assert.equal(tokensOf(finder), 2, "the usual tokens are still awarded");

  const row = rewardRow(itemId);
  assert.equal(row.amount, 5000);
  assert.equal(row.status, "promised");
  assert.equal(row.from_user_id, owner.id);
  assert.equal(row.to_user_id, finder.id);

  const asFinder = await view(finder, convos[0]);
  assert.deepEqual(asFinder.body.reward, { amount: 5000, status: "promised", sentAt: null, receivedAt: null });
  assert.ok(asFinder.body.messages.some((m) => m.senderId === owner.id && m.body.includes("₦5,000") && /account details/.test(m.body)));
  assert.equal(asFinder.body.canOfferReward, false);
  assert.equal((await view(owner, convos[0])).body.canOfferReward, false, "already has a reward");
});

test("only the fixed amounts are accepted, and a bad amount changes nothing", async () => {
  const owner = makeUser("Owner Two");
  const finder = makeUser("Finder Two");
  const { itemId, convos } = makeItem(finder, [owner]);
  for (const bad of [1000, 2500, 25000, 0, -5000, 5000.5]) {
    const r = await call(owner, "POST", `/api/conversations/${convos[0]}/confirm-return`, { rewardAmount: bad });
    assert.equal(r.status, 400, `rewardAmount ${bad} should be refused`);
  }
  const r = await call(owner, "POST", `/api/conversations/${convos[0]}/confirm-return`, { rewardAmount: "5000" });
  assert.equal(r.status, 400, "a string is refused");
  assert.equal(db.prepare("SELECT return_confirmed_at FROM found_items WHERE id = ?").get(itemId).return_confirmed_at, null, "the return was not confirmed by a refused request");
  assert.equal(rewardRow(itemId), undefined);
  assert.equal(tokensOf(finder), 0);
});

test("choosing no reward is fine, and the owner can give one afterwards, once", async () => {
  const owner = makeUser("Owner Three");
  const finder = makeUser("Finder Three");
  const { itemId, convos } = makeItem(finder, [owner]);
  const url = `/api/conversations/${convos[0]}/reward`;

  assert.equal((await call(owner, "POST", url, { amount: 5000 })).status, 400, "not before the return is confirmed");
  assert.equal((await call(owner, "POST", `/api/conversations/${convos[0]}/confirm-return`, {})).status, 200);
  assert.equal(rewardRow(itemId), undefined, "no reward by default");
  assert.equal((await view(owner, convos[0])).body.canOfferReward, true);
  assert.equal((await view(finder, convos[0])).body.canOfferReward, false);

  assert.equal((await call(finder, "POST", url, { amount: 5000 })).status, 403, "the finder can't give themselves one");
  assert.equal((await call(owner, "POST", url, { amount: 4000 })).status, 400, "an amount not on the list");
  assert.equal((await call(owner, "POST", url, {})).status, 400);
  assert.equal((await call(owner, "POST", url, { amount: 7000 })).status, 201);
  assert.equal(rewardRow(itemId).amount, 7000);
  assert.equal((await call(owner, "POST", url, { amount: 20000 })).status, 400, "only one reward per item");
  assert.equal(rewardRow(itemId).amount, 7000, "unchanged");
  assert.equal((await call(null, "POST", url, { amount: 7000 })).status, 401, "must be signed in");
});

test("another student who asked about the same item can't give or see the reward", async () => {
  const owner = makeUser("Owner Four");
  const bystander = makeUser("Bystander");
  const finder = makeUser("Finder Four");
  const { itemId, convos } = makeItem(finder, [owner, bystander]);
  await call(owner, "POST", `/api/conversations/${convos[0]}/confirm-return`, {});

  const asBystander = await view(bystander, convos[1]);
  assert.equal(asBystander.body.canOfferReward, false);
  assert.equal((await call(bystander, "POST", `/api/conversations/${convos[1]}/reward`, { amount: 3000 })).status, 400);
  assert.equal(rewardRow(itemId), undefined, "the slot stays free for the real owner");
  assert.equal((await call(owner, "POST", `/api/conversations/${convos[0]}/reward`, { amount: 3000 })).status, 201);
  assert.equal((await view(bystander, convos[1])).body.reward, null, "the bystander's chat shows no reward");
});

test("sent and received: the right person for each step, in the right order, and outsiders can do nothing", async () => {
  const owner = makeUser("Owner Five");
  const finder = makeUser("Finder Five");
  const outsider = makeUser("Outsider");
  const { itemId, convos } = makeItem(finder, [owner]);
  const c = convos[0];
  await call(owner, "POST", `/api/conversations/${c}/confirm-return`, { rewardAmount: 10000 });

  assert.equal((await call(finder, "POST", `/api/conversations/${c}/reward/received`)).status, 400, "can't be received before it is sent");
  assert.equal((await call(finder, "POST", `/api/conversations/${c}/reward/sent`)).status, 403, "the finder can't say the owner sent it");
  for (const step of ["sent", "received"]) {
    assert.equal((await call(outsider, "POST", `/api/conversations/${c}/reward/${step}`)).status, 403, `outsider: ${step}`);
  }

  assert.equal((await call(owner, "POST", `/api/conversations/${c}/reward/sent`)).status, 200);
  assert.equal(rewardRow(itemId).status, "sent");
  assert.ok(rewardRow(itemId).sent_at);
  const messagesAfterSent = db.prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id = ?").get(c).n;
  assert.equal((await call(owner, "POST", `/api/conversations/${c}/reward/sent`)).status, 200, "pressing it twice is harmless");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id = ?").get(c).n, messagesAfterSent, "no duplicate chat message");

  assert.equal((await call(owner, "POST", `/api/conversations/${c}/reward/received`)).status, 403, "the owner can't say the finder received it");
  assert.equal((await call(finder, "POST", `/api/conversations/${c}/reward/received`)).status, 200);
  assert.equal(rewardRow(itemId).status, "received");
  assert.ok(rewardRow(itemId).received_at);
  assert.deepEqual(
    Object.keys((await view(finder, c)).body.reward).sort(),
    ["amount", "receivedAt", "sentAt", "status"],
    "the chat only ever gets the amount and the steps"
  );
});

test("the reward record holds no bank, card or phone details", () => {
  const columns = db.prepare("PRAGMA table_info(rewards)").all().map((c) => c.name).sort();
  assert.deepEqual(columns, ["amount", "conversation_id", "created_at", "found_item_id", "from_user_id", "id", "received_at", "sent_at", "status", "to_user_id"]);
});
