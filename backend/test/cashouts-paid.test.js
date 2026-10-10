// "Cash-outs paid": the money FoundIT pays students for tokens is a cost. It is recorded when the admin marks a cash-out
// as paid, kept even if the student deletes their account, and shown beside revenue as "paid out" and "left after
// cash-outs" for each calendar year (Nigerian time).
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-payouts-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_EMAILS = "owner-pay@example.com";
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
const owner = makeUser("Owner", "owner-pay@example.com", true);
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const cashout = (user, amount = 5000, status = "pending", processedAt = null) => {
  const id = uid();
  db.prepare(
    "INSERT INTO cashout_requests (id, user_id, tokens_spent, amount_naira, bank_name, account_number, account_name, status, processed_at) VALUES (?, ?, 50, ?, 'GTBank', '0123456789', 'Ada', ?, ?)"
  ).run(id, user.id, amount, status, processedAt);
  return id;
};
const report = async () => (await call(owner, "GET", "/api/monitor/revenue")).body;
const yearOf = (r, year) => r.years.find((y) => y.year === year);

test("the report subtracts cash-outs paid, per year and running, and can go below zero", () => {
  const revenue = [
    { year: 2026, month: 3, payments: 2, revenue: 1000 },
    { year: 2027, month: 6, payments: 1, revenue: 400 },
  ];
  const paid = [
    { year: 2026, month: 5, payments: 1, amount: 500 },
    { year: 2027, month: 2, payments: 2, amount: 2000 },
  ];
  const r = buildReport(revenue, 2027, paid);
  assert.deepEqual(
    r.years.map((y) => [y.year, y.revenue, y.cashouts.amount, y.net, y.cumulative, y.netCumulative]),
    [
      [2026, 1000, 500, 500, 1000, 500],
      [2027, 400, 2000, -1600, 1400, -1100], // more paid out than earned: negative, not hidden
    ]
  );
  assert.deepEqual(r.cashouts, { payments: 3, amount: 2500 });
  assert.equal(r.net, 1400 - 2500);
  assert.equal(r.years[1].months[1].cashouts, 2000, "February 2027");
});

test("a year with cash-outs but no revenue still appears, and the range starts at the earliest of either", () => {
  const r = buildReport([], 2027, [{ year: 2025, month: 12, payments: 1, amount: 300 }]);
  assert.deepEqual(
    r.years.map((y) => [y.year, y.revenue, y.cashouts.amount, y.netCumulative]),
    [
      [2025, 0, 300, -300],
      [2026, 0, 0, -300],
      [2027, 0, 0, -300],
    ]
  );
});

test("with nothing at all the report is still complete, at zero", () => {
  const r = buildReport([], 2026);
  assert.deepEqual(r.cashouts, { payments: 0, amount: 0 });
  assert.equal(r.net, 0);
  assert.equal(r.years[0].net, 0);
});

test("marking a cash-out paid records it as a cost; rejected or pending ones never count", async () => {
  const ada = makeUser("Ada");
  const before = (await report()).cashouts.amount;
  const toPay = cashout(ada, 5000);
  const toReject = cashout(ada, 10000);
  cashout(ada, 7000); // left pending

  assert.equal((await call(owner, "PATCH", `/api/admin/cashout-requests/${toReject}`, { status: "rejected" })).status, 200);
  assert.equal((await report()).cashouts.amount, before, "a rejected cash-out costs nothing");
  assert.equal((await call(owner, "PATCH", `/api/admin/cashout-requests/${toPay}`, { status: "paid" })).status, 200);

  const r = await report();
  assert.equal(r.cashouts.amount, before + 5000, "only the paid one");
  assert.equal(r.net, r.total - r.cashouts.amount);
  const thisYear = yearOf(r, r.thisYear);
  assert.equal(thisYear.cashouts.amount, before + 5000);

  // dealing with it again is refused and can't count twice
  assert.equal((await call(owner, "PATCH", `/api/admin/cashout-requests/${toPay}`, { status: "paid" })).status, 400);
  assert.equal((await report()).cashouts.amount, before + 5000);
});

test("a student deleting their account doesn't make past cash-outs disappear from the costs", async () => {
  const bola = makeUser("Bola");
  const before = (await report()).cashouts.amount;
  const id = cashout(bola, 3000);
  assert.equal((await call(owner, "PATCH", `/api/admin/cashout-requests/${id}`, { status: "paid" })).status, 200);
  assert.equal((await report()).cashouts.amount, before + 3000);

  db.prepare("DELETE FROM users WHERE id = ?").run(bola.id);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cashout_requests WHERE id = ?").get(id).n, 0, "the request itself is gone");
  assert.equal((await report()).cashouts.amount, before + 3000, "the money paid out still counts");
});

test("years are Nigerian time for payouts too", async () => {
  db.prepare("INSERT INTO payout_entries (id, source, amount, reference, paid_at) VALUES (?, 'cashout', 900, ?, '2024-12-31 23:30:00')").run(uid(), "PAY-" + uid());
  db.prepare("INSERT INTO payout_entries (id, source, amount, reference, paid_at) VALUES (?, 'cashout', 400, ?, '2024-12-31 22:30:00')").run(uid(), "PAY-" + uid());
  const r = await report();
  assert.equal(yearOf(r, 2024).cashouts.amount, 400, "22:30 UTC is still 2024 in Nigeria");
  assert.equal(yearOf(r, 2025).months[0].cashouts, 900, "23:30 UTC is already 1 January 2025 in Nigeria");
});

test("cash-outs paid before the payout record existed are copied in on start-up, once", () => {
  const ada = makeUser("Old Ada");
  const paid = cashout(ada, 10000, "paid", "2026-02-02 10:00:00");
  cashout(ada, 4000, "pending");
  cashout(ada, 2000, "rejected", "2026-02-03 10:00:00");
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  db.exec(schema); // what every server start does
  db.exec(schema);
  const rows = db.prepare("SELECT amount, paid_at FROM payout_entries WHERE id = ?").all(paid);
  assert.deepEqual(rows.map((x) => [x.amount, x.paid_at]), [[10000, "2026-02-02 10:00:00"]]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM payout_entries WHERE amount IN (4000, 2000)").get().n, 0, "pending and rejected were not copied");
});

test("only the owner can read the costs", async () => {
  const student = makeUser("Student");
  assert.equal((await call(null, "GET", "/api/monitor/revenue")).status, 401);
  assert.equal((await call(student, "GET", "/api/monitor/revenue")).status, 404);
});
