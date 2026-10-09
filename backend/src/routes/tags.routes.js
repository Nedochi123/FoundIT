const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { tagFoundLimiter, tagClaimLimiter } = require("../middleware/rateLimiters");
const { notifyUser } = require("../utils/push");
const { sendEmail, tagFoundEmail } = require("../utils/email");
const { newTagCode, normalizeCode } = require("../utils/tags");

// "Return me" QR tags. A student sticks one on a laptop, bag or keys; anyone who finds it scans it and
// leaves a phone number and a message (no account needed); the owner is notified. The finder never sees
// the owner's name, number or email.
const router = express.Router();

const MAX_TAGS_PER_USER = 10;
const MAX_MESSAGES_PER_TAG_PER_HOUR = 5;
const MAX_MESSAGES_PER_TAG_PER_DAY = 15;

const tagWithOwner = (code) =>
  db
    .prepare(
      `SELECT tags.*, users.deleted_at AS owner_deleted_at, users.suspended_at AS owner_suspended_at
       FROM tags LEFT JOIN users ON users.id = tags.owner_id
       WHERE tags.code = ?`
    )
    .get(normalizeCode(code));

/** What a stranger scanning the sticker is told: unclaimed | active | paused | inactive. */
function publicStatus(tag) {
  if (!tag.owner_id) return tag.status === "unclaimed" ? "unclaimed" : "inactive";
  if (tag.owner_deleted_at || tag.owner_suspended_at) return "inactive";
  return tag.status === "paused" ? "paused" : "active";
}

// ---------- public (no sign-in): the page a finder lands on ----------

router.get("/public/:code", (req, res) => {
  const tag = tagWithOwner(req.params.code);
  if (!tag) return res.status(404).json({ status: "unknown" });
  const status = publicStatus(tag);
  // only the item's label is shown, never anything about the owner
  res.json({ status, label: status === "active" ? tag.label || null : null });
});

const foundSchema = z.object({
  name: z.string().trim().max(60).optional(),
  phone: z.string().trim().min(1, "Please enter a phone number so the owner can reach you.").max(30),
  message: z.string().trim().max(300).optional(),
  website: z.string().optional(), // hidden field: only bots fill it in
});

const digitsOf = (s) => String(s).replace(/\D/g, "");

