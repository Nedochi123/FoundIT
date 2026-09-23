const express = require("express");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

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

module.exports = router;
