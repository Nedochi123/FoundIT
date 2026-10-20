const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth } = require("../middleware/auth");
const { messageLimiter } = require("../middleware/rateLimiters");
const { notifyUser } = require("../utils/push");
const { REWARD_AMOUNTS, naira } = require("../utils/rewards");
const { signPhotoUrl } = require("../utils/photoLinks");

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

// ---- the voluntary thank-you reward ----
// FoundIT never handles this money. The owner chooses an amount, the finder shares their account
// details privately in this chat, the owner pays them directly and taps "sent", and the finder taps
// "received". Only the amount and these three steps are stored; no bank or card details.
function postChatMessage(conversationId, senderId, body) {
  db.prepare("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)").run(
    crypto.randomUUID(),
    conversationId,
    senderId,
    body
  );
}

function createReward(convo, ownerId, amount, { urgent = false } = {}) {
  db.prepare(
    `INSERT INTO rewards (id, found_item_id, conversation_id, from_user_id, to_user_id, amount)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), convo.found_item_id, convo.id, ownerId, convo.finder_id, amount);
  postChatMessage(
    convo.id,
    ownerId,
    urgent
      ? `🎁 This is what I urgently needed, so I'm giving you the ${naira(amount)} reward I promised. Please send me your account details here in this chat (bank and account number, or a phone number for a transfer) and I'll send it.`
      : `🎁 To say thank you, I'd like to give you a ${naira(amount)} reward. Please send me your account details here in this chat (bank and account number, or a phone number for a transfer) and I'll send it.`
  );
}

function notifyRewardChosen(finderId, amount) {
  notifyUser(finderId, {
    title: "A thank-you reward 🎁",
    body: `The owner chose a ${naira(amount)} reward for you. Open the chat to share your account details with them.`,
  }).catch(() => {});
}

/** The open "Urgently need" post (if any) whose promised reward this student can settle by confirming a return. */
function urgentOfferFor(userId) {
  const row = db
    .prepare(
      `SELECT id, description, urgent_reward FROM lost_items
       WHERE poster_id = ? AND status = 'open' AND urgent_reward IS NOT NULL ORDER BY urgent_at DESC LIMIT 1`
    )
    .get(userId);
  return row ? { lostItemId: row.id, description: row.description, reward: row.urgent_reward } : null;
}

/** What the chat screen needs to show about the reward, or null when there is none. */
function rewardView(row) {
  if (!row) return null;
  return {
    amount: row.amount,
    status: row.status,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
  };
}

// Starting a conversation is idempotent — clicking "Message" again on
// the same found item just returns the existing thread instead of
// creating a duplicate, so the frontend never has to check first.
router.post("/", requireAuth, (req, res, next) => {
  try {
    const foundItemId = req.body?.foundItemId;
    if (typeof foundItemId !== "string" || !foundItemId || foundItemId.length > 64) return res.status(400).json({ error: "foundItemId is required." });

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
    itemPhotoUrl: signPhotoUrl(r.photo_url),
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
    .prepare("SELECT return_confirmed_at, return_confirmed_conversation_id FROM found_items WHERE id = ?")
    .get(req.conversation.found_item_id);
  const reward = db.prepare("SELECT * FROM rewards WHERE found_item_id = ?").get(req.conversation.found_item_id);
  // Only the chat where the return was confirmed shows the reward (other students who asked about
  // the same item don't see it, and the owner there can't add one).
  const rewardHere = reward && reward.conversation_id === req.conversation.id ? reward : null;
  const canOfferReward =
    req.conversation.seeker_id === req.user.id &&
    !!foundItem?.return_confirmed_at &&
    foundItem.return_confirmed_conversation_id === req.conversation.id &&
    !reward;

  // The owner who promised a reward in an "Urgently need" post is offered it when confirming the return.
  const urgentOffer =
    req.conversation.seeker_id === req.user.id && !foundItem?.return_confirmed_at ? urgentOfferFor(req.user.id) : null;

  res.json({
    reward: rewardView(rewardHere),
    canOfferReward,
    urgentOffer,
    rewardOptions: REWARD_AMOUNTS,
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      readAt: m.read_at,
    })),
    isSeeker: req.conversation.seeker_id === req.user.id,
    returnConfirmed: !!foundItem?.return_confirmed_at,
    otherUserId:
      req.conversation.finder_id === req.user.id ? req.conversation.seeker_id : req.conversation.finder_id,
  });
});

const messageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty.").max(2000),
});

router.post("/:id/messages", requireAuth, messageLimiter, requireConversationAccess, (req, res, next) => {
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
const confirmReturnSchema = z.object({
  note: z.string().trim().max(280).optional(),
  // optional voluntary reward, one of REWARD_AMOUNTS (checked below)
  rewardAmount: z.number().int().optional(),
  // the owner's open "Urgently need" post this return settles; its promised reward is then fixed
  urgentItemId: z.string().max(64).optional(),
});

router.post("/:id/confirm-return", requireAuth, requireConversationAccess, (req, res, next) => {
  try {
    const convo = req.conversation;
    if (convo.seeker_id !== req.user.id) {
      return res.status(403).json({ error: "Only the person who lost the item can confirm its return." });
    }

    const parsed = confirmReturnSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { note, urgentItemId } = parsed.data;
    let { rewardAmount } = parsed.data;
    let urgentPost = null;
    if (urgentItemId) {
      urgentPost = db
        .prepare(
          "SELECT id, urgent_reward FROM lost_items WHERE id = ? AND poster_id = ? AND status = 'open' AND urgent_reward IS NOT NULL"
        )
        .get(urgentItemId, req.user.id);
      if (!urgentPost) {
        return res.status(400).json({ error: "That urgent request isn't open any more." });
      }
      rewardAmount = urgentPost.urgent_reward; // the promised amount, not a new choice
    }
    if (rewardAmount !== undefined && !REWARD_AMOUNTS.includes(rewardAmount)) {
      return res.status(400).json({ error: "Please choose one of the reward amounts shown." });
    }

    const foundItem = db.prepare("SELECT * FROM found_items WHERE id = ?").get(convo.found_item_id);
    if (!foundItem) return res.status(404).json({ error: "Found item not found." });
    if (foundItem.return_confirmed_at) {
      return res.status(400).json({ error: "This return has already been confirmed." });
    }

    const run = db.transaction(() => {
      db.prepare(
        `UPDATE found_items
         SET return_confirmed_at = datetime('now'), return_confirmed_conversation_id = ?, status = 'resolved',
             resolved_at = COALESCE(resolved_at, datetime('now')), updated_at = datetime('now')
         WHERE id = ?`
      ).run(convo.id, foundItem.id);

      db.prepare("UPDATE users SET tokens = tokens + ?, updated_at = datetime('now') WHERE id = ?").run(
        TOKENS_PER_FIND,
        convo.finder_id
      );

      const ledgerId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO token_ledger (id, user_id, delta, reason, note, found_item_id)
         VALUES (?, ?, ?, 'find_confirmed', ?, ?)`
      ).run(ledgerId, convo.finder_id, TOKENS_PER_FIND, "Confirmed return of a found item", foundItem.id);

      if (note) {
        db.prepare(
          `INSERT INTO thank_you_notes (id, found_item_id, from_user_id, to_user_id, note)
           VALUES (?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), foundItem.id, req.user.id, convo.finder_id, note);
      }

      if (rewardAmount) createReward(convo, req.user.id, rewardAmount, { urgent: Boolean(urgentPost) });
      if (urgentPost) {
        db.prepare(
          "UPDATE lost_items SET status = 'resolved', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).run(urgentPost.id);
      }

      return db.prepare("SELECT tokens FROM users WHERE id = ?").get(convo.finder_id);
    });

    const { tokens } = run();

    notifyUser(convo.finder_id, {
      title: "Return confirmed! 🎉",
      body: `+${TOKENS_PER_FIND} tokens — the owner confirmed they got their item back.`,
    }).catch(() => {});
    if (rewardAmount) notifyRewardChosen(convo.finder_id, rewardAmount);

    res.json({ ok: true, tokens, rewardAmount: rewardAmount || null });
  } catch (err) {
    next(err);
  }
});

// Give a reward after confirming the return (if they didn't choose one at the time). Only the owner
// whose confirmation closed this item, once per item, and only one of the fixed amounts.
const rewardSchema = z.object({ amount: z.number().int() });

router.post("/:id/reward", requireAuth, messageLimiter, requireConversationAccess, (req, res, next) => {
  try {
    const convo = req.conversation;
    if (convo.seeker_id !== req.user.id) {
      return res.status(403).json({ error: "Only the person who got their item back can give a reward." });
    }
    const parsed = rewardSchema.safeParse(req.body || {});
    if (!parsed.success || !REWARD_AMOUNTS.includes(parsed.data.amount)) {
      return res.status(400).json({ error: "Please choose one of the reward amounts shown." });
    }
    const foundItem = db.prepare("SELECT * FROM found_items WHERE id = ?").get(convo.found_item_id);
    if (!foundItem?.return_confirmed_at || foundItem.return_confirmed_conversation_id !== convo.id) {
      return res.status(400).json({ error: "You can give a reward once you have confirmed the item came back." });
    }
    if (db.prepare("SELECT 1 FROM rewards WHERE found_item_id = ?").get(foundItem.id)) {
      return res.status(400).json({ error: "A reward has already been chosen for this item." });
    }

    db.transaction(() => createReward(convo, req.user.id, parsed.data.amount))();
    notifyRewardChosen(convo.finder_id, parsed.data.amount);
    res.status(201).json({ ok: true, amount: parsed.data.amount });
  } catch (err) {
    next(err);
  }
});

function ownReward(req, res) {
  const reward = db.prepare("SELECT * FROM rewards WHERE conversation_id = ?").get(req.conversation.id);
  if (!reward) {
    res.status(404).json({ error: "There is no reward in this chat." });
    return null;
  }
  return reward;
}

// The owner says they have sent the money (paid directly to the finder, outside FoundIT).
router.post("/:id/reward/sent", requireAuth, messageLimiter, requireConversationAccess, (req, res, next) => {
  try {
    const reward = ownReward(req, res);
    if (!reward) return;
    if (reward.from_user_id !== req.user.id) {
      return res.status(403).json({ error: "Only the person giving the reward can mark it as sent." });
    }
    if (reward.status === "promised") {
      db.prepare("UPDATE rewards SET status = 'sent', sent_at = datetime('now') WHERE id = ? AND status = 'promised'").run(reward.id);
      postChatMessage(req.conversation.id, req.user.id, `✅ I've sent your ${naira(reward.amount)} reward. Please check your account and confirm here when it arrives.`);
      notifyUser(reward.to_user_id, {
        title: "Your reward is on its way 🎁",
        body: `The owner says they sent ${naira(reward.amount)}. Check your account, then tap "I received it".`,
      }).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// The finder says it arrived. It can only be confirmed after the owner has said they sent it.
router.post("/:id/reward/received", requireAuth, messageLimiter, requireConversationAccess, (req, res, next) => {
  try {
    const reward = ownReward(req, res);
    if (!reward) return;
    if (reward.to_user_id !== req.user.id) {
      return res.status(403).json({ error: "Only the finder who is receiving the reward can confirm it arrived." });
    }
    if (reward.status === "promised") {
      return res.status(400).json({ error: "The owner hasn't said they've sent it yet." });
    }
    if (reward.status === "sent") {
      db.prepare("UPDATE rewards SET status = 'received', received_at = datetime('now') WHERE id = ? AND status = 'sent'").run(reward.id);
      postChatMessage(req.conversation.id, req.user.id, "🙏 Received. Thank you so much!");
      notifyUser(reward.from_user_id, {
        title: "Reward received 🎉",
        body: "The finder confirmed they received your thank-you reward.",
      }).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