router.post("/public/:code/found", tagFoundLimiter, (req, res, next) => {
  try {
    const parsed = foundSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { name, phone, message, website } = parsed.data;

    if (website) return res.status(201).json({ ok: true }); // a bot: say "done", save and tell nobody

    const n = digitsOf(phone).length;
    if (n < 7 || n > 15) {
      return res.status(400).json({ error: "Please enter a valid phone number so the owner can reach you." });
    }

    const tag = tagWithOwner(req.params.code);
    if (!tag) return res.status(404).json({ error: "We don't recognise this tag." });
    if (publicStatus(tag) !== "active") {
      return res.status(409).json({ error: "This tag isn't taking messages right now." });
    }

    const recent = db
      .prepare(
        `SELECT
           SUM(created_at >= datetime('now', '-1 hour')) AS last_hour,
           COUNT(*) AS last_day
         FROM tag_messages WHERE tag_id = ? AND created_at >= datetime('now', '-1 day')`
      )
      .get(tag.id);
    if ((recent.last_hour || 0) >= MAX_MESSAGES_PER_TAG_PER_HOUR || recent.last_day >= MAX_MESSAGES_PER_TAG_PER_DAY) {
      return res.status(429).json({ error: "The owner has already been sent several messages. Please try again later." });
    }

    db.prepare("INSERT INTO tag_messages (id, tag_id, finder_name, finder_phone, message) VALUES (?, ?, ?, ?, ?)").run(
      crypto.randomUUID(),
      tag.id,
      name || null,
      phone,
      message || null
    );

    // Tell the owner. The push says nothing about the finder (lock screens are public); the email, which
    // only the owner receives, carries the details.
    const what = tag.label || "FoundIT tag";
    notifyUser(tag.owner_id, {
      title: "Someone found your item 🎉",
      body: `Your ${what} was just scanned. Open FoundIT to see their message and contact them.`,
      url: "/?tags=1",
    }).catch(() => {});
    const owner = db.prepare("SELECT email FROM users WHERE id = ?").get(tag.owner_id);
    if (owner?.email) {
      sendEmail({
        to: owner.email,
        subject: `Someone found your ${what}`,
        html: tagFoundEmail({ label: what, finderName: name, finderPhone: phone, message }),
        devLogLabel: `Tag found: ${what}`,
      }).catch(() => {});
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- the owner (signed in) ----------

const mine = (req, id) => db.prepare("SELECT * FROM tags WHERE id = ? AND owner_id = ?").get(id, req.user.id);

const view = (row) => ({
  id: row.id,
  code: row.code,
  label: row.label,
  status: row.status,
  claimedAt: row.claimed_at,
  messageCount: row.message_count ?? 0,
  unreadCount: row.unread_count ?? 0,
});

router.get("/", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT tags.*,
         (SELECT COUNT(*) FROM tag_messages WHERE tag_id = tags.id) AS message_count,
         (SELECT COUNT(*) FROM tag_messages WHERE tag_id = tags.id AND read_at IS NULL) AS unread_count
       FROM tags WHERE owner_id = ? ORDER BY claimed_at DESC, created_at DESC`
    )
    .all(req.user.id);
  res.json({ tags: rows.map(view), maxTags: MAX_TAGS_PER_USER });
});

const claimSchema = z.object({
  code: z.string().trim().min(1, "Enter the code printed on the sticker."),
  label: z.string().trim().max(60).optional(),
});

router.post("/claim", requireAuth, tagClaimLimiter, (req, res, next) => {
  try {
    const parsed = claimSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const tag = db.prepare("SELECT * FROM tags WHERE code = ?").get(normalizeCode(parsed.data.code));
    if (!tag) return res.status(404).json({ error: "We couldn't find that tag. Check the code printed on the sticker." });
    if (tag.owner_id || tag.status !== "unclaimed") {
      return res.status(409).json({ error: "This tag has already been activated." });
    }
    const count = db.prepare("SELECT COUNT(*) n FROM tags WHERE owner_id = ?").get(req.user.id).n;
    if (count >= MAX_TAGS_PER_USER) {
      return res.status(400).json({ error: `You can activate up to ${MAX_TAGS_PER_USER} tags.` });
    }
    const result = db
      .prepare(
        `UPDATE tags SET owner_id = ?, label = ?, status = 'active', claimed_at = datetime('now')
         WHERE id = ? AND owner_id IS NULL AND status = 'unclaimed'`
      )
      .run(req.user.id, parsed.data.label || null, tag.id);
    if (!result.changes) return res.status(409).json({ error: "This tag has already been activated." });
    res.status(201).json({ tag: view({ ...db.prepare("SELECT * FROM tags WHERE id = ?").get(tag.id) }) });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  label: z.string().trim().max(60).optional(),
  status: z.enum(["active", "paused"]).optional(),
});

router.patch("/:id", requireAuth, (req, res, next) => {
  try {
    const tag = mine(req, req.params.id);
    if (!tag) return res.status(404).json({ error: "Tag not found." });
    const parsed = updateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { label, status } = parsed.data;
    db.prepare("UPDATE tags SET label = ?, status = ? WHERE id = ?").run(
      label !== undefined ? label || null : tag.label,
      status ?? tag.status,
      tag.id
    );
    res.json({ tag: view(db.prepare("SELECT * FROM tags WHERE id = ?").get(tag.id)) });
  } catch (err) {
    next(err);
  }
});

// Give the tag up (sold the laptop, lost interest). Its messages hold finders' phone numbers, so they go too.
router.post("/:id/release", requireAuth, (req, res, next) => {
  try {
    const tag = mine(req, req.params.id);
    if (!tag) return res.status(404).json({ error: "Tag not found." });
    db.transaction(() => {
      db.prepare("DELETE FROM tag_messages WHERE tag_id = ?").run(tag.id);
      db.prepare("UPDATE tags SET owner_id = NULL, label = NULL, status = 'unclaimed', claimed_at = NULL WHERE id = ?").run(tag.id);
    })();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/messages", requireAuth, (req, res, next) => {
  try {
    const tag = mine(req, req.params.id);
    if (!tag) return res.status(404).json({ error: "Tag not found." });
    const rows = db.prepare("SELECT * FROM tag_messages WHERE tag_id = ? ORDER BY created_at DESC").all(tag.id);
    db.prepare("UPDATE tag_messages SET read_at = datetime('now') WHERE tag_id = ? AND read_at IS NULL").run(tag.id);
    res.json({
      messages: rows.map((m) => ({
        id: m.id,
        finderName: m.finder_name,
        finderPhone: m.finder_phone,
        message: m.message,
        createdAt: m.created_at,
        unread: !m.read_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- admin: make the stickers ----------

const generateSchema = z.object({ count: z.number().int().min(1).max(200) });

router.post("/admin/generate", requireAuth, requireAdmin, (req, res, next) => {
  try {
    const parsed = generateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Choose a number between 1 and 200." });
    const insert = db.prepare("INSERT INTO tags (id, code) VALUES (?, ?)");
    const codes = [];
    db.transaction(() => {
      while (codes.length < parsed.data.count) {
        const code = newTagCode();
        try {
          insert.run(crypto.randomUUID(), code);
          codes.push(code);
        } catch (err) {
          if (!/UNIQUE/i.test(err.message)) throw err; // a clash is vanishingly rare: just try another
        }
      }
    })();
    res.status(201).json({ codes });
  } catch (err) {
    next(err);
  }
});

router.get("/admin/summary", requireAuth, requireAdmin, (req, res) => {
  const counts = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) n FROM tags GROUP BY status").all().map((r) => [r.status, r.n])
  );
  const unclaimed = db
    .prepare("SELECT code FROM tags WHERE status = 'unclaimed' AND owner_id IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 200")
    .all()
    .map((r) => r.code);
  res.json({ counts: { unclaimed: 0, active: 0, paused: 0, ...counts }, unclaimedCodes: unclaimed });
});

module.exports = router;
