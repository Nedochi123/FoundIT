const express = require("express");
const path = require("node:path");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { runBackup, listBackups, BACKUP_DIR } = require("../utils/backup");
const { revokeAllRefreshTokensForUser } = require("../utils/tokens");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/backups", (req, res) => {
  res.json({ backups: listBackups() });
});

// On-demand snapshot, independent of the daily schedule — useful right
// before a risky manual change.
router.post("/backups", (req, res, next) => {
  try {
    const { file } = runBackup();
    res.status(201).json({ file });
  } catch (err) {
    next(err);
  }
});

// Lets an admin pull a copy off the Railway volume entirely (onto their
// own machine) — the daily snapshots alone only protect against
// application-level mistakes, not total volume loss, since they live on
// that same volume. Filename is validated against the exact pattern
// runBackup() generates, so this can't be used to read arbitrary paths.
const BACKUP_FILENAME_PATTERN = /^backup-[0-9TZ-]+\.db$/;
router.get("/backups/:filename", (req, res) => {
  if (!BACKUP_FILENAME_PATTERN.test(req.params.filename)) {
    return res.status(400).json({ error: "Invalid backup filename." });
  }
  res.download(path.join(BACKUP_DIR, req.params.filename), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Backup not found." });
  });
});

router.get("/cashout-requests", (req, res) => {
  const status = req.query.status;
  const rows = status
    ? db
        .prepare(
          `SELECT cashout_requests.*, users.name AS user_name, users.email AS user_email, users.id_number
           FROM cashout_requests JOIN users ON users.id = cashout_requests.user_id
           WHERE cashout_requests.status = ?
           ORDER BY cashout_requests.created_at ASC`
        )
        .all(status)
    : db
        .prepare(
          `SELECT cashout_requests.*, users.name AS user_name, users.email AS user_email, users.id_number
           FROM cashout_requests JOIN users ON users.id = cashout_requests.user_id
           ORDER BY cashout_requests.created_at DESC`
        )
        .all();

  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      userName: r.user_name,
      userEmail: r.user_email,
      idNumber: r.id_number,
      tokensSpent: r.tokens_spent,
      amountNaira: r.amount_naira,
      bankName: r.bank_name,
      accountNumber: r.account_number,
      accountName: r.account_name,
      status: r.status,
      createdAt: r.created_at,
      processedAt: r.processed_at,
    })),
  });
});

const updateSchema = z.object({
  status: z.enum(["paid", "rejected"]),
});

