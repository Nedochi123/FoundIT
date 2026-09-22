const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireOwnedLostItem } = require("../middleware/auth");
const { broadcastPush } = require("../utils/push");
const { idNumberSchema } = require("../utils/idNumber");

const router = express.Router();

function serialize(row, posterName) {
  return {
    id: row.id,
    posterId: row.poster_id,
    posterName,
    description: row.description,
    location: row.location,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get("/", requireAuth, (req, res) => {
  const status = req.query.status === "resolved" ? "resolved" : "open";
  const rows = db
    .prepare(
      `SELECT lost_items.*, users.name AS poster_name
       FROM lost_items JOIN users ON users.id = lost_items.poster_id
       WHERE lost_items.status = ?
       ORDER BY lost_items.created_at DESC`
    )
    .all(status);
  res.json({ items: rows.map((r) => serialize(r, r.poster_name)) });
});

const createSchema = z.object({
  description: z.string().trim().min(1, "Describe what you lost.").max(1000),
  location: z.string().trim().max(200).optional(),
  idNumber: idNumberSchema,
});

router.post("/", requireAuth, (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { description, location, idNumber } = parsed.data;

    // Fill id_number once, only if the user hasn't already provided it —
    // same "ask once, never again" rule as the found-item flow.
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (idNumber && !user.id_number) {
      db.prepare("UPDATE users SET id_number = ? WHERE id = ?").run(idNumber, req.user.id);
    }

    const id = crypto.randomUUID();
    db.prepare("INSERT INTO lost_items (id, poster_id, description, location) VALUES (?, ?, ?, ?)").run(
      id,
      req.user.id,
      description,
      location || null
    );

    const item = db.prepare("SELECT * FROM lost_items WHERE id = ?").get(id);
    res.status(201).json({ item: serialize(item, req.user.name) });

    broadcastPush({
      title: "Lost Something!!",
      body: `${req.user.name} lost something on campus — can you help?`,
      url: "/gallery",
      excludeUserId: req.user.id,
    }).catch((err) => console.error("Broadcast push failed:", err));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/resolve", requireAuth, requireOwnedLostItem(db), (req, res) => {
  db.prepare(
    "UPDATE lost_items SET status = 'resolved', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
