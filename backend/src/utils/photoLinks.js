const crypto = require("crypto");
const db = require("../../db");
const { DEFAULT_SCHOOL_ID } = require("../config/schools");

// Found-item photos are private to their university, like everything else a student posts. A photo is shown with a
// plain <img>, which cannot send the student's sign-in, so the server hands out a signed link instead: only an answer
// to a signed-in student of that university contains one, the signature binds the link to that university and that
// one file, and it stops working after an hour or two. Without a valid signature /uploads answers 403.
//
// The database keeps the plain path (/uploads/found-items/...); the signature is added each time a photo is sent out.

const WINDOW_MS = 60 * 60 * 1000;

// PHOTO_LINK_SECRET if set, otherwise derived from the access-token secret (already required): no new setting is needed,
// and the derived key is never the token secret itself.
function key() {
  const secret = process.env.PHOTO_LINK_SECRET || process.env.JWT_ACCESS_SECRET;
  return crypto.createHash("sha256").update(`foundit-photo-links:${secret}`).digest();
}

function signature(schoolId, pathname, exp) {
  return crypto.createHmac("sha256", key()).update(`${schoolId}\n${pathname}\n${exp}`).digest("base64url");
}

// The folder a school's photos live in (the default school keeps the top folder, see routes/found-items.routes.js).
function belongsToSchool(pathname, schoolId) {
  const rest = pathname.startsWith("/uploads/found-items/") ? pathname.slice("/uploads/found-items/".length) : null;
  if (!rest || rest.includes("..")) return false;
  const parts = rest.split("/");
  return schoolId === DEFAULT_SCHOOL_ID ? parts.length === 1 : parts.length === 2 && parts[0] === schoolId;
}

/**
 * The link to send out for a stored photo path, signed for the school whose database it came from. It stays the same
 * for a whole hour (so the browser keeps the photo instead of loading it again on every refresh) and works for at least
 * an hour after it is handed out. Anything that is not an uploaded photo is returned as it is.
 */
function signPhotoUrl(stored, schoolId = db.currentSchoolId(), now = Date.now()) {
  if (typeof stored !== "string" || !stored.startsWith("/uploads/")) return stored;
  const exp = Math.floor((Math.ceil(now / WINDOW_MS) * WINDOW_MS + WINDOW_MS) / 1000);
  return `${stored}?school=${encodeURIComponent(schoolId)}&exp=${exp}&sig=${signature(schoolId, stored, exp)}`;
}

/** Express middleware in front of /uploads: lets a request through only with a valid, unexpired signature. */
function requireSignedPhoto(req, res, next) {
  const pathname = req.baseUrl + req.path;
  const { school, exp, sig } = req.query;
  const expires = Number(exp);
  const valid =
    typeof school === "string" &&
    typeof sig === "string" &&
    typeof exp === "string" &&
    Number.isInteger(expires) &&
    expires * 1000 > Date.now() &&
    belongsToSchool(pathname, school) &&
    sig.length === 43 &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(signature(school, pathname, expires)));
  if (!valid) return res.status(403).json({ error: "This photo is private to its university." });
  // the browser may keep it until the link expires; shared caches never
  res.set("Cache-Control", `private, max-age=${Math.max(0, Math.floor(expires - Date.now() / 1000))}`);
  next();
}

module.exports = { signPhotoUrl, requireSignedPhoto };