router.patch("/cashout-requests/:id", (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const request = db.prepare("SELECT * FROM cashout_requests WHERE id = ?").get(req.params.id);
    if (!request) return res.status(404).json({ error: "Cash-out request not found." });
    if (request.status !== "pending") {
      return res.status(400).json({ error: "This request has already been processed." });
    }

    // Rejecting a request refunds the tokens it spent — approving one
    // doesn't touch the balance further, since cashout already deducted
    // it up front at request time.
    const run = db.transaction(() => {
      db.prepare("UPDATE cashout_requests SET status = ?, processed_at = datetime('now') WHERE id = ?").run(
        parsed.data.status,
        request.id
      );

      if (parsed.data.status === "rejected") {
        db.prepare("UPDATE users SET tokens = tokens + ?, updated_at = datetime('now') WHERE id = ?").run(
          request.tokens_spent,
          request.user_id
        );
        db.prepare(
          `INSERT INTO token_ledger (id, user_id, delta, reason, note, cashout_id)
           VALUES (?, ?, ?, 'cashout_refund', ?, ?)`
        ).run(
          require("crypto").randomUUID(),
          request.user_id,
          request.tokens_spent,
          `Cash-out request rejected — ${request.tokens_spent} tokens refunded`,
          request.id
        );
      }
    });

    run();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Every number here is derived straight from existing timestamped rows
// (found_items, token_ledger, cashout_requests) — nothing new is
// tracked separately. This just aggregates what's already recorded, so
// a growth-over-time report can be built later without needing to
// backfill anything.
router.get("/stats", (req, res) => {
  const totalUsers = db.prepare("SELECT COUNT(*) c FROM users").get().c;
  const totalFoundItems = db.prepare("SELECT COUNT(*) c FROM found_items").get().c;
  const totalLostItems = db.prepare("SELECT COUNT(*) c FROM lost_items").get().c;
  const totalConfirmedReturns = db
    .prepare("SELECT COUNT(*) c FROM found_items WHERE return_confirmed_at IS NOT NULL")
    .get().c;
  const totalTokensAwarded =
    db.prepare("SELECT COALESCE(SUM(delta), 0) s FROM token_ledger WHERE reason = 'find_confirmed'").get().s;
  const totalNairaPaidOut =
    db.prepare("SELECT COALESCE(SUM(amount_naira), 0) s FROM cashout_requests WHERE status = 'paid'").get().s;

  const monthlyFoundItems = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
       FROM found_items GROUP BY month ORDER BY month ASC`
    )
    .all();
  const monthlyConfirmedReturns = db
    .prepare(
      `SELECT strftime('%Y-%m', return_confirmed_at) AS month, COUNT(*) AS count
       FROM found_items WHERE return_confirmed_at IS NOT NULL GROUP BY month ORDER BY month ASC`
    )
    .all();
  const monthlySignups = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
       FROM users GROUP BY month ORDER BY month ASC`
    )
    .all();

  res.json({
    totals: {
      users: totalUsers,
      foundItems: totalFoundItems,
      lostItems: totalLostItems,
      confirmedReturns: totalConfirmedReturns,
      tokensAwarded: totalTokensAwarded,
      nairaPaidOut: totalNairaPaidOut,
    },
    monthly: {
      foundItems: monthlyFoundItems,
      confirmedReturns: monthlyConfirmedReturns,
      signups: monthlySignups,
    },
  });
});

// target_id points into a different table depending on target_type, so
// each report's preview is resolved individually rather than with one
// JOIN — reports are low-volume (admin-only, not a hot path), so the
// N+1 here is the simpler, more readable choice.
function resolveReportTarget(report) {
  if (report.target_type === "found_item") {
    const item = db.prepare("SELECT description, photo_url FROM found_items WHERE id = ?").get(report.target_id);
    return item ? { description: item.description, photoUrl: item.photo_url } : { deleted: true };
  }
  if (report.target_type === "lost_item") {
    const item = db.prepare("SELECT description, status FROM lost_items WHERE id = ?").get(report.target_id);
    return item ? { description: item.description } : { deleted: true };
  }
  const user = db.prepare("SELECT name, email, suspended_at FROM users WHERE id = ?").get(report.target_id);
  return user ? { name: user.name, email: user.email, suspended: !!user.suspended_at } : { deleted: true };
}

router.get("/reports", (req, res) => {
  const status = req.query.status;
  const rows = status
    ? db
        .prepare(
          `SELECT reports.*, users.name AS reporter_name, users.email AS reporter_email
           FROM reports JOIN users ON users.id = reports.reporter_id
           WHERE reports.status = ?
           ORDER BY reports.created_at ASC`
        )
        .all(status)
    : db
        .prepare(
          `SELECT reports.*, users.name AS reporter_name, users.email AS reporter_email
           FROM reports JOIN users ON users.id = reports.reporter_id
           ORDER BY reports.created_at DESC`
        )
        .all();

  res.json({
    reports: rows.map((r) => ({
      id: r.id,
      reporterName: r.reporter_name,
      reporterEmail: r.reporter_email,
      targetType: r.target_type,
      targetId: r.target_id,
      target: resolveReportTarget(r),
      reason: r.reason,
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    })),
  });
});

const reportActionSchema = z.object({
  action: z.enum(["dismiss", "remove_item", "suspend_user"]),
});

router.patch("/reports/:id", (req, res, next) => {
  try {
    const parsed = reportActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found." });
    if (report.status !== "pending") {
      return res.status(400).json({ error: "This report has already been resolved." });
    }

    const { action } = parsed.data;

    if (action === "remove_item") {
      if (report.target_type === "found_item") {
        db.prepare("DELETE FROM found_items WHERE id = ?").run(report.target_id);
      } else if (report.target_type === "lost_item") {
        db.prepare("DELETE FROM lost_items WHERE id = ?").run(report.target_id);
      } else {
        return res.status(400).json({ error: "This report isn't about an item." });
      }
    } else if (action === "suspend_user") {
      if (report.target_type !== "user") {
        return res.status(400).json({ error: "This report isn't about a user." });
      }
      db.prepare("UPDATE users SET suspended_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(
        report.target_id
      );
      revokeAllRefreshTokensForUser(report.target_id);
    }

    db.prepare("UPDATE reports SET status = ?, resolved_at = datetime('now') WHERE id = ?").run(
      action === "dismiss" ? "dismissed" : "actioned",
      report.id
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/users/:id/unsuspend", (req, res) => {
  db.prepare("UPDATE users SET suspended_at = NULL, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
