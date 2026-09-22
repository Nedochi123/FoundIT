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

module.exports = router;
