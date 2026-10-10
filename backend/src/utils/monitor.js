const crypto = require("crypto");
const db = require("../../db");

// SECURITY MONITORING, for the owner only. FoundIT keeps an activity log (what each student did, and where their
// phone said it was at that moment) and lets ONE account read the chats, so theft can be investigated. Students
// are told in the location prompt, the chat screens and the Privacy & Terms. See routes/monitor.routes.js.

// Who may use the monitor: MONITOR_EMAILS (comma separated) or, if that isn't set, the first address in ADMIN_EMAILS.
// Deliberately narrower than the admin list, which may include other people who only review cash-outs.
function monitorEmails() {
  const list = (value) =>
    (value || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  const explicit = list(process.env.MONITOR_EMAILS);
  if (explicit.length) return explicit;
  const firstAdmin = list(process.env.ADMIN_EMAILS)[0];
  return firstAdmin ? [firstAdmin] : [];
}
const isMonitorEmail = (email) => monitorEmails().includes((email || "").toLowerCase());

const RETENTION_DAYS = 90;

/**
 * The phone's location from the X-Geo header ("lat,lng,accuracyMeters"), or null if it is missing or nonsense.
 * Rounded to 4 decimals (about 11 m): enough to see which building, not enough to follow someone's footsteps.
 */
function parseGeo(header) {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)(?:\s*,\s*(\d{1,6}(?:\.\d+)?))?\s*$/.exec(String(header || ""));
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
  return {
    lat: Math.round(lat * 1e4) / 1e4,
    lng: Math.round(lng * 1e4) / 1e4,
    accuracy: m[3] === undefined ? null : Math.min(100000, Math.round(Number(m[3]))),
  };
}

