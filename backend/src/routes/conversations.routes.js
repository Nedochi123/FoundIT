const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth } = require("../middleware/auth");
const { notifyUser } = require("../utils/push");

const TOKENS_PER_FIND = 2;

const router = express.Router();

function requireConversationAccess(req, res, next) {
  const convo = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
  if (!convo) return res.status(404).json({ error: "Conversation not found." });
  if (convo.finder_id !== req.user.id && convo.seeker_id !== req.user.id) {
    return res.status(403).json({ error: "You don't have access to this conversation." });
  }
  req.conversation = convo;
  next();
}

// Starting a conversation is idempotent — clicking "Message" again on
// the same found item just returns the existing thread instead of
// creating a duplicate, so the frontend never has to check first.
router.post("/", requireAuth, (req, res, next) => {
  try {
    const foundItemId = req.body?.foundItemId;
    if (!foundItemId) return res.status(400).json({ error: "foundItemId is required." });

    const foundItem = db.prepare("SELECT * FROM found_items WHERE id = ?").get(foundItemId);
    if (!foundItem) return res.status(404).json({ error: "Found item not found." });
    if (foundItem.poster_id === req.user.id) {
      return res.status(400).json({ error: "You can't message yourself about your own item." });
    }

    let convo = db
      .prepare("SELECT * FROM conversations WHERE found_item_id = ? AND seeker_id = ?")
      .get(foundItemId, req.user.id);

    if (!convo) {
      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO conversations (id, found_item_id, finder_id, seeker_id) VALUES (?, ?, ?, ?)"
      ).run(id, foundItemId, foundItem.poster_id, req.user.id);
      convo = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
    }

    res.status(201).json({ conversation: convo });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT
         conversations.*,
         found_items.photo_url, found_items.description AS item_description,
         finder.name AS finder_name, seeker.name AS seeker_name,
         (SELECT body FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC LIMIT 1) AS last_message,
         (SELECT created_at FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
         (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id AND sender_id != ? AND read_at IS NULL) AS unread_count
       FROM conversations
       JOIN found_items ON found_items.id = conversations.found_item_id
       JOIN users AS finder ON finder.id = conversations.finder_id
       JOIN users AS seeker ON seeker.id = conversations.seeker_id
       WHERE conversations.finder_id = ? OR conversations.seeker_id = ?
       ORDER BY COALESCE(last_message_at, conversations.created_at) DESC`
    )
    .all(req.user.id, req.user.id, req.user.id);

  const conversations = rows.map((r) => ({
    id: r.id,
    foundItemId: r.found_item_id,
    itemPhotoUrl: r.photo_url,
    itemDescription: r.item_description,
    otherUserName: r.finder_id === req.user.id ? r.seeker_name : r.finder_name,
    lastMessage: r.last_message,
    lastMessageAt: r.last_message_at,
    unreadCount: r.unread_count,
    createdAt: r.created_at,
  }));

  res.json({ conversations });
});

router.get("/:id/messages", requireAuth, requireConversationAccess, (req, res) => {
  const messages = db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .all(req.params.id);

  // Side effect: mark the other participant's messages as read, since
  // the caller is viewing this conversation right now.
  db.prepare(
    "UPDATE messages SET read_at = datetime('now') WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL"
  ).run(req.params.id, req.user.id);

  const foundItem = db
    .prepare("SELECT return_confirmed_at FROM found_items WHERE id = ?")
    .get(req.conversation.found_item_id);

  res.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      readAt: m.read_at,
    })),
    isSeeker: req.conversation.seeker_id === req.user.id,
    returnConfirmed: !!foundItem?.return_confirmed_at,
  });
});

const messageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty.").max(2000),
});

router.post("/:id/messages", requireAuth, requireConversationAccess, (req, res, next) => {
  try {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const id = crypto.randomUUID();
    db.prepare("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)").run(
      id,
      req.params.id,
      req.user.id,
      parsed.data.body
    );

    const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
    res.status(201).json({
      message: {
        id: message.id,
        senderId: message.sender_id,
        body: message.body,
        createdAt: message.created_at,
        readAt: message.read_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Only the seeker can confirm — a finder marking their own return
// "confirmed" would trivially farm tokens. Idempotent: once
// found_items.return_confirmed_at is set, this item can never pay out
// a second time, even if called again or from a different conversation
// on the same item.
router.post("/:id/confirm-return", requireAuth, requireConversationAccess, (req, res, next) => {
  try {
    const convo = req.conversation;
    if (convo.seeker_id !== req.user.id) {
      return res.status(403).json({ error: "Only the person who lost the item can confirm its return." });
    }

    const foundItem = db.prepare("SELECT * FROM found_items WHERE id = ?").get(convo.found_item_id);
    if (!foundItem) return res.status(404).json({ error: "Found item not found." });
    if (foundItem.return_confirmed_at) {
      return res.status(400).json({ error: "This return has already been confirmed." });
    }

    const run = db.transaction(() => {
      db.prepare(
        `UPDATE found_items
         SET return_confirmed_at = datetime('now'), status = 'resolved',
             resolved_at = COALESCE(resolved_at, datetime('now')), updated_at = datetime('now')
         WHERE id = ?`
      ).run(foundItem.id);

      db.prepare("UPDATE users SET tokens = tokens + ?, updated_at = datetime('now') WHERE id = ?").run(
        TOKENS_PER_FIND,
        convo.finder_id
      );

      const ledgerId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO token_ledger (id, user_id, delta, reason, note, found_item_id)
         VALUES (?, ?, ?, 'find_confirmed', ?, ?)`
      ).run(ledgerId, convo.finder_id, TOKENS_PER_FIND, "Confirmed return of a found item", foundItem.id);

      return db.prepare("SELECT tokens FROM users WHERE id = ?").get(convo.finder_id);
    });

    const { tokens } = run();

    notifyUser(convo.finder_id, {
      title: "Return confirmed! 🎉",
      body: `+${TOKENS_PER_FIND} tokens — the owner confirmed they got their item back.`,
    }).catch(() => {});

    res.json({ ok: true, tokens });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
