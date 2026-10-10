const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { boostLimiter } = require("../middleware/rateLimiters");
const { notifyUser, broadcastPush } = require("../utils/push");
const { isAdminAccount } = require("../utils/admin");
const { recordBoostRevenue } = require("../utils/revenue");
const {
  BOOST_PLANS,
  MAX_OPEN_REQUESTS_PER_USER,
  newReference,
  getPlan,
  getPaymentDetails,
  setPaymentDetails,
  cancelStaleUnpaid,
} = require("../utils/boosts");

// Paid "boosts" for lost posts: pinned to the top of the Lost board and Home for a while, plus one alert to the
// campus. The student pays by bank transfer and the admin approves it (see schema.sql, "BOOSTS").
const router = express.Router();
router.use(requireAuth);

// 'active' past its end time is just an ended boost
const STATE_SQL = `CASE
  WHEN boosts.status = 'active' AND boosts.expires_at <= datetime('now') THEN 'ended'
  WHEN boosts.status = 'active' THEN 'live'
  ELSE boosts.status END`;

const BOOST_SELECT = `SELECT boosts.*, ${STATE_SQL} AS state, lost_items.description AS item_description,
    lost_items.status AS item_status, users.name AS user_name, users.email AS user_email
  FROM boosts
  JOIN lost_items ON lost_items.id = boosts.lost_item_id
  JOIN users ON users.id = boosts.user_id`;

const view = (b, { payment = false } = {}) => ({
  id: b.id,
  lostItemId: b.lost_item_id,
  itemDescription: b.item_description,
  plan: b.plan,
  hours: b.hours,
  amount: b.amount,
  reference: b.reference,
  state: b.state,
  payerNote: b.payer_note,
  paidClaimedAt: b.paid_claimed_at,
  startsAt: b.starts_at,
  expiresAt: b.expires_at,
  rejectReason: b.reject_reason,
  createdAt: b.created_at,
  // where to send the money: only shown to the student while they still need to pay
  paymentDetails: payment && ["awaiting_payment", "payment_claimed"].includes(b.state) ? getPaymentDetails() : null,
});

const adminView = (b) => ({
  ...view(b),
  requester: { name: b.user_name, email: b.user_email },
  itemStatus: b.item_status,
});

const byId = (id) => db.prepare(`${BOOST_SELECT} WHERE boosts.id = ?`).get(id);

/** One of the signed-in student's own boosts, or null. */
function mineById(req) {
  const b = byId(req.params.id);
  return b && b.user_id === req.user.id ? b : null;
}

const adminUserIds = () =>
  db
    .prepare("SELECT id, email, email_verified_at, created_at FROM users WHERE deleted_at IS NULL")
    .all()
    .filter((u) => isAdminAccount(u))
    .map((u) => u.id);

// ---------- students ----------

router.get("/plans", (req, res) => {
  res.json({ enabled: Boolean(getPaymentDetails()), plans: BOOST_PLANS });
});

const createSchema = z.object({
  lostItemId: z.string().min(1, "Choose the post to boost."),
  plan: z.enum(BOOST_PLANS.map((p) => p.id), { message: "Choose how long to boost it for." }),
});

router.post("/", boostLimiter, (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    if (!getPaymentDetails()) {
      return res.status(503).json({ error: "Boosts aren't available just yet. Please try again soon." });
    }

    const item = db.prepare("SELECT * FROM lost_items WHERE id = ?").get(parsed.data.lostItemId);
    if (!item) return res.status(404).json({ error: "Post not found." });
    if (item.poster_id !== req.user.id) return res.status(403).json({ error: "You can only boost your own posts." });
    if (item.status !== "open") return res.status(409).json({ error: "This post is already marked as found." });

    cancelStaleUnpaid();
    const inProgress = db
      .prepare(
        `SELECT ${STATE_SQL} AS state, expires_at FROM boosts WHERE lost_item_id = ?
         AND (status IN ('awaiting_payment', 'payment_claimed') OR (status = 'active' AND expires_at > datetime('now')))`
      )
      .get(item.id);
    if (inProgress) {
      return res.status(409).json({
        error: inProgress.state === "live" ? "This post is already boosted." : "This post already has a boost waiting to be paid or approved.",
      });
    }
    const open = db
      .prepare("SELECT COUNT(*) n FROM boosts WHERE user_id = ? AND status IN ('awaiting_payment', 'payment_claimed')")
      .get(req.user.id).n;
    if (open >= MAX_OPEN_REQUESTS_PER_USER) {
      return res.status(429).json({ error: "You have several boosts waiting. Finish or cancel one first." });
    }

    const plan = getPlan(parsed.data.plan);
    const id = crypto.randomUUID();
    for (let attempt = 0; ; attempt++) {
      try {
        db.prepare("INSERT INTO boosts (id, lost_item_id, user_id, plan, hours, amount, reference) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
          id,
          item.id,
          req.user.id,
          plan.id,
          plan.hours,
          plan.amount,
          newReference()
        );
        break;
      } catch (err) {
        if (attempt > 5 || !/UNIQUE/i.test(err.message)) throw err; // a reference clash is vanishingly rare: try another
      }
    }
    res.status(201).json({ boost: view(byId(id), { payment: true }) });
  } catch (err) {
    next(err);
  }
});

router.get("/mine", (req, res) => {
  cancelStaleUnpaid();
  const rows = db.prepare(`${BOOST_SELECT} WHERE boosts.user_id = ? ORDER BY boosts.created_at DESC LIMIT 50`).all(req.user.id);
  res.json({ boosts: rows.map((b) => view(b, { payment: true })) });
});

// Admin routes come before /:id so "admin" is never read as an id.

