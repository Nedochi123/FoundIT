// "Urgently need": a lost post with a compulsory, public reward and an agreement to pay it. Publishing alerts every
// device with notifications on; the owner settles the promised reward when they confirm the return in the chat.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");
const webpush = require("web-push");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-urgent-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
// push is switched on (with throwaway keys) and its sender replaced below, so no real message is ever sent
const keys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
delete process.env.RESEND_API_KEY;

const sent = [];
webpush.sendNotification = async (subscription, payload) => {
  sent.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) });
};

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");
const { REWARD_AMOUNTS } = require("../src/utils/rewards");
const { MAX_URGENT_PER_WEEK } = require("../src/utils/urgent");

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
  return { id, name, email, token: signAccessToken({ id, email, name }) };
}
function subscribe(user, { notifyLost = 1 } = {}) {
  // a real push service's address: the server refuses to send to anywhere else (utils/pushEndpoint.js)
  const endpoint = `https://fcm.googleapis.com/fcm/send/${user.id}`;
  db.prepare("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, notify_lost) VALUES (?, ?, ?, 'k', 'a', ?)").run(
    uid(),
    user.id,
    endpoint,
    notifyLost
  );
  return endpoint;
}
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const waitFor = async (fn) => {
  for (let i = 0; i < 40 && !fn(); i++) await new Promise((r) => setTimeout(r, 25));
};
const POST = { description: "My black laptop bag with my project inside", location: "Faculty of Engineering", reward: 10000, agree: true };

