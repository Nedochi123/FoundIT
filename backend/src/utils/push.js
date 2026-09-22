const webpush = require("web-push");
const db = require("../../db");

const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@nileuniversity.edu.ng",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Broadcasts to every subscription except the poster's own (so the
// person who just posted doesn't get notified about their own action).
// Degrades to a console log when VAPID keys aren't configured, matching
// the email.js "optional integration" pattern used elsewhere.
async function broadcastPush({ title, body, url = "/", excludeUserId }) {
  if (!configured) {
    console.log(`[push disabled — no VAPID keys configured] Would broadcast: "${title}" — ${body}`);
    return;
  }

  const subs = excludeUserId
    ? db.prepare("SELECT * FROM push_subscriptions WHERE user_id != ?").all(excludeUserId)
    : db.prepare("SELECT * FROM push_subscriptions").all();

  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  // Prune subscriptions the push service reports as gone (404/410) —
  // otherwise every future broadcast keeps retrying a dead endpoint.
  results.forEach((result, i) => {
    if (result.status === "rejected" && [404, 410].includes(result.reason?.statusCode)) {
      db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(subs[i].id);
    }
  });
}

module.exports = {
  broadcastPush,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
};
