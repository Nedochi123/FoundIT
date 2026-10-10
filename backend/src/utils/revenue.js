const db = require("../../db");

// What FoundIT has earned, for the owner page. The only income the app itself records is boosts: a student pays a
// bank transfer, the admin checks it and approves, and that approval writes one row to revenue_entries (see
// db/schema.sql for why it is a separate table). Not counted, because they are not FoundIT's income or aren't recorded
// in the app: thank-you rewards (paid student to student), token cash-outs (a cost, not income), QR sticker sales.
//
// Years are calendar years in Nigerian time (Africa/Lagos, UTC+1 all year), so a payment approved at 23:30 UTC on
// 31 December counts in the new year, as it did on the owner's clock.

const WAT_HOURS = 1;

/** Writes the ledger row for a boost the admin has just approved. Safe to call twice for the same boost. */
function recordBoostRevenue(boostId) {
  const boost = db.prepare("SELECT id, amount, reference FROM boosts WHERE id = ?").get(boostId);
  if (!boost) return;
  db.prepare("INSERT OR IGNORE INTO revenue_entries (id, source, amount, reference, earned_at) VALUES (?, 'boost', ?, ?, datetime('now'))").run(
    boost.id,
    boost.amount,
    boost.reference
  );
}

/** One row per (year, month) that has any revenue, in Nigerian time. */
function monthlyRows() {
  return db
    .prepare(
      `SELECT CAST(strftime('%Y', datetime(earned_at, '+${WAT_HOURS} hours')) AS INTEGER) AS year,
              CAST(strftime('%m', datetime(earned_at, '+${WAT_HOURS} hours')) AS INTEGER) AS month,
              COUNT(*) AS payments, SUM(amount) AS revenue
       FROM revenue_entries GROUP BY year, month ORDER BY year, month`
    )
    .all();
}

const currentYear = () => new Date(Date.now() + WAT_HOURS * 3600 * 1000).getUTCFullYear();

/**
 * Turns the monthly rows into the report: every calendar year from the first one that earned anything up to this year
 * (years with nothing show as 0), each with what it earned and the running total at the end of that year.
 * @param rows  [{ year, month, payments, revenue }] as returned by monthlyRows()
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
  let cumulative = 0;
  let payments = 0;
  for (let year = first; year <= thisYear; year++) {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, payments: 0, revenue: 0 }));
    for (const r of byYear.get(year) || []) {
      months[r.month - 1] = { month: r.month, payments: r.payments, revenue: r.revenue };
    }
    const revenue = months.reduce((sum, m) => sum + m.revenue, 0);
    const count = months.reduce((sum, m) => sum + m.payments, 0);
    cumulative += revenue;
    payments += count;
    years.push({ year, payments: count, revenue, cumulative, complete: year < thisYear, months });
  }
  return {
    currency: "NGN",
    timezone: "Africa/Lagos (UTC+1)",
    source: "Boosts students paid for and the admin approved",
    total: cumulative,
    payments,
    thisYear,
    years,
  };
}

const revenueReport = () => buildReport(monthlyRows());

module.exports = { recordBoostRevenue, monthlyRows, buildReport, revenueReport, currentYear };
