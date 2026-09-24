const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const createSchema = z.object({
  targetType: z.enum(["found_item", "lost_item", "user"]),
  targetId: z.string().min(1),
  reason: z.enum(["inappropriate", "spam", "scam", "harassment", "other"]),
  note: z.string().trim().max(500).optional(),
});

router.post("/", requireAuth, (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { targetType, targetId, reason, note } = parsed.data;

  if (targetType === "user" && targetId === req.user.id) {
    return res.status(400).json({ error: "You can't report yourself." });
  }

  db.prepare(
    "INSERT INTO reports (id, reporter_id, target_type, target_id, reason, note) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), req.user.id, targetType, targetId, reason, note || null);

  res.status(201).json({ ok: true });
});

module.exports = router;