test("the reward is compulsory and the agreement must be ticked", async () => {
  const ada = makeUser("Ada");
  assert.equal((await call(null, "POST", "/api/lost-items/urgent", POST)).status, 401);
  assert.equal((await call(null, "GET", "/api/lost-items/urgent")).status, 401);

  const noReward = await call(ada, "POST", "/api/lost-items/urgent", { ...POST, reward: undefined });
  assert.equal(noReward.status, 400);
  assert.match(noReward.body.error, /reward/i);
  assert.equal((await call(ada, "POST", "/api/lost-items/urgent", { ...POST, reward: 12345 })).status, 400, "only the fixed amounts");
  assert.equal((await call(ada, "POST", "/api/lost-items/urgent", { ...POST, reward: 0 })).status, 400);
  const noAgree = await call(ada, "POST", "/api/lost-items/urgent", { ...POST, agree: false });
  assert.equal(noAgree.status, 400);
  assert.match(noAgree.body.error, /agree/i);
  assert.equal((await call(ada, "POST", "/api/lost-items/urgent", { ...POST, agree: undefined })).status, 400);
  assert.equal((await call(ada, "POST", "/api/lost-items/urgent", { ...POST, description: " " })).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM lost_items WHERE poster_id = ?").get(ada.id).n, 0, "nothing was saved");
});

test("publishing shows the reward to everyone, pins it first, and alerts every device but the poster's", async () => {
  const bola = makeUser("Bola");
  const chi = makeUser("Chi");
  const dami = makeUser("Dami");
  const ordinary = uid();
  db.prepare("INSERT INTO lost_items (id, poster_id, description) VALUES (?, ?, 'Blue umbrella')").run(ordinary, chi.id);
  const subs = { bola: subscribe(bola), chi: subscribe(chi), dami: subscribe(dami, { notifyLost: 0 }) };
  sent.length = 0;

  const made = await call(bola, "POST", "/api/lost-items/urgent", POST);
  assert.equal(made.status, 201);
  assert.equal(made.body.item.urgent.reward, 10000);
  assert.equal(db.prepare("SELECT urgent_agreed_at FROM lost_items WHERE id = ?").get(made.body.item.id).urgent_agreed_at !== null, true, "the agreement is recorded");

  // everyone sees the reward, and it comes before ordinary posts
  const board = (await call(dami, "GET", "/api/lost-items")).body.items;
  assert.equal(board[0].id, made.body.item.id);
  assert.equal(board[0].urgent.reward, 10000);
  assert.equal(board.find((i) => i.id === ordinary).urgent, null);
  const alerts = (await call(dami, "GET", "/api/lost-items/urgent")).body.items;
  assert.deepEqual(alerts.map((i) => i.id), [made.body.item.id]);
  assert.equal(alerts[0].posterName, "Bola");

  // the push: every subscribed device except the poster's, even where lost alerts are turned off
  await waitFor(() => sent.length >= 2);
  assert.deepEqual(sent.map((m) => m.endpoint).sort(), [subs.chi, subs.dami].sort());
  const msg = sent[0];
  assert.match(msg.title, /^⚠️ URGENT/);
  assert.match(msg.body, /Bola urgently needs: My black laptop bag/);
  assert.match(msg.body, /₦10,000 reward/);
  assert.equal(msg.url, "/?lost=1");
  assert.equal(msg.urgent, true);
  assert.equal(msg.icon, "/icons/alert-192.png");
});

test("one urgent post at a time, a few a week, and alerts stop after a week", async () => {
  const eke = makeUser("Eke");
  const first = await call(eke, "POST", "/api/lost-items/urgent", POST);
  assert.equal(first.status, 201);
  const second = await call(eke, "POST", "/api/lost-items/urgent", POST);
  assert.equal(second.status, 409, "one open at a time");

  // once it is found, another can be made, until the weekly limit
  await call(eke, "PATCH", `/api/lost-items/${first.body.item.id}/resolve`);
  for (let i = 1; i < MAX_URGENT_PER_WEEK; i++) {
    const again = await call(eke, "POST", "/api/lost-items/urgent", POST);
    assert.equal(again.status, 201, `urgent post number ${i + 1}`);
    await call(eke, "PATCH", `/api/lost-items/${again.body.item.id}/resolve`);
  }
  assert.equal((await call(eke, "POST", "/api/lost-items/urgent", POST)).status, 429, "weekly limit");
  assert.equal((await call(eke, "POST", "/api/lost-items", { description: "Still allowed as a normal post" })).status, 201);

  // an urgent post older than a week stays on the board but no longer raises alerts
  const fola = makeUser("Fola");
  const old = uid();
  db.prepare("INSERT INTO lost_items (id, poster_id, description, urgent_reward, urgent_at) VALUES (?, ?, 'Old keys', 5000, datetime('now', '-8 days'))").run(old, fola.id);
  assert.equal((await call(eke, "GET", "/api/lost-items/urgent")).body.items.some((i) => i.id === old), false);
  assert.equal((await call(eke, "GET", "/api/lost-items")).body.items.find((i) => i.id === old).urgent, null);
});

test("confirming the return pays out the promised reward, which can't be changed", async () => {
  const gbenga = makeUser("Gbenga");
  const finder = makeUser("Finder");
  const stranger = makeUser("Stranger");
  const post = (await call(gbenga, "POST", "/api/lost-items/urgent", { ...POST, reward: 15000 })).body.item;

  const itemId = uid();
  db.prepare("INSERT INTO found_items (id, poster_id, photo_url, description) VALUES (?, ?, '/uploads/x.jpg', 'A black bag')").run(itemId, finder.id);
  const convo = uid();
  db.prepare("INSERT INTO conversations (id, found_item_id, finder_id, seeker_id) VALUES (?, ?, ?, ?)").run(convo, itemId, finder.id, gbenga.id);

  // the owner is offered it in the chat; the finder isn't
  const offer = (await call(gbenga, "GET", `/api/conversations/${convo}/messages`)).body.urgentOffer;
  assert.deepEqual(offer, { lostItemId: post.id, description: POST.description, reward: 15000 });
  assert.equal((await call(finder, "GET", `/api/conversations/${convo}/messages`)).body.urgentOffer, null);

  // someone else's post can't be used, and a made-up one can't either
  const theirs = (await call(stranger, "POST", "/api/lost-items/urgent", POST)).body.item;
  assert.equal((await call(gbenga, "POST", `/api/conversations/${convo}/confirm-return`, { urgentItemId: theirs.id })).status, 400);
  assert.equal((await call(gbenga, "POST", `/api/conversations/${convo}/confirm-return`, { urgentItemId: "nope" })).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rewards").get().n, 0, "nothing changed");

  // a different amount sent alongside is ignored: the promised ₦15,000 is what is recorded
  const done = await call(gbenga, "POST", `/api/conversations/${convo}/confirm-return`, { urgentItemId: post.id, rewardAmount: REWARD_AMOUNTS[0] });
  assert.equal(done.status, 200);
  assert.equal(done.body.rewardAmount, 15000);
  const reward = db.prepare("SELECT * FROM rewards WHERE found_item_id = ?").get(itemId);
  assert.equal(reward.amount, 15000);
  assert.equal(reward.from_user_id, gbenga.id);
  assert.equal(reward.to_user_id, finder.id);
  assert.equal(db.prepare("SELECT status FROM lost_items WHERE id = ?").get(post.id).status, "resolved", "the urgent post is closed");
  const chat = (await call(finder, "GET", `/api/conversations/${convo}/messages`)).body;
  assert.match(chat.messages.at(-1).body, /urgently needed.*₦15,000 reward I promised/);
  assert.equal(chat.reward.amount, 15000);
  assert.equal((await call(stranger, "GET", "/api/lost-items/urgent")).body.items.some((i) => i.id === post.id), false, "its alert is gone");
});

test("an ordinary confirmation still works with no urgent post involved", async () => {
  const hana = makeUser("Hana");
  const finder = makeUser("Finder Two");
  const itemId = uid();
  db.prepare("INSERT INTO found_items (id, poster_id, photo_url, description) VALUES (?, ?, '/uploads/x.jpg', 'Keys')").run(itemId, finder.id);
  const convo = uid();
  db.prepare("INSERT INTO conversations (id, found_item_id, finder_id, seeker_id) VALUES (?, ?, ?, ?)").run(convo, itemId, finder.id, hana.id);
  assert.equal((await call(hana, "GET", `/api/conversations/${convo}/messages`)).body.urgentOffer, null);
  const done = await call(hana, "POST", `/api/conversations/${convo}/confirm-return`, { rewardAmount: 5000 });
  assert.equal(done.body.rewardAmount, 5000);
  assert.match((await call(finder, "GET", `/api/conversations/${convo}/messages`)).body.messages.at(-1).body, /To say thank you/);
});
