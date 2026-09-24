const express = require("express");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth } = require("../middleware/auth");
const { idNumberSchema } = require("../utils/idNumber");

const router = express.Router();

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  idNumber: idNumberSchema,
});

router.patch("/me", requireAuth, (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { name, idNumber } = parsed.data;
    if (name === undefined && idNumber === undefined) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (idNumber !== undefined) {
      updates.push("id_number = ?");
      values.push(idNumber);
    }
    updates.push("updated_at = datetime('now')");
    values.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        idNumber: user.id_number,
        emailVerified: !!user.email_verified_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Badges are computed live from token_ledger's 'find_confirmed' rows
// (the same count already used everywhere else as "confirmed finds"),
// not stored anywhere separately -- one source of truth, and a badge
// can never drift out of sync with the number it's celebrating.
const BADGE_MILESTONES = [
  { id: "first_find", threshold: 1, label: "First Find" },
  { id: "five_reunions", threshold: 5, label: "5 Reunions" },
  { id: "ten_reunions", threshold: 10, label: "10 Reunions" },
];

router.get("/me/badges", requireAuth, (req, res) => {
  const { count } = db
    .prepare("SELECT COUNT(*) count FROM token_ledger WHERE user_id = ? AND reason = 'find_confirmed'")
    .get(req.user.id);

  res.json({
    confirmedFinds: count,
    badges: BADGE_MILESTONES.filter((b) => count >= b.threshold).map((b) => ({ id: b.id, label: b.label })),
  });
});

router.get("/me/notes", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT thank_you_notes.note, thank_you_notes.created_at, users.name AS from_name
       FROM thank_you_notes JOIN users ON users.id = thank_you_notes.from_user_id
       WHERE thank_you_notes.to_user_id = ?
       ORDER BY thank_you_notes.created_at DESC`
    )
    .all(req.user.id);

  res.json({
    notes: rows.map((r) => ({ note: r.note, fromName: r.from_name, createdAt: r.created_at })),
  });
});

module.exports = router;
