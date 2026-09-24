const db = require("../../db");
const { verifyAccessToken } = require("../utils/tokens");
const { isAdminEmail } = require("../utils/admin");

// Reads the access token from the httpOnly cookie (preferred) or an
// Authorization: Bearer header (needed because iOS Safari's ITP can
// evict cross-site cookies when frontend and backend are on different
// domains — the frontend falls back to localStorage + Bearer in that
// case), verifies it, and attaches { id, email, name } to req.user.
function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.access_token || bearer;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const payload = verifyAccessToken(token);

    // Checked on every request (not just login) so a suspension or
    // deletion takes effect immediately, even against an access token
    // issued before it that hasn't expired yet — the deleted case
    // mainly matters for a second device/tab that was still logged in
    // when the account was deleted elsewhere, since deletion already
    // revokes the deleting session's own tokens directly. The DB lookup
    // is a local SQLite query, not a network round trip, so this is cheap.
    const row = db.prepare("SELECT suspended_at, deleted_at FROM users WHERE id = ?").get(payload.sub);
    if (row?.suspended_at) {
      return res.status(403).json({ error: "This account has been suspended." });
    }
    if (row?.deleted_at) {
      return res.status(401).json({ error: "This account no longer exists." });
    }

    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

// Confirms the lost item in req.params.id belongs to the authenticated
// user, so one account can never resolve or modify another account's post.
function requireOwnedLostItem(db) {
  return (req, res, next) => {
    const item = db.prepare("SELECT * FROM lost_items WHERE id = ?").get(req.params.id);
    if (!item) return res.status(404).json({ error: "Lost item not found." });
    if (item.poster_id !== req.user.id) {
      return res.status(403).json({ error: "You don't have access to this item." });
    }
    req.lostItem = item;
    next();
  };
}

function requireOwnedFoundItem(db) {
  return (req, res, next) => {
    const item = db.prepare("SELECT * FROM found_items WHERE id = ?").get(req.params.id);
    if (!item) return res.status(404).json({ error: "Found item not found." });
    if (item.poster_id !== req.user.id) {
      return res.status(403).json({ error: "You don't have access to this item." });
    }
    req.foundItem = item;
    next();
  };
}

// Must run after requireAuth — relies on req.user.email from the JWT
// payload, so no extra DB lookup needed just to gate the route.
function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

module.exports = { requireAuth, requireOwnedLostItem, requireOwnedFoundItem, requireAdmin };
