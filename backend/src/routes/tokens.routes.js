const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Tier -> naira payout. Same 100-naira-per-token rate at both tiers —
// waiting for 100 just lets a student cash out a bigger sum in one go,
// it isn't a bonus rate.
const CASHOUT_TIERS = {
  50: 5000,
  100: 10000,
};

router.get("/ledger", requireAuth, (req, res) => {
  const user = db.prepare("SELECT tokens FROM users WHERE id = ?").get(req.user.id);
  const entries = db
    .prepare("SELECT * FROM token_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(req.user.id);

  res.json({
    tokens: user.tokens,
    entries: entries.map((e) => ({
      id: e.id,
      delta: e.delta,
      reason: e.reason,
      note: e.note,
      createdAt: e.created_at,
    })),
  });
});

router.get("/cashout-requests", requireAuth, (req, res) => {
  const requests = db
    .prepare("SELECT * FROM cashout_requests WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.id);

  res.json({
    requests: requests.map((r) => ({
      id: r.id,
      tokensSpent: r.tokens_spent,
      amountNaira: r.amount_naira,
      status: r.status,
      createdAt: r.created_at,
      processedAt: r.processed_at,
    })),
  });
});

const cashoutSchema = z.object({
  tier: z.union([z.literal(50), z.literal(100)]),
  // these are shown to the admin and kept for the payout, so they are checked like the boost payment details are
  bankName: z.string().trim().min(1, "Bank name is required.").max(60, "That bank name is too long."),
  accountNumber: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, ""))
    .refine((s) => /^[0-9]{6,20}$/.test(s), "The account number should be digits only (usually 10)."),
  accountName: z.string().trim().min(1, "Account name is required.").max(80, "That account name is too long."),
});

router.post("/cashout", requireAuth, (req, res, next) => {
  try {
    const parsed = cashoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { tier, bankName, accountNumber, accountName } = parsed.data;
    const amountNaira = CASHOUT_TIERS[tier];

    const user = db.prepare("SELECT tokens FROM users WHERE id = ?").get(req.user.id);
    if (user.tokens < tier) {
      return res.status(400).json({ error: `You need at least ${tier} tokens to cash out this tier.` });
    }

    const run = db.transaction(() => {
      const cashoutId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO cashout_requests (id, user_id, tokens_spent, amount_naira, bank_name, account_number, account_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(cashoutId, req.user.id, tier, amountNaira, bankName, accountNumber, accountName);

      // taking the tokens is what checks the balance (never below zero), inside the same step that saves the request, so two
      // cash-outs started together can never both be paid from the same tokens
      const taken = db
        .prepare("UPDATE users SET tokens = tokens - ?, updated_at = datetime('now') WHERE id = ? AND tokens >= ?")
        .run(tier, req.user.id, tier);
      if (Number(taken.changes) !== 1) {
        throw Object.assign(new Error(`You need at least ${tier} tokens to cash out this tier.`), { status: 400 }); // undoes the whole step
      }

      const ledgerId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO token_ledger (id, user_id, delta, reason, note, cashout_id)
         VALUES (?, ?, ?, 'cashout', ?, ?)`
      ).run(ledgerId, req.user.id, -tier, `Cashed out ${tier} tokens for ₦${amountNaira.toLocaleString()}`, cashoutId);

      return {
        cashout: db.prepare("SELECT * FROM cashout_requests WHERE id = ?").get(cashoutId),
        tokens: db.prepare("SELECT tokens FROM users WHERE id = ?").get(req.user.id).tokens,
      };
    });

    const { cashout, tokens } = run();

    res.status(201).json({
      tokens,
      cashout: {
        id: cashout.id,
        tokensSpent: cashout.tokens_spent,
        amountNaira: cashout.amount_naira,
        status: cashout.status,
        createdAt: cashout.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Ranked by number of confirmed finds, not current token balance --
// balance drops when someone cashes out, which would unfairly punish
// the students who've actually helped the most.
router.get("/leaderboard", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT users.name, COUNT(*) AS finds
       FROM token_ledger
       JOIN users ON users.id = token_ledger.user_id
       WHERE token_ledger.reason = 'find_confirmed' AND users.deleted_at IS NULL
       GROUP BY token_ledger.user_id
       ORDER BY finds DESC, MIN(token_ledger.created_at) ASC
       LIMIT 10`
    )
    .all();

  res.json({ leaderboard: rows.map((r) => ({ name: r.name, finds: r.finds })) });
});

module.exports = router;
