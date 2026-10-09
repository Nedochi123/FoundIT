const crypto = require("crypto");
const db = require("../../db");

// What a boost costs and how long it lasts. Prices are in naira. The app shows these (frontend/src/lib/boosts.js
// mirrors them); change them here and there to change the offer.
const BOOST_PLANS = [
  { id: "1d", hours: 24, amount: 300, label: "24 hours" },
  { id: "3d", hours: 72, amount: 700, label: "3 days" },
  { id: "7d", hours: 168, amount: 1200, label: "7 days" },
];

const MAX_OPEN_REQUESTS_PER_USER = 3;
const UNPAID_EXPIRY_DAYS = 2;

// No look-alike characters, so a reference read out or typed into a bank app isn't mistaken.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const newReference = () => "BST-" + Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");

const getPlan = (id) => BOOST_PLANS.find((p) => p.id === id);

/** The bank account boosts are paid into, as the admin typed it in, or null until they have. */
function getPaymentDetails() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'boost_payment'").get();
  if (!row) return null;
  try {
    const d = JSON.parse(row.value);
    return d && d.bank && d.accountNumber && d.accountName ? d : null;
  } catch {
    return null;
  }
}

function setPaymentDetails(details) {
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('boost_payment', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(JSON.stringify(details));
}

/** Boosts nobody paid for within a couple of days are dropped, so they don't block the post or pile up. */
function cancelStaleUnpaid() {
  db.prepare(
    `UPDATE boosts SET status = 'cancelled', updated_at = datetime('now')
     WHERE status = 'awaiting_payment' AND created_at < datetime('now', ?)`
  ).run(`-${UNPAID_EXPIRY_DAYS} days`);
}

module.exports = { BOOST_PLANS, MAX_OPEN_REQUESTS_PER_USER, UNPAID_EXPIRY_DAYS, newReference, getPlan, getPaymentDetails, setPaymentDetails, cancelStaleUnpaid };
