const crypto = require("crypto");
const db = require("../../db");

// What FoundIT has earned, for the owner page. There are two kinds of income:
//  - boosts: a student pays by bank transfer, the admin checks and approves, and that approval writes one row here
//    (recordBoostRevenue). Automatic.
//  - sticker sales: QR "Return me" stickers sold by hand. The app can't see those, so the owner records each sale on the
//    owner page (addStickerSale). A mistaken entry is removed by voiding it: it stays in the table for the record but no
//    longer counts.
// Rows live in revenue_entries, apart from the boosts table on purpose (see db/schema.sql). Not counted because they are
// not FoundIT's income: thank-you rewards (paid student to student) and token cash-outs (a cost).
//
// Years are calendar years in Nigerian time (Africa/Lagos, UTC+1 all year), so a payment approved at 23:30 UTC on
// 31 December counts in the new year, as it did on the owner's clock.

const WAT_HOURS = 1;
const WAT_MS = WAT_HOURS * 3600 * 1000;
const EARLIEST_SALE = "2020-01-01";

/** Writes the ledger row for a boost the admin has just approved. Safe to call twice for the same boost. */
function recordBoostRevenue(boostId) {
  const boost = db.prepare("SELECT id, amount, reference FROM boosts WHERE id = ?").get(boostId);
  if (!boost) return;
  db.prepare(
    "INSERT OR IGNORE INTO revenue_entries (id, source, amount, reference, earned_at, recorded_at) VALUES (?, 'boost', ?, ?, datetime('now'), datetime('now'))"
  ).run(boost.id, boost.amount, boost.reference);
}

/** Today's date in Nigeria as YYYY-MM-DD. */
const todayInNigeria = (now = Date.now()) => new Date(now + WAT_MS).toISOString().slice(0, 10);
const currentYear = () => Number(todayInNigeria().slice(0, 4));

/** True for a real calendar date written YYYY-MM-DD (so 2026-02-31 is refused). */
function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/**
 * Records one batch of stickers sold. `amount` is the total naira received, `quantity` how many stickers. The sale is
 * stored at noon Nigerian time on the day given, so it can never slip into the neighbouring day or year.
 */
function addStickerSale({ quantity, amount, soldOn, note }) {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO revenue_entries (id, source, amount, reference, earned_at, quantity, note, recorded_at)
     VALUES (?, 'sticker', ?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, amount, `STK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`, `${soldOn} ${String(12 - WAT_HOURS).padStart(2, "0")}:00:00`, quantity, note || null);
  return id;
}

const stickerView = (r) => ({
  id: r.id,
  soldOn: new Date(new Date(r.earned_at.replace(" ", "T") + "Z").getTime() + WAT_MS).toISOString().slice(0, 10),
  quantity: r.quantity,
  amount: r.amount,
  note: r.note,
  recordedAt: r.recorded_at,
});

/** The sticker sales that count, newest sale first. */
function listStickerSales(limit = 200) {
  return db
    .prepare("SELECT * FROM revenue_entries WHERE source = 'sticker' AND voided_at IS NULL ORDER BY earned_at DESC, rowid DESC LIMIT ?")
    .all(limit)
    .map(stickerView);
}

/** Takes a mistaken sticker sale out of the totals (the row stays, marked). Returns false if there is no such live sale. */
function voidStickerSale(id) {
  const result = db
    .prepare("UPDATE revenue_entries SET voided_at = datetime('now') WHERE id = ? AND source = 'sticker' AND voided_at IS NULL")
    .run(id);
  return result.changes > 0;
}

/** One row per (year, month, source) that has any revenue, in Nigerian time. */
function monthlyRows() {
  return db
    .prepare(
      `SELECT CAST(strftime('%Y', datetime(earned_at, '+${WAT_HOURS} hours')) AS INTEGER) AS year,
              CAST(strftime('%m', datetime(earned_at, '+${WAT_HOURS} hours')) AS INTEGER) AS month,
              source, COUNT(*) AS payments, SUM(amount) AS revenue, COALESCE(SUM(quantity), 0) AS units
       FROM revenue_entries WHERE voided_at IS NULL GROUP BY year, month, source ORDER BY year, month`
    )
    .all();
}

const emptySources = () => ({ boost: { payments: 0, revenue: 0 }, sticker: { payments: 0, revenue: 0, units: 0 } });

/**
 * Turns the monthly rows into the report: every calendar year from the first one that earned anything up to this year
 * (years with nothing show as 0), each with what it earned, where it came from, and the running total at the end of
 * that year.
 * @param rows  [{ year, month, source?, payments, revenue, units? }] as returned by monthlyRows() (source defaults to boost)
 * @param thisYear the current year (a parameter so it can be tested)
 */
function buildReport(rows, thisYear = currentYear()) {
  const first = rows.length ? Math.min(rows[0].year, thisYear) : thisYear;
  const byYear = new Map();
  for (const r of rows) {
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year).push(r);
  }

  const years = [];
  const overall = emptySources();
  let cumulative = 0;
  let payments = 0;
  for (let year = first; year <= thisYear; year++) {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, payments: 0, revenue: 0 }));
    const bySource = emptySources();
    for (const r of byYear.get(year) || []) {
      const m = months[r.month - 1];
      m.payments += r.payments;
      m.revenue += r.revenue;
      const source = r.source === "sticker" ? "sticker" : "boost";
      bySource[source].payments += r.payments;
      bySource[source].revenue += r.revenue;
      if (source === "sticker") bySource.sticker.units += r.units || 0;
    }
    const revenue = months.reduce((sum, m) => sum + m.revenue, 0);
    const count = months.reduce((sum, m) => sum + m.payments, 0);
    for (const s of ["boost", "sticker"]) {
      overall[s].payments += bySource[s].payments;
      overall[s].revenue += bySource[s].revenue;
    }
    overall.sticker.units += bySource.sticker.units;
    cumulative += revenue;
    payments += count;
    years.push({ year, payments: count, revenue, cumulative, complete: year < thisYear, bySource, months });
  }
  return {
    currency: "NGN",
    timezone: "Africa/Lagos (UTC+1)",
    source: "Approved boosts, plus the sticker sales recorded by the owner",
    total: cumulative,
    payments,
    bySource: overall,
    thisYear,
    years,
  };
}

const revenueReport = () => buildReport(monthlyRows());

module.exports = {
  recordBoostRevenue,
  addStickerSale,
  listStickerSales,
  voidStickerSale,
  isRealDate,
  todayInNigeria,
  EARLIEST_SALE,
  monthlyRows,
  buildReport,
  revenueReport,
  currentYear,
};
