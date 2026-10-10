const express = require("express");
const crypto = require("crypto");
const db = require("../../db");
const { requireAuth } = require("../middleware/auth");
const { isMonitorEmail, maskNumbers, RETENTION_DAYS } = require("../utils/monitor");

// The owner's security view: everything students did, where they were when they did it, and the chats. Read only:
// nothing here changes a chat, marks a message as read, or lets the owner write as someone else. Only the monitor
// account (utils/monitor.js) can use it; everyone else gets the same answer as for any unknown address.
const router = express.Router();

function requireMonitor(req, res, next) {
  if (!isMonitorEmail(req.user?.email)) return res.status(404).json({ error: "Not found." });
  next();
}
router.use(requireAuth, requireMonitor);

const clampLimit = (value, fallback = 50) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), 200);
const like = (q) => `%${String(q).replace(/[\\%_]/g, (c) => "\\" + c)}%`;

function audit(req, what, targetId) {
  db.prepare("INSERT INTO monitor_access_log (id, user_id, what, target_id) VALUES (?, ?, ?, ?)").run(
    crypto.randomUUID(),
    req.user.id,
    what,
    targetId || null
  );
}

const location = (row) => (row.lat == null ? null : { lat: row.lat, lng: row.lng, accuracy: row.accuracy });

