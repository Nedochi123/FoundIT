const db = require("../../db");

// Old open posts pile up forever otherwise — a lost umbrella reported
// six months ago is almost certainly never getting reunited, and just
// clutters the gallery/broadcast history for everyone browsing newer,
// realistic reports. Reuses status='resolved' (rather than a new status
// value) so the gallery's existing open/resolved filtering handles this
// for free; expired_at is the separate marker that distinguishes "this
// aged out" from "someone actually resolved it."
const EXPIRY_DAYS = Number(process.env.ITEM_EXPIRY_DAYS) || 60;

function expireStaleItems() {
  const lostResult = db
    .prepare(
      `UPDATE lost_items SET status = 'resolved', expired_at = datetime('now'), updated_at = datetime('now')
       WHERE status = 'open' AND created_at < datetime('now', ?)`
    )
    .run(`-${EXPIRY_DAYS} days`);

  const foundResult = db
    .prepare(
      `UPDATE found_items SET status = 'resolved', expired_at = datetime('now'), updated_at = datetime('now')
       WHERE status = 'open' AND created_at < datetime('now', ?)`
    )
    .run(`-${EXPIRY_DAYS} days`);

  return { lostExpired: lostResult.changes, foundExpired: foundResult.changes };
}

module.exports = { expireStaleItems, EXPIRY_DAYS };
