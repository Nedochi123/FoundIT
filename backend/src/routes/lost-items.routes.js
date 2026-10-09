const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireOwnedLostItem } = require("../middleware/auth");
const { postItemLimiter } = require("../middleware/rateLimiters");
const { broadcastPush } = require("../utils/push");
const { idNumberSchema } = require("../utils/idNumber");
const { ITEM_CATEGORIES } = require("../utils/itemCategories");

const router = express.Router();

// When a paid boost on this post ends (null if it has none running): see boosts.routes.js
const BOOSTED_UNTIL_SQL = `(SELECT MAX(expires_at) FROM boosts WHERE boosts.lost_item_id = lost_items.id
  AND boosts.status = 'active' AND boosts.expires_at > datetime('now'))`;

function serialize(row, posterName) {
  return {
    id: row.id,
    posterId: row.poster_id,
    posterName,
    description: row.description,
    location: row.location,
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    boostedUntil: row.boosted_until || null,
  };
}

router.get("/", requireAuth, (req, res) => {
  const status = req.query.status === "resolved" ? "resolved" : "open";
  // boosted posts first, then newest
  const rows = db
    .prepare(
      `SELECT lost_items.*, users.name AS poster_name, ${BOOSTED_UNTIL_SQL} AS boosted_until
       FROM lost_items JOIN users ON users.id = lost_items.poster_id
       WHERE lost_items.status = ?
       ORDER BY (boosted_until IS NOT NULL) DESC, lost_items.created_at DESC`
    )
    .all(status);

  // each student also sees where their own posts stand with a boost (waiting to be paid, being checked, live)
  const mine = db
    .prepare(
      `SELECT id, lost_item_id, plan, amount, reference, status, expires_at FROM boosts
       WHERE user_id = ? AND (status IN ('awaiting_payment', 'payment_claimed')
         OR (status = 'active' AND expires_at > datetime('now')))`
    )
    .all(req.user.id);
  const boostByItem = new Map(mine.map((b) => [b.lost_item_id, b]));

  res.json({
    items: rows.map((r) => {
      const item = serialize(r, r.poster_name);
      const b = r.poster_id === req.user.id ? boostByItem.get(r.id) : null;
      if (b) {
        item.boost = {
          id: b.id,
          state: b.status === "active" ? "live" : b.status,
          plan: b.plan,
          amount: b.amount,
          reference: b.reference,
          expiresAt: b.expires_at,
        };
      }
      return item;
    }),
  });
});

const createSchema = z.object({
  description: z.string().trim().min(1, "Describe what you lost.").max(1000),
  location: z.string().trim().max(200).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  idNumber: idNumberSchema,
});

router.post("/", requireAuth, postItemLimiter, (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { description, location, category: itemCategory, idNumber } = parsed.data;

    // Fill id_number once, only if the user hasn't already provided it —
    // same "ask once, never again" rule as the found-item flow.
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (idNumber && !user.id_number) {
      db.prepare("UPDATE users SET id_number = ? WHERE id = ?").run(idNumber, req.user.id);
    }

    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO lost_items (id, poster_id, description, location, category) VALUES (?, ?, ?, ?, ?)"
    ).run(id, req.user.id, description, location || null, itemCategory || null);

    const item = db.prepare("SELECT * FROM lost_items WHERE id = ?").get(id);
    res.status(201).json({ item: serialize(item, req.user.name) });

    broadcastPush({
      title: "Lost Something!!",
      body: `${req.user.name} lost something on campus — can you help?`,
      url: "/gallery",
      excludeUserId: req.user.id,
      category: "lost",
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
