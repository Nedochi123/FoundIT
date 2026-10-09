const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { tagFoundLimiter, tagChatLimiter, tagClaimLimiter, messageLimiter } = require("../middleware/rateLimiters");
const { notifyUser } = require("../utils/push");
const { sendEmail, tagFoundEmail } = require("../utils/email");
const { newTagCode, normalizeCode } = require("../utils/tags");

// "Return me" QR tags. A student sticks one on a laptop, bag or keys; anyone who finds it scans it and
// starts a private chat with the owner (no account needed). Neither side sees the other's name or number
// unless they choose to share it in the chat. The finder never sees anything about the owner otherwise.
const router = express.Router();

const MAX_TAGS_PER_USER = 10;
const MAX_NEW_CHATS_PER_TAG_PER_HOUR = 5;
const MAX_NEW_CHATS_PER_TAG_PER_DAY = 15;
const MAX_FINDER_MESSAGES_PER_CHAT_PER_HOUR = 30;
const MAX_MESSAGES_PER_CHAT = 300;

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

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const digitsOf = (s) => String(s).replace(/\D/g, "");

const messageView = (m) => ({
  id: m.id,
  sender: m.sender,
  kind: m.kind,
  body: m.body,
  contactName: m.contact_name,
  contactPhone: m.contact_phone,
  createdAt: m.created_at,
});

const messagesOf = (threadId) =>
  db.prepare("SELECT * FROM tag_messages WHERE thread_id = ? ORDER BY created_at, rowid").all(threadId).map(messageView);

