const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireOwnedLostItem } = require("../middleware/auth");
const { postItemLimiter } = require("../middleware/rateLimiters");
const { broadcastPush } = require("../utils/push");
const { idNumberSchema } = require("../utils/idNumber");
const { ITEM_CATEGORIES } = require("../utils/itemCategories");
const { REWARD_AMOUNTS } = require("../utils/rewards");
const { MAX_URGENT_OPEN_PER_USER, MAX_URGENT_PER_WEEK, ACTIVE_URGENT_SQL, alertText } = require("../utils/urgent");

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
    // set while an "Urgently need" post is inside its alert window: the reward everyone can see
    urgent: row.urgent_active ? { reward: row.urgent_reward, at: row.urgent_at } : null,
  };
}

router.get("/", requireAuth, (req, res) => {
  const status = req.query.status === "resolved" ? "resolved" : "open";
  // urgent posts first, then boosted, then newest
  const rows = db
    .prepare(
      `SELECT lost_items.*, users.name AS poster_name, ${BOOSTED_UNTIL_SQL} AS boosted_until,
              ${ACTIVE_URGENT_SQL} AS urgent_active
       FROM lost_items JOIN users ON users.id = lost_items.poster_id
       WHERE lost_items.status = ?
       ORDER BY urgent_active DESC, (boosted_until IS NOT NULL) DESC, lost_items.created_at DESC`
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

// Everything urgent right now, newest first: what the alert pop-up and the Home alerts show to every student.
router.get("/urgent", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT lost_items.*, users.name AS poster_name, 1 AS urgent_active
       FROM lost_items JOIN users ON users.id = lost_items.poster_id
       WHERE ${ACTIVE_URGENT_SQL}
       ORDER BY lost_items.urgent_at DESC LIMIT 10`
    )
    .all();
  res.json({ items: rows.map((r) => serialize(r, r.poster_name)) });
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

// "Urgently need": a lost post with a compulsory reward and the poster's agreement to pay it. Publishing it
// alerts everyone (see utils/urgent.js for what that means and the limits).
const urgentSchema = createSchema.extend({
  reward: z.number({ error: "Choose a reward amount." }).int().refine((n) => REWARD_AMOUNTS.includes(n), {
    message: "Please choose one of the reward amounts shown.",
  }),
  agree: z.literal(true, { error: "Please tick the box to agree to give the reward." }),
});

router.post("/urgent", requireAuth, postItemLimiter, (req, res, next) => {
  try {
    const parsed = urgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { description, location, category: itemCategory, idNumber, reward } = parsed.data;

    const open = db
      .prepare(`SELECT COUNT(*) AS n FROM lost_items WHERE poster_id = ? AND ${ACTIVE_URGENT_SQL}`)
      .get(req.user.id).n;
    if (open >= MAX_URGENT_OPEN_PER_USER) {
      return res.status(409).json({ error: "You already have an urgent request open. Mark it as found before starting another." });
    }
    const recent = db
      .prepare("SELECT COUNT(*) AS n FROM lost_items WHERE poster_id = ? AND urgent_at > datetime('now', '-7 days')")
      .get(req.user.id).n;
    if (recent >= MAX_URGENT_PER_WEEK) {
      return res.status(429).json({ error: "You've used your urgent alerts for this week. You can still post it as a normal lost item." });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (idNumber && !user.id_number) {
      db.prepare("UPDATE users SET id_number = ? WHERE id = ?").run(idNumber, req.user.id);
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO lost_items (id, poster_id, description, location, category, urgent_reward, urgent_at, urgent_agreed_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(id, req.user.id, description, location || null, itemCategory || null, reward);

    const item = db
      .prepare(`SELECT lost_items.*, ${ACTIVE_URGENT_SQL} AS urgent_active FROM lost_items WHERE id = ?`)
      .get(id);
    res.status(201).json({ item: serialize(item, req.user.name) });

    // everyone with notifications on gets this, whatever their lost-alert setting; the poster is left out
    const { title, body } = alertText(req.user.name, description, reward);
    broadcastPush({
      title,
      body,
      url: "/?lost=1",
      excludeUserId: req.user.id,
      extra: { urgent: true, tag: `urgent-${id}`, icon: "/icons/alert-192.png", badge: "/icons/alert-192.png" },
    }).catch((err) => console.error("Urgent broadcast failed:", err));
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