// ---- activity ----
router.get("/activity", (req, res) => {
  const limit = clampLimit(req.query.limit);
  const conditions = [];
  const params = [];
  if (req.query.user) {
    conditions.push("activity_log.user_id = ?");
    params.push(String(req.query.user));
  }
  if (req.query.q) {
    conditions.push("(activity_log.action LIKE ? ESCAPE '\\' OR activity_log.detail LIKE ? ESCAPE '\\' OR users.name LIKE ? ESCAPE '\\')");
    params.push(like(req.query.q), like(req.query.q), like(req.query.q));
  }
  if (req.query.before) {
    // the page after the last row of the previous one: rows are ordered by time, then id
    const [at, id] = String(req.query.before).split("|");
    conditions.push("(activity_log.created_at < ? OR (activity_log.created_at = ? AND activity_log.id < ?))");
    params.push(at, at, id || "");
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT activity_log.*, users.name AS user_name, users.email AS user_email
       FROM activity_log LEFT JOIN users ON users.id = activity_log.user_id
       ${where}
       ORDER BY activity_log.created_at DESC, activity_log.id DESC LIMIT ?`
    )
    .all(...params, limit + 1);
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  res.json({
    retentionDays: RETENTION_DAYS,
    items: page.map((r) => ({
      id: r.id,
      at: r.created_at,
      userId: r.user_id,
      userName: r.user_name || (r.user_id ? "Deleted account" : "A person scanning a QR tag"),
      userEmail: r.user_email || null,
      action: r.action,
      detail: r.detail,
      targetType: r.target_type,
      targetId: r.target_id,
      location: location(r),
    })),
    next: more ? `${page[page.length - 1].created_at}|${page[page.length - 1].id}` : null,
  });
});

// ---- people ----
router.get("/people", (req, res) => {
  const limit = clampLimit(req.query.limit, 100);
  const params = [];
  let where = "WHERE users.deleted_at IS NULL";
  if (req.query.q) {
    where += " AND (users.name LIKE ? ESCAPE '\\' OR users.email LIKE ? ESCAPE '\\' OR users.id_number LIKE ? ESCAPE '\\')";
    params.push(like(req.query.q), like(req.query.q), like(req.query.q));
  }
  const users = db
    .prepare(
      `SELECT users.id, users.name, users.email, users.id_number, users.created_at, users.suspended_at,
         (SELECT MAX(created_at) FROM activity_log WHERE user_id = users.id) AS last_active,
         (SELECT COUNT(*) FROM activity_log WHERE user_id = users.id) AS actions,
         (SELECT COUNT(*) FROM activity_log WHERE user_id = users.id AND lat IS NULL AND action != 'Signed in' AND action != 'Created an account') AS without_location
       FROM users ${where} ORDER BY COALESCE(last_active, users.created_at) DESC LIMIT ?`
    )
    .all(...params, limit);
  const lastSeen = db.prepare(
    "SELECT lat, lng, accuracy, created_at FROM activity_log WHERE user_id = ? AND lat IS NOT NULL ORDER BY created_at DESC LIMIT 1"
  );
  res.json({
    people: users.map((u) => {
      const seen = lastSeen.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        idNumber: u.id_number,
        joinedAt: u.created_at,
        suspended: !!u.suspended_at,
        lastActive: u.last_active,
        actions: u.actions,
        actionsWithoutLocation: u.without_location,
        lastLocation: seen ? { ...location(seen), at: seen.created_at } : null,
      };
    }),
  });
});

// ---- chats ----
router.get("/chats", (req, res) => {
  const limit = clampLimit(req.query.limit, 100);
  const q = req.query.q ? like(req.query.q) : null;

  const itemChats = db
    .prepare(
      `SELECT c.id, c.created_at, found_items.description AS item, finder.name AS finder_name, seeker.name AS seeker_name,
         (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS message_count,
         (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_body,
         (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_at
       FROM conversations c
       JOIN found_items ON found_items.id = c.found_item_id
       JOIN users finder ON finder.id = c.finder_id
       JOIN users seeker ON seeker.id = c.seeker_id
       ${q ? `WHERE finder.name LIKE ? ESCAPE '\\' OR seeker.name LIKE ? ESCAPE '\\' OR found_items.description LIKE ? ESCAPE '\\'
         OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.body LIKE ? ESCAPE '\\')` : ""}
       ORDER BY COALESCE(last_at, c.created_at) DESC LIMIT ?`
    )
    .all(...(q ? [q, q, q, q] : []), limit);

  const tagChats = db
    .prepare(
      `SELECT t.id, t.created_at, tags.code, tags.label, owner.name AS owner_name,
         (SELECT COUNT(*) FROM tag_messages WHERE thread_id = t.id) AS message_count,
         (SELECT COALESCE(body, 'Shared contact details') FROM tag_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_body,
         (SELECT created_at FROM tag_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_at
       FROM tag_threads t
       JOIN tags ON tags.id = t.tag_id
       LEFT JOIN users owner ON owner.id = tags.owner_id
       ${q ? `WHERE tags.code LIKE ? ESCAPE '\\' OR tags.label LIKE ? ESCAPE '\\' OR owner.name LIKE ? ESCAPE '\\'
         OR EXISTS (SELECT 1 FROM tag_messages m WHERE m.thread_id = t.id AND m.body LIKE ? ESCAPE '\\')` : ""}
       ORDER BY COALESCE(last_at, t.created_at) DESC LIMIT ?`
    )
    .all(...(q ? [q, q, q, q] : []), limit);

  const chats = [
    ...itemChats.map((c) => ({
      kind: "item",
      id: c.id,
      title: c.item || "Found item",
      people: `${c.finder_name} (found it) and ${c.seeker_name} (looking for it)`,
      messageCount: c.message_count,
      lastMessage: maskNumbers(c.last_body),
      lastAt: c.last_at || c.created_at,
    })),
    ...tagChats.map((c) => ({
      kind: "tag",
      id: c.id,
      title: `QR tag ${c.code}${c.label ? ` (${c.label})` : ""}`,
      people: `Someone who scanned it and ${c.owner_name || "a student who released the tag"}`,
      messageCount: c.message_count,
      lastMessage: maskNumbers(c.last_body),
      lastAt: c.last_at || c.created_at,
    })),
  ]
    .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
    .slice(0, limit);
  res.json({ chats });
});

// A chat about a found item, in full. Reading it here never marks anything as read for the students.
router.get("/chats/item/:id", (req, res) => {
  const convo = db
    .prepare(
      `SELECT c.*, found_items.description AS item, found_items.location AS item_location, found_items.photo_url,
         found_items.return_confirmed_at, finder.name AS finder_name, finder.email AS finder_email,
         seeker.name AS seeker_name, seeker.email AS seeker_email
       FROM conversations c
       JOIN found_items ON found_items.id = c.found_item_id
       JOIN users finder ON finder.id = c.finder_id
       JOIN users seeker ON seeker.id = c.seeker_id
       WHERE c.id = ?`
    )
    .get(req.params.id);
  if (!convo) return res.status(404).json({ error: "Not found." });
  audit(req, "opened an item chat", convo.id);

  const reward = db.prepare("SELECT amount, status FROM rewards WHERE conversation_id = ?").get(convo.id);
  const messages = db
    .prepare(
      `SELECT messages.*, users.name AS sender_name FROM messages JOIN users ON users.id = messages.sender_id
       WHERE conversation_id = ? ORDER BY messages.created_at ASC`
    )
    .all(convo.id);
  res.json({
    kind: "item",
    id: convo.id,
    item: {
      description: convo.item,
      location: convo.item_location,
      photoUrl: convo.photo_url,
      returnConfirmedAt: convo.return_confirmed_at,
    },
    finder: { id: convo.finder_id, name: convo.finder_name, email: convo.finder_email },
    seeker: { id: convo.seeker_id, name: convo.seeker_name, email: convo.seeker_email },
    reward: reward ? { amount: reward.amount, status: reward.status } : null,
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      body: maskNumbers(m.body),
      at: m.created_at,
      readAt: m.read_at,
    })),
  });
});

// A QR tag chat: the person who scanned the tag has no account, so they appear only as "the finder".
router.get("/chats/tag/:id", (req, res) => {
  const thread = db
    .prepare(
      `SELECT t.*, tags.code, tags.label, owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email
       FROM tag_threads t JOIN tags ON tags.id = t.tag_id LEFT JOIN users owner ON owner.id = tags.owner_id
       WHERE t.id = ?`
    )
    .get(req.params.id);
  if (!thread) return res.status(404).json({ error: "Not found." });
  audit(req, "opened a QR tag chat", thread.id);

  const messages = db.prepare("SELECT * FROM tag_messages WHERE thread_id = ? ORDER BY created_at ASC").all(thread.id);
  res.json({
    kind: "tag",
    id: thread.id,
    tag: { code: thread.code, label: thread.label },
    owner: thread.owner_id ? { id: thread.owner_id, name: thread.owner_name, email: thread.owner_email } : null,
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      kind: m.kind,
      body: maskNumbers(m.body),
      contactName: m.contact_name,
      contactPhone: maskNumbers(m.contact_phone),
      at: m.created_at,
    })),
  });
});

// Who has opened which chat, newest first: the owner's own trail.
router.get("/access-log", (req, res) => {
  const rows = db.prepare("SELECT * FROM monitor_access_log ORDER BY created_at DESC, id DESC LIMIT 100").all();
  res.json({ items: rows.map((r) => ({ id: r.id, what: r.what, targetId: r.target_id, at: r.created_at })) });
});

module.exports = router;
