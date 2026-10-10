// Sticker sales: the owner records QR "Return me" stickers sold by hand; they count toward revenue by the day of the
// sale (Nigerian calendar), show separately from boosts, and a mistaken entry is voided rather than erased.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-stickers-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_EMAILS = "owner-stk@example.com,other-admin-stk@example.com";
delete process.env.MONITOR_EMAILS;
delete process.env.RESEND_API_KEY;

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");
const { buildReport, todayInNigeria, isRealDate } = require("../src/utils/revenue");

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
const owner = makeUser("Owner", "owner-stk@example.com", true);
const otherAdmin = makeUser("Other Admin", "other-admin-stk@example.com", true);
const student = makeUser("Student");
const call = async (user, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const SALE = { quantity: 10, amount: 5000, soldOn: "2026-03-05", note: "Hostel B, cash" };
const report = async () => (await call(owner, "GET", "/api/monitor/revenue")).body;
const yearOf = (r, year) => r.years.find((y) => y.year === year);

test("the date helpers are strict", () => {
  assert.equal(isRealDate("2026-03-05"), true);
  for (const bad of ["2026-02-31", "2026-13-01", "26-03-05", "2026/03/05", "", "today", "2026-3-5"]) assert.equal(isRealDate(bad), false, bad);
  assert.match(todayInNigeria(), /^\d{4}-\d{2}-\d{2}$/);
  // 23:30 UTC on 31 December is already 1 January in Nigeria
  assert.equal(todayInNigeria(Date.parse("2025-12-31T23:30:00Z")), "2026-01-01");
  assert.equal(todayInNigeria(Date.parse("2025-12-31T22:30:00Z")), "2025-12-31");
});

test("only the owner can record, list or remove sticker sales", async () => {
  for (const [method, url, body] of [["GET", "/api/monitor/sticker-sales"], ["POST", "/api/monitor/sticker-sales", SALE], ["DELETE", "/api/monitor/sticker-sales/x"]]) {
    assert.equal((await call(null, method, url, body)).status, 401, `${method} signed out`);
    assert.equal((await call(student, method, url, body)).status, 404, `${method} as a student`);
    assert.equal((await call(otherAdmin, method, url, body)).status, 404, `${method} as another admin`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM revenue_entries WHERE source = 'sticker'").get().n, 0, "nothing was saved by the refused attempts");
});

test("bad entries are refused with a plain reason", async () => {
  const bad = [
    [{ ...SALE, quantity: 0 }, /at least 1/],
    [{ ...SALE, quantity: -3 }, /at least 1/],
    [{ ...SALE, quantity: 2.5 }, /whole number/],
    [{ ...SALE, quantity: 100001 }, /too many/],
    [{ ...SALE, quantity: undefined }, /how many/],
    [{ ...SALE, amount: 0 }, /more than 0/],
    [{ ...SALE, amount: -100 }, /more than 0/],
    [{ ...SALE, amount: 99.5 }, /whole naira/],
    [{ ...SALE, amount: "5000" }, /total amount/],
    [{ ...SALE, amount: 200000000 }, /too large/],
    [{ ...SALE, soldOn: "2026-02-31" }, /real date/],
    [{ ...SALE, soldOn: "5 March" }, /real date/],
    [{ ...SALE, soldOn: "2019-12-31" }, /too far in the past/],
    [{ ...SALE, soldOn: "2999-01-01" }, /future/],
    [{ ...SALE, soldOn: undefined }, /date/],
    [{ ...SALE, note: "x".repeat(201) }, /under 200/],
  ];
  for (const [body, message] of bad) {
    const r = await call(owner, "POST", "/api/monitor/sticker-sales", body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
    assert.match(r.body.error, message);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM revenue_entries WHERE source = 'sticker'").get().n, 0);
});

test("a recorded sale counts toward the year of its date, shown apart from boosts", async () => {
  db.prepare("INSERT INTO revenue_entries (id, source, amount, reference, earned_at) VALUES (?, 'boost', 700, 'BST-STK1', '2026-02-10 09:00:00')").run(uid());

  const made = await call(owner, "POST", "/api/monitor/sticker-sales", SALE);
  assert.equal(made.status, 201);
  assert.deepEqual({ ...made.body.sale, id: undefined, recordedAt: undefined }, { id: undefined, soldOn: "2026-03-05", quantity: 10, amount: 5000, note: "Hostel B, cash", recordedAt: undefined });

  await call(owner, "POST", "/api/monitor/sticker-sales", { quantity: 4, amount: 2000, soldOn: "2025-12-31" }); // Nigerian New Year's Eve: 2025
  await call(owner, "POST", "/api/monitor/sticker-sales", { quantity: 1, amount: 500, soldOn: todayInNigeria() }); // today is allowed

  const r = await report();
  assert.equal(yearOf(r, 2025).revenue, 2000, "the 31 December sale stays in 2025");
  assert.equal(yearOf(r, 2025).bySource.sticker.units, 4);
  const y2026 = yearOf(r, 2026);
  assert.equal(y2026.bySource.boost.revenue, 700);
  assert.equal(y2026.bySource.sticker.revenue, 5000 + (todayInNigeria().startsWith("2026") ? 500 : 0));
  assert.equal(y2026.months[2].revenue, 5000, "March 2026");
  assert.equal(r.bySource.sticker.units, 15);
  assert.equal(r.total, 700 + 5000 + 2000 + 500, "boosts and stickers add up together");
  assert.equal(r.years.at(-1).cumulative, r.total);
});

test("the list shows the live sales, newest sale first", async () => {
  const { sales, today } = (await call(owner, "GET", "/api/monitor/sticker-sales")).body;
  assert.equal(today, todayInNigeria());
  assert.deepEqual(sales.map((s) => s.soldOn), [todayInNigeria(), "2026-03-05", "2025-12-31"]);
  assert.equal(sales[1].note, "Hostel B, cash");
});

test("removing a mistaken sale takes it out of the totals but keeps the record, and can't touch boosts", async () => {
  const before = await report();
  const target = (await call(owner, "GET", "/api/monitor/sticker-sales")).body.sales.find((s) => s.soldOn === "2026-03-05");
  assert.equal((await call(owner, "DELETE", `/api/monitor/sticker-sales/${target.id}`)).status, 200);

  const after = await report();
  assert.equal(after.total, before.total - 5000);
  assert.equal(yearOf(after, 2026).months[2].revenue, 0);
  assert.equal((await call(owner, "GET", "/api/monitor/sticker-sales")).body.sales.some((s) => s.id === target.id), false);
  const row = db.prepare("SELECT voided_at, amount FROM revenue_entries WHERE id = ?").get(target.id);
  assert.ok(row.voided_at, "the row is still there, marked as removed");
  assert.equal(row.amount, 5000);

  assert.equal((await call(owner, "DELETE", `/api/monitor/sticker-sales/${target.id}`)).status, 404, "can't remove it twice");
  assert.equal((await call(owner, "DELETE", "/api/monitor/sticker-sales/nope")).status, 404);
  const boost = db.prepare("SELECT id FROM revenue_entries WHERE source = 'boost' AND reference = 'BST-STK1'").get();
  assert.equal((await call(owner, "DELETE", `/api/monitor/sticker-sales/${boost.id}`)).status, 404, "boost income can't be removed from here");
  assert.equal((await report()).total, after.total);
});

test("recording and removing are in the owner's access trail, and are not logged as student activity", async () => {
  const trail = (await call(owner, "GET", "/api/monitor/access-log")).body.items.map((i) => i.what);
  assert.ok(trail.includes("recorded a sticker sale"));
  assert.ok(trail.includes("removed a sticker sale"));
  const logged = db.prepare("SELECT action FROM activity_log WHERE user_id = ?").all(owner.id).map((r) => r.action);
  assert.ok(!logged.some((a) => /sticker/i.test(a)));
});

test("the report keeps working when entries have no source or quantity (older rows)", () => {
  const r = buildReport([{ year: 2026, month: 1, payments: 2, revenue: 600 }], 2026);
  assert.equal(r.years[0].bySource.boost.revenue, 600);
  assert.equal(r.years[0].bySource.sticker.revenue, 0);
});

test("the live database, which already has the older revenue table, is upgraded in place without losing a row", () => {
  const { execFileSync } = require("node:child_process");
  const { DatabaseSync } = require("node:sqlite");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-upgrade-")), "old.db");
  const old = new DatabaseSync(file);
  // the table exactly as it was when the Revenue tab first went live
  old.exec(`CREATE TABLE revenue_entries (id TEXT PRIMARY KEY, source TEXT NOT NULL DEFAULT 'boost', amount INTEGER NOT NULL, reference TEXT NOT NULL UNIQUE, earned_at TEXT NOT NULL);
            INSERT INTO revenue_entries (id, source, amount, reference, earned_at) VALUES ('old1', 'boost', 700, 'BST-LIVE1', '2026-10-01 10:00:00');`);
  old.close();

  const script = `const db = require(${JSON.stringify(path.join(__dirname, "..", "db"))});
    console.log(JSON.stringify({
      columns: db.prepare("PRAGMA table_info(revenue_entries)").all().map((c) => c.name),
      rows: db.prepare("SELECT id, amount, quantity, note, voided_at FROM revenue_entries").all().map((r) => ({ ...r })),
    }));`;
  const out = JSON.parse(execFileSync(process.execPath, ["-e", script], { env: { ...process.env, DATABASE_URL: "file:" + file }, encoding: "utf8" }).trim().split("\n").pop());
  for (const column of ["quantity", "note", "recorded_at", "voided_at"]) assert.ok(out.columns.includes(column), `${column} was added`);
  assert.deepEqual(out.rows, [{ id: "old1", amount: 700, quantity: null, note: null, voided_at: null }], "the existing payment is untouched");
});