const settingsSchema = z.object({
  bank: z.string().trim().min(2, "Enter the bank's name.").max(60),
  accountNumber: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, ""))
    .refine((s) => /^[0-9]{6,20}$/.test(s), "The account number should be digits only (usually 10)."),
  accountName: z.string().trim().min(2, "Enter the name on the account.").max(80),
});

router.get("/admin", requireAdmin, (req, res) => {
  cancelStaleUnpaid();
  const queue = db
    .prepare(
      `${BOOST_SELECT} WHERE boosts.status IN ('awaiting_payment', 'payment_claimed')
       ORDER BY (boosts.status = 'payment_claimed') DESC, boosts.created_at ASC`
    )
    .all();
  const recent = db
    .prepare(`${BOOST_SELECT} WHERE boosts.status IN ('active', 'rejected') ORDER BY boosts.updated_at DESC LIMIT 30`)
    .all();
  const revenue = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count,
         COALESCE(SUM(CASE WHEN strftime('%Y-%m', approved_at) = strftime('%Y-%m', 'now') THEN amount END), 0) AS this_month
       FROM boosts WHERE approved_at IS NOT NULL`
    )
    .get();
  res.json({
    settings: getPaymentDetails(),
    plans: BOOST_PLANS,
    queue: queue.map(adminView),
    recent: recent.map(adminView),
    revenue: { total: revenue.total, thisMonth: revenue.this_month, count: revenue.count },
  });
});

router.put("/admin/settings", requireAdmin, (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    setPaymentDetails(parsed.data);
    res.json({ settings: parsed.data });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/:id/approve", requireAdmin, (req, res, next) => {
  try {
    const b = byId(req.params.id);
    if (!b) return res.status(404).json({ error: "Boost not found." });
    if (!["awaiting_payment", "payment_claimed"].includes(b.state)) {
      return res.status(409).json({ error: "This boost has already been dealt with." });
    }
    if (b.item_status !== "open") {
      return res.status(409).json({ error: "That post has been marked found, so there's nothing to boost. Reject this one." });
    }
    db.prepare(
      `UPDATE boosts SET status = 'active', approved_at = datetime('now'), starts_at = datetime('now'),
         expires_at = datetime('now', ?), decided_by = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(`+${b.hours} hours`, req.user.id, b.id);
    recordBoostRevenue(b.id); // the payment now counts as revenue, even if the student's account is deleted later

    notifyUser(b.user_id, {
      title: "Your boost is live 🚀",
      body: "Your lost post is now at the top for everyone on campus to see.",
      url: "/?lost=1",
    }).catch(() => {});
    broadcastPush({
      title: "Help find this 🔎",
      body: `${b.user_name} is looking for: ${String(b.item_description).slice(0, 90)}`,
      url: "/?lost=1",
      excludeUserId: b.user_id,
      category: "lost",
    }).catch((err) => console.error("Boost broadcast failed:", err));

    res.json({ boost: adminView(byId(b.id)) });
  } catch (err) {
    next(err);
  }
});

const rejectSchema = z.object({ reason: z.string().trim().max(200).optional() });

router.post("/admin/:id/reject", requireAdmin, (req, res, next) => {
  try {
    const parsed = rejectSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "That reason is too long." });
    const b = byId(req.params.id);
    if (!b) return res.status(404).json({ error: "Boost not found." });
    if (!["awaiting_payment", "payment_claimed"].includes(b.state)) {
      return res.status(409).json({ error: "This boost has already been dealt with." });
    }
    db.prepare("UPDATE boosts SET status = 'rejected', reject_reason = ?, decided_by = ?, updated_at = datetime('now') WHERE id = ?").run(
      parsed.data.reason || null,
      req.user.id,
      b.id
    );
    notifyUser(b.user_id, {
      title: "Your boost wasn't approved",
      body: parsed.data.reason || "We couldn't match your payment. Open FoundIT for details.",
      url: "/?lost=1",
    }).catch(() => {});
    res.json({ boost: adminView(byId(b.id)) });
  } catch (err) {
    next(err);
  }
});

// ---------- one boost, for the student who made it ----------

router.get("/:id", (req, res) => {
  const b = mineById(req);
  if (!b) return res.status(404).json({ error: "Boost not found." });
  res.json({ boost: view(b, { payment: true }) });
});

const paidSchema = z.object({ note: z.string().trim().max(120).optional() });

router.post("/:id/paid", (req, res, next) => {
  try {
    const parsed = paidSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "That note is too long." });
    const b = mineById(req);
    if (!b) return res.status(404).json({ error: "Boost not found." });
    if (b.state !== "awaiting_payment") return res.status(409).json({ error: "This boost isn't waiting for payment." });
    db.prepare(
      "UPDATE boosts SET status = 'payment_claimed', payer_note = ?, paid_claimed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run(parsed.data.note || null, b.id);

    for (const adminId of adminUserIds()) {
      notifyUser(adminId, {
        title: "A boost payment is waiting",
        body: `${b.user_name} says they paid ₦${b.amount.toLocaleString()} (${b.reference}). Open Admin to check and approve.`,
        url: "/?admin=1",
      }).catch(() => {});
    }
    res.json({ boost: view(byId(b.id), { payment: true }) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/cancel", (req, res, next) => {
  try {
    const b = mineById(req);
    if (!b) return res.status(404).json({ error: "Boost not found." });
    if (b.state !== "awaiting_payment") {
      return res.status(409).json({ error: "You can only cancel a boost before you say you've paid. Message us if you've already paid." });
    }
    db.prepare("UPDATE boosts SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(b.id);
    res.json({ boost: view(byId(b.id)) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