function logActivity({ userId = null, action, detail = null, targetType = null, targetId = null, geo = null }) {
  db.prepare(
    `INSERT INTO activity_log (id, user_id, action, detail, target_type, target_id, lat, lng, accuracy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), userId, action, detail, targetType, targetId, geo?.lat ?? null, geo?.lng ?? null, geo?.accuracy ?? null);
}

// What each change is called in the log. Anything not listed is still logged, under its method and address.
const LABELS = {
  "POST /api/auth/signup": "Created an account",
  "POST /api/auth/login": "Signed in",
  "POST /api/auth/delete-account": "Deleted their account",
  "POST /api/auth/change-password": "Changed their password",
  "PATCH /api/users/me": "Changed their profile",
  "POST /api/activity/checkin": "Opened the app",
  "POST /api/lost-items": "Posted a lost item",
  "POST /api/lost-items/urgent": "Posted an URGENT lost item",
  "PATCH /api/lost-items/:id/resolve": "Marked a lost item as found",
  "POST /api/found-items": "Posted a found item",
  "PATCH /api/found-items/:id/resolve": "Marked a found item as resolved",
  "POST /api/conversations": "Started a chat about a found item",
  "POST /api/conversations/:id/messages": "Sent a chat message",
  "POST /api/conversations/:id/confirm-return": "Confirmed an item was returned",
  "POST /api/conversations/:id/reward": "Chose a reward",
  "POST /api/conversations/:id/reward/sent": "Said a reward was sent",
  "POST /api/conversations/:id/reward/received": "Said a reward arrived",
  "POST /api/tokens/cashout": "Asked to cash out tokens",
  "POST /api/reports": "Reported a post or person",
  "POST /api/boosts": "Started a boost",
  "POST /api/boosts/:id/paid": "Said they paid for a boost",
  "POST /api/boosts/:id/cancel": "Cancelled a boost",
  "POST /api/tags/claim": "Activated a QR tag",
  "PATCH /api/tags/:id": "Edited a QR tag",
  "POST /api/tags/:id/release": "Released a QR tag",
  "POST /api/tags/:id/threads/:threadId/messages": "Replied in a QR tag chat",
  "POST /api/tags/:id/threads/:threadId/contact": "Shared their contact in a QR tag chat",
  "DELETE /api/tags/:id/threads/:threadId": "Deleted a QR tag chat",
  "POST /api/tags/public/:code/chat": "A finder scanned a QR tag and wrote to its owner",
  "POST /api/tags/public/:code/chat/messages": "A finder sent a QR tag message",
  "POST /api/tags/public/:code/chat/contact": "A finder shared their contact on a QR tag",
};
// housekeeping that says nothing about what a student did
const SKIP = new Set([
  "POST /api/auth/refresh",
  "POST /api/auth/logout",
  "POST /api/push/subscribe",
  "POST /api/push/unsubscribe",
  "PATCH /api/push/preferences",
]);

// A little context for a few actions: never a password or a message, only what was posted publicly.
const DETAIL = {
  "POST /api/lost-items": (req) => req.body?.description,
  "POST /api/lost-items/urgent": (req) => req.body?.description,
  "POST /api/found-items": (req) => req.body?.description,
  "POST /api/reports": (req) => [req.body?.targetType, req.body?.reason].filter(Boolean).join(": "),
};

/**
 * Express middleware: after any request that changes something and succeeded, writes one activity row (who, what,
 * where their phone said it was). Reads nothing from the request except the few public fields above.
 */
function activityLogger(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  res.on("finish", () => {
    try {
      if (res.statusCode >= 400 || !req.route) return;
      const routePath = req.route.path === "/" ? "" : String(req.route.path);
      const key = `${req.method} ${req.baseUrl}${routePath}`;
      if (SKIP.has(key)) return;
      const userId = res.locals.actorId || req.user?.id || null;

      // opening the app is logged at most once every 10 minutes per student
      if (key === "POST /api/activity/checkin") {
        const recent =
          userId &&
          db
            .prepare("SELECT 1 FROM activity_log WHERE user_id = ? AND action = 'Opened the app' AND created_at > datetime('now', '-10 minutes')")
            .get(userId);
        if (!userId || recent) return;
      }

      const detailFn = DETAIL[key];
      const detail = detailFn ? String(detailFn(req) || "").slice(0, 160) || null : null;
      let targetType = null;
      let targetId = null;
      if (req.params?.code) {
        targetType = "tag";
        targetId = String(req.params.code).slice(0, 64);
      } else if (req.params?.id) {
        targetType = req.baseUrl.split("/")[2]?.replace(/s$/, "") || null;
        targetId = String(req.params.id).slice(0, 64);
      }
      logActivity({ userId, action: LABELS[key] || key, detail, targetType, targetId, geo: parseGeo(req.headers["x-geo"]) });
    } catch (err) {
      console.error("Activity log failed:", err);
    }
  });
  next();
}

function purgeOldActivity(days = RETENTION_DAYS) {
  const activity = db.prepare("DELETE FROM activity_log WHERE created_at < datetime('now', ?)").run(`-${days} days`);
  const access = db.prepare("DELETE FROM monitor_access_log WHERE created_at < datetime('now', ?)").run(`-${days * 4} days`);
  return { activity: activity.changes, access: access.changes };
}

/**
 * Long digit runs (account numbers, card numbers, phone numbers) are hidden down to their last 4 digits in what the
 * monitor shows: students share bank details in reward chats, and the owner doesn't need them to investigate theft.
 * MONITOR_SHOW_NUMBERS=1 turns this off.
 */
function maskNumbers(text) {
  if (text == null || process.env.MONITOR_SHOW_NUMBERS === "1") return text;
  return String(text).replace(/\+?\d(?:[ -]?\d){8,}/g, (run) => `•••• ${run.replace(/\D/g, "").slice(-4)}`);
}

module.exports = {
  monitorEmails,
  isMonitorEmail,
  parseGeo,
  logActivity,
  activityLogger,
  purgeOldActivity,
  maskNumbers,
  RETENTION_DAYS,
};