function addMessage(threadId, sender, { kind = "text", body = null, contactName = null, contactPhone = null }) {
  db.prepare(
    "INSERT INTO tag_messages (id, thread_id, sender, kind, body, contact_name, contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), threadId, sender, kind, body, contactName, contactPhone);
}

const textSchema = z.object({ message: z.string().trim().min(1, "Please write a message.").max(500, "That message is too long.") });

const contactSchema = z.object({
  name: z.string().trim().max(60, "That name is too long.").optional(),
  phone: z.string().trim().max(30, "That phone number is too long.").optional(),
});

/** Sharing a name and/or a number on purpose. Returns { error } or { name, phone }. */
function parseContact(body) {
  const parsed = contactSchema.safeParse(body || {});
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const name = parsed.data.name || null;
  const phone = parsed.data.phone || null;
  if (!name && !phone) return { error: "Enter a name, a phone number, or both." };
  if (phone) {
    const n = digitsOf(phone).length;
    if (n < 7 || n > 15) return { error: "That doesn't look like a valid phone number." };
  }
  return { name, phone };
}

// ---------- public (no sign-in): the page a finder lands on ----------

router.get("/public/:code", (req, res) => {
  const tag = tagWithOwner(req.params.code);
  if (!tag) return res.status(404).json({ status: "unknown" });
  const status = publicStatus(tag);
  // only the item's label is shown, never anything about the owner
  res.json({ status, label: status === "active" ? tag.label || null : null });
});

const startSchema = textSchema.extend({
  website: z.string().optional(), // hidden field: only bots fill it in
});

// The finder's first message opens a chat and hands back a secret token; their browser keeps it and sends
// it as X-Chat-Token on every later request. Only a hash of it is stored.
router.post("/public/:code/chat", tagFoundLimiter, (req, res, next) => {
  try {
    const parsed = startSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { message, website } = parsed.data;

    if (website) return res.status(201).json({ ok: true }); // a bot: say "done", save and tell nobody

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
         FROM tag_threads WHERE tag_id = ? AND created_at >= datetime('now', '-1 day')`
      )
      .get(tag.id);
    if ((recent.last_hour || 0) >= MAX_NEW_CHATS_PER_TAG_PER_HOUR || recent.last_day >= MAX_NEW_CHATS_PER_TAG_PER_DAY) {
      return res.status(429).json({ error: "The owner has already been contacted several times. Please try again later." });
    }

    const token = crypto.randomBytes(24).toString("base64url");
    const threadId = crypto.randomUUID();
    db.transaction(() => {
      db.prepare("INSERT INTO tag_threads (id, tag_id, finder_token_hash) VALUES (?, ?, ?)").run(threadId, tag.id, hashToken(token));
      addMessage(threadId, "finder", { body: message });
    })();

    // Tell the owner. The push is short (lock screens are public); the email carries what they wrote.
    const what = tag.label || "FoundIT tag";
    notifyUser(tag.owner_id, {
      title: "Someone found your item 🎉",
      body: `Your ${what} was just scanned. Open FoundIT to chat with the person who found it.`,
      url: "/?tags=1",
    }).catch(() => {});
    const owner = db.prepare("SELECT email FROM users WHERE id = ?").get(tag.owner_id);
    if (owner?.email) {
      sendEmail({
        to: owner.email,
        subject: `Someone found your ${what}`,
        html: tagFoundEmail({ label: what, message }),
        devLogLabel: `Tag found: ${what}`,
      }).catch(() => {});
    }

    res.status(201).json({ token, open: true, label: tag.label || null, messages: messagesOf(threadId) });
  } catch (err) {
    next(err);
  }
});

/** The finder's chat, found from the tag code in the URL plus their secret token. */
function loadFinderChat(req, res, next) {
  try {
    const tag = tagWithOwner(req.params.code);
    if (!tag) return res.status(404).json({ error: "We don't recognise this tag." });
    const token = String(req.get("x-chat-token") || "");
    if (token.length < 16 || token.length > 128) return res.status(404).json({ error: "Chat not found." });
    const thread = db.prepare("SELECT * FROM tag_threads WHERE tag_id = ? AND finder_token_hash = ?").get(tag.id, hashToken(token));
    if (!thread) return res.status(404).json({ error: "Chat not found." });
    req.tag = tag;
    req.thread = thread;
    req.chatOpen = publicStatus(tag) === "active";
    next();
  } catch (err) {
    next(err);
  }
}

router.get("/public/:code/chat", loadFinderChat, (req, res) => {
  res.json({ open: req.chatOpen, label: req.chatOpen ? req.tag.label || null : null, messages: messagesOf(req.thread.id) });
});

/** Keeps a chat from being flooded; replies with 409/429 and returns false when a finder may not send. */
function finderMaySend(req, res) {
  if (!req.chatOpen) {
    res.status(409).json({ error: "The owner has paused this tag, so new messages can't be sent right now." });
    return false;
  }
  const counts = db
    .prepare(
      `SELECT SUM(created_at >= datetime('now', '-1 hour') AND sender = 'finder') AS finder_last_hour, COUNT(*) AS total
       FROM tag_messages WHERE thread_id = ?`
    )
    .get(req.thread.id);
  if ((counts.finder_last_hour || 0) >= MAX_FINDER_MESSAGES_PER_CHAT_PER_HOUR || counts.total >= MAX_MESSAGES_PER_CHAT) {
    res.status(429).json({ error: "You're sending messages too quickly. Please wait a little and try again." });
    return false;
  }
  return true;
}

router.post("/public/:code/chat/messages", tagChatLimiter, loadFinderChat, (req, res, next) => {
  try {
    const parsed = textSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    if (!finderMaySend(req, res)) return;

    // buzz the owner's phone for a new message, but not for every line of a quick back-and-forth
    const burst = db
      .prepare(
        "SELECT COUNT(*) n FROM tag_messages WHERE thread_id = ? AND sender = 'finder' AND created_at >= datetime('now', '-2 minutes')"
      )
      .get(req.thread.id).n;
    addMessage(req.thread.id, "finder", { body: parsed.data.message });
    if (!burst) {
      notifyUser(req.tag.owner_id, {
        title: "New message about your item",
        body: `Someone replied about your ${req.tag.label || "FoundIT tag"}. Open FoundIT to read it.`,
        url: "/?tags=1",
      }).catch(() => {});
    }
    res.status(201).json({ open: true, messages: messagesOf(req.thread.id) });
  } catch (err) {
    next(err);
  }
});

// The finder decides to share their name and/or number with the owner.
router.post("/public/:code/chat/contact", tagChatLimiter, loadFinderChat, (req, res, next) => {
  try {
    const contact = parseContact(req.body);
    if (contact.error) return res.status(400).json({ error: contact.error });
    if (!finderMaySend(req, res)) return;
    addMessage(req.thread.id, "finder", { kind: "contact", contactName: contact.name, contactPhone: contact.phone });
    notifyUser(req.tag.owner_id, {
      title: "The finder shared their contact",
      body: `Open FoundIT to see how to reach the person who found your ${req.tag.label || "FoundIT tag"}.`,
      url: "/?tags=1",
    }).catch(() => {});
    res.status(201).json({ open: true, messages: messagesOf(req.thread.id) });
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
  chatCount: row.chat_count ?? 0,
  unreadCount: row.unread_count ?? 0,
});

router.get("/", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT tags.*,
         (SELECT COUNT(*) FROM tag_threads WHERE tag_id = tags.id) AS chat_count,
         (SELECT COUNT(*) FROM tag_messages m JOIN tag_threads t ON t.id = m.thread_id
            WHERE t.tag_id = tags.id AND m.sender = 'finder' AND m.read_at IS NULL) AS unread_count
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

// Give the tag up (sold the laptop, lost interest). Its chats can hold numbers finders chose to share, so they go too.
router.post("/:id/release", requireAuth, (req, res, next) => {
  try {
    const tag = mine(req, req.params.id);
    if (!tag) return res.status(404).json({ error: "Tag not found." });
    db.transaction(() => {
      db.prepare("DELETE FROM tag_messages WHERE thread_id IN (SELECT id FROM tag_threads WHERE tag_id = ?)").run(tag.id);
      db.prepare("DELETE FROM tag_threads WHERE tag_id = ?").run(tag.id);
      db.prepare("UPDATE tags SET owner_id = NULL, label = NULL, status = 'unclaimed', claimed_at = NULL WHERE id = ?").run(tag.id);
    })();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** One of the owner's chats, or null if it isn't theirs. */
function ownedChat(req) {
  const tag = mine(req, req.params.id);
  if (!tag) return null;
  const thread = db.prepare("SELECT * FROM tag_threads WHERE id = ? AND tag_id = ?").get(req.params.threadId, tag.id);
  return thread ? { tag, thread } : null;
}

router.get("/:id/threads", requireAuth, (req, res, next) => {
  try {
    const tag = mine(req, req.params.id);
    if (!tag) return res.status(404).json({ error: "Tag not found." });
    const rows = db
      .prepare(
        `SELECT t.id, t.created_at,
           (SELECT MAX(created_at) FROM tag_messages WHERE thread_id = t.id) AS last_at,
           (SELECT COUNT(*) FROM tag_messages WHERE thread_id = t.id AND sender = 'finder' AND read_at IS NULL) AS unread_count,
           (SELECT contact_name FROM tag_messages WHERE thread_id = t.id AND sender = 'finder' AND kind = 'contact' AND contact_name IS NOT NULL
              ORDER BY created_at DESC, rowid DESC LIMIT 1) AS finder_name,
           (SELECT body FROM tag_messages WHERE thread_id = t.id AND kind = 'text' ORDER BY created_at DESC, rowid DESC LIMIT 1) AS preview
         FROM tag_threads t WHERE t.tag_id = ? ORDER BY last_at DESC, t.rowid DESC`
      )
      .all(tag.id);
    res.json({
      threads: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        lastMessageAt: r.last_at,
        unreadCount: r.unread_count,
        finderName: r.finder_name,
        preview: r.preview,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/threads/:threadId", requireAuth, (req, res, next) => {
  try {
    const chat = ownedChat(req);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    const messages = messagesOf(chat.thread.id);
    db.prepare("UPDATE tag_messages SET read_at = datetime('now') WHERE thread_id = ? AND sender = 'finder' AND read_at IS NULL").run(chat.thread.id);
    res.json({ open: publicStatus(tagWithOwner(chat.tag.code)) === "active", label: chat.tag.label, messages });
  } catch (err) {
    next(err);
  }
});

function ownerMaySend(res, chat) {
  if (chat.tag.status !== "active") {
    res.status(409).json({ error: "This tag is paused. Resume it to keep chatting." });
    return false;
  }
  const total = db.prepare("SELECT COUNT(*) n FROM tag_messages WHERE thread_id = ?").get(chat.thread.id).n;
  if (total >= MAX_MESSAGES_PER_CHAT) {
    res.status(429).json({ error: "This chat has reached its message limit." });
    return false;
  }
  return true;
}

router.post("/:id/threads/:threadId/messages", requireAuth, messageLimiter, (req, res, next) => {
  try {
    const chat = ownedChat(req);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    const parsed = textSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    if (!ownerMaySend(res, chat)) return;
    addMessage(chat.thread.id, "owner", { body: parsed.data.message });
    res.status(201).json({ messages: messagesOf(chat.thread.id) });
  } catch (err) {
    next(err);
  }
});

// The owner decides to share their name and/or number with the finder.
router.post("/:id/threads/:threadId/contact", requireAuth, messageLimiter, (req, res, next) => {
  try {
    const chat = ownedChat(req);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    const contact = parseContact(req.body);
    if (contact.error) return res.status(400).json({ error: contact.error });
    if (!ownerMaySend(res, chat)) return;
    addMessage(chat.thread.id, "owner", { kind: "contact", contactName: contact.name, contactPhone: contact.phone });
    res.status(201).json({ messages: messagesOf(chat.thread.id) });
  } catch (err) {
    next(err);
  }
});

// Delete a chat (and any numbers shared in it). The finder's link to it stops working.
router.delete("/:id/threads/:threadId", requireAuth, (req, res, next) => {
  try {
    const chat = ownedChat(req);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    db.transaction(() => {
      db.prepare("DELETE FROM tag_messages WHERE thread_id = ?").run(chat.thread.id);
      db.prepare("DELETE FROM tag_threads WHERE id = ?").run(chat.thread.id);
    })();
    res.json({ ok: true });
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
