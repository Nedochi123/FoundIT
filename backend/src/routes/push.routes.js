const express = require("express");
const crypto = require("crypto");
const db = require("../../db");
const { requireAuth } = require("../middleware/auth");
const { vapidPublicKey } = require("../utils/push");

const router = express.Router();

router.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

router.post("/subscribe", requireAuth, (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "A valid push subscription is required." });
  }

  // Upsert on endpoint: the same browser/device can legitimately
  // re-subscribe (reinstalled PWA, re-prompted, logged into a different
  // account on a shared device) — this keeps it pointed at whichever
  // user most recently subscribed there instead of erroring or duplicating.
  const existing = db.prepare("SELECT id FROM push_subscriptions WHERE endpoint = ?").get(endpoint);
  if (existing) {
    db.prepare(
      "UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE endpoint = ?"
    ).run(req.user.id, keys.p256dh, keys.auth, endpoint);
  } else {
    db.prepare(
      "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)"
    ).run(crypto.randomUUID(), req.user.id, endpoint, keys.p256dh, keys.auth);
  }

  res.status(201).json({ ok: true });
});

router.post("/unsubscribe", requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "An endpoint is required." });
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").run(
    endpoint,
    req.user.id
  );
  res.json({ ok: true });
});

// A user's push preference is really one setting, not one per device —
// reads from whichever subscription row is most recent, and a write
// applies to every device they have subscribed so a phone and a laptop
// don't silently disagree.
router.get("/preferences", requireAuth, (req, res) => {
  const row = db
    .prepare("SELECT notify_lost, notify_found FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(req.user.id);
  res.json({
    hasSubscription: !!row,
    notifyLost: row ? !!row.notify_lost : true,
    notifyFound: row ? !!row.notify_found : true,
  });
});

router.patch("/preferences", requireAuth, (req, res) => {
  const { notifyLost, notifyFound } = req.body || {};
  if (typeof notifyLost !== "boolean" || typeof notifyFound !== "boolean") {
    return res.status(400).json({ error: "notifyLost and notifyFound must both be booleans." });
  }
  db.prepare("UPDATE push_subscriptions SET notify_lost = ?, notify_found = ? WHERE user_id = ?").run(
    notifyLost ? 1 : 0,
    notifyFound ? 1 : 0,
    req.user.id
  );
  res.json({ ok: true });
});

module.exports = router;
