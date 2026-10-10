const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth } = require("../middleware/auth");
const { supportLimiter } = require("../middleware/rateLimiters");
const { MAX_LENGTH, notifyOwnerOfMessage, toMessage } = require("../utils/support");

// A student's private line to the admin, for complaints and problems. They see only their own thread; the owner
// reads and answers every thread from the owner page (routes/monitor.routes.js).
const router = express.Router();
router.use(requireAuth);

const threadOf = (userId) => db.prepare("SELECT * FROM support_threads WHERE user_id = ?").get(userId);

// Their conversation with the admin. Opening it marks the admin's replies as read.
router.get("/", (req, res) => {
  const thread = threadOf(req.user.id);
  if (!thread) return res.json({ messages: [] });
  const messages = db.prepare("SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC, rowid ASC").all(thread.id);
  db.prepare("UPDATE support_messages SET read_at = datetime('now') WHERE thread_id = ? AND sender = 'admin' AND read_at IS NULL").run(thread.id);
  res.json({ messages: messages.map(toMessage) });
});

// How many replies from the admin they haven't opened yet (for the badge on Home).
router.get("/unread", (req, res) => {
  const thread = threadOf(req.user.id);
  const unread = thread
    ? db.prepare("SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ? AND sender = 'admin' AND read_at IS NULL").get(thread.id).n
    : 0;
  res.json({ unread });
});

const sendSchema = z.object({
  body: z.string().trim().min(1, "Write your message first.").max(MAX_LENGTH, `Please keep it under ${MAX_LENGTH} characters.`),
});

router.post("/", supportLimiter, (req, res, next) => {
  try {
    const parsed = sendSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const thread =
      threadOf(req.user.id) ||
      (() => {
        const id = crypto.randomUUID();
        db.prepare("INSERT INTO support_threads (id, user_id) VALUES (?, ?)").run(id, req.user.id);
        return { id };
      })();
    const id = crypto.randomUUID();
    db.transaction(() => {
      db.prepare("INSERT INTO support_messages (id, thread_id, sender, body) VALUES (?, ?, 'student', ?)").run(id, thread.id, parsed.data.body);
      db.prepare("UPDATE support_threads SET last_message_at = datetime('now') WHERE id = ?").run(thread.id);
    })();

    const message = db.prepare("SELECT * FROM support_messages WHERE id = ?").get(id);
    res.status(201).json({ message: toMessage(message) });

    notifyOwnerOfMessage(req.user.name, `${req.protocol}://${req.get("host")}/owner/`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
