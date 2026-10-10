// The revenue report on the owner page: boosts the admin approved, added up by calendar year (Nigerian time), with the
// running total at the end of each year, and kept safe when a student deletes their account.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-revenue-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_EMAILS = "owner-rev@example.com";
delete process.env.MONITOR_EMAILS;
delete process.env.RESEND_API_KEY;

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");
const { buildReport } = require("../src/utils/revenue");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const uid = () => crypto.randomUUID();
function makeUser(name, email, verified = false) {
  const id = uid();
  email = email || `${name.toLowerCase().replace(/\W/g, "")}-${id.slice(0, 6)}@example.com`;
  db.prepare("INSERT INTO users (id, name, email, password_hash, email_verified_at) VALUES (?, ?, ?, 'x', ?)").run(id, name, email, verified ? "2026-10-01 08:00:00" : null);
  return { id, name, email, token: signAccessToken({ id, email, name }) };
}
const owner = makeUser("Owner", "owner-rev@example.com", true);
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const earn = (amount, earnedAt) =>
  db.prepare("INSERT INTO revenue_entries (id, source, amount, reference, earned_at) VALUES (?, 'boost', ?, ?, ?)").run(uid(), amount, "REF-" + uid(), earnedAt);

test("the report adds up each calendar year and keeps a running total to the end of each year", () => {
  const rows = [
    { year: 2026, month: 3, payments: 2, revenue: 1000 },
    { year: 2026, month: 11, payments: 1, revenue: 300 },
    { year: 2028, month: 1, payments: 4, revenue: 4800 },
  ];
  const report = buildReport(rows, 2029);
  assert.deepEqual(
    report.years.map((y) => [y.year, y.revenue, y.cumulative, y.payments, y.complete]),
    [
      [2026, 1300, 1300, 3, true],
      [2027, 0, 1300, 0, true], // a year with nothing still shows, with the same running total
      [2028, 4800, 6100, 4, true],
      [2029, 0, 6100, 0, false], // this year so far
    ]
  );
  assert.equal(report.total, 6100);
  assert.equal(report.payments, 7);
  assert.equal(report.years[0].months[2].revenue, 1000, "March 2026");
  assert.equal(report.years[0].months.length, 12);
  assert.equal(report.currency, "NGN");
});

test("with nothing earned yet the report still shows this year, at zero", () => {
  const report = buildReport([], 2026);
  assert.deepEqual(
    report.years.map((y) => [y.year, y.revenue, y.cumulative]),
    [[2026, 0, 0]]
  );
  assert.equal(report.total, 0);
});

test("only the owner can read the revenue", async () => {
  const student = makeUser("Student");
  const otherAdmin = makeUser("Plain");
  assert.equal((await call(null, "GET", "/api/monitor/revenue")).status, 401);
  assert.equal((await call(student, "GET", "/api/monitor/revenue")).status, 404);
  assert.equal((await call(otherAdmin, "GET", "/api/monitor/revenue")).status, 404);
  assert.equal((await call(owner, "GET", "/api/monitor/revenue")).status, 200);
});

test("calendar years are Nigerian time: 23:30 UTC on 31 December already counts as the new year", async () => {
  earn(1200, "2025-12-31 23:30:00"); // 00:30 on 1 January 2026 in Nigeria
  earn(700, "2025-12-31 22:30:00"); // 23:30 on 31 December 2025 in Nigeria
  const { body } = await call(owner, "GET", "/api/monitor/revenue");
  const y2025 = body.years.find((y) => y.year === 2025);
  const y2026 = body.years.find((y) => y.year === 2026);
  assert.equal(y2025.revenue, 700);
  assert.equal(y2026.months[0].revenue, 1200, "January 2026");
  assert.equal(y2026.cumulative, 1900, "the running total at the end of 2026 includes 2025");
});

test("approving a boost records its revenue, and a deleted account can't take it away", async () => {
  const before = (await call(owner, "GET", "/api/monitor/revenue")).body.total;
  const ada = makeUser("Ada");
  const post = uid();
  db.prepare("INSERT INTO lost_items (id, poster_id, description) VALUES (?, ?, 'Blue umbrella')").run(post, ada.id);
  const boost = uid();
  db.prepare("INSERT INTO boosts (id, lost_item_id, user_id, plan, hours, amount, reference, status) VALUES (?, ?, ?, '3d', 72, 700, 'BST-TESTREV', 'payment_claimed')").run(
    boost,
    post,
    ada.id
  );

  const approved = await call(owner, "POST", `/api/boosts/admin/${boost}/approve`);
  assert.equal(approved.status, 200);
  assert.equal((await call(owner, "GET", "/api/monitor/revenue")).body.total, before + 700);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM revenue_entries WHERE reference = 'BST-TESTREV'").get().n, 1);
  // approving again is refused and can't count twice
  assert.equal((await call(owner, "POST", `/api/boosts/admin/${boost}/approve`)).status, 409);
  assert.equal((await call(owner, "GET", "/api/monitor/revenue")).body.total, before + 700);

  // the student deletes their account: the boost goes with it, the money already earned stays
  db.prepare("DELETE FROM users WHERE id = ?").run(ada.id);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM boosts WHERE id = ?").get(boost).n, 0, "the boost itself is gone");
  assert.equal((await call(owner, "GET", "/api/monitor/revenue")).body.total, before + 700, "the revenue is not");
});

test("boosts approved before the ledger existed are copied in on start-up, once", () => {
  const ada = makeUser("Old Ada");
  const post = uid();
  db.prepare("INSERT INTO lost_items (id, poster_id, description) VALUES (?, ?, 'Old keys')").run(post, ada.id);
  db.prepare(
    "INSERT INTO boosts (id, lost_item_id, user_id, plan, hours, amount, reference, status, approved_at) VALUES (?, ?, ?, '1d', 24, 300, 'BST-OLDONE', 'active', '2026-02-14 10:00:00')"
  ).run(uid(), post, ada.id);
  db.prepare("INSERT INTO boosts (id, lost_item_id, user_id, plan, hours, amount, reference, status) VALUES (?, ?, ?, '1d', 24, 300, 'BST-UNPAID', 'awaiting_payment')").run(
    uid(),
    post,
    ada.id
  );

  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  db.exec(schema); // what every server start does
  db.exec(schema);
  const rows = db.prepare("SELECT reference, earned_at FROM revenue_entries WHERE reference IN ('BST-OLDONE', 'BST-UNPAID')").all();
  assert.deepEqual(
    rows.map((r) => [r.reference, r.earned_at]),
    [["BST-OLDONE", "2026-02-14 10:00:00"]],
    "only the approved boost, once, on the day it was approved"
  );
});
