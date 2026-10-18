const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../../db");

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set (see .env.example)."
  );
}

// A short signing secret can be guessed from a stolen token: in production the server refuses to run with one.
for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
  if (process.env[name].length < 32) {
    const message = `${name} is shorter than 32 characters. Use a long random value.`;
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(message);
  }
}

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function signAccessToken(user) {
  return jwt.sign(
    // sch: the school the session belongs to (middleware/auth.js refuses it at any other school)
    { sub: user.id, email: user.email, name: user.name, sch: db.currentSchoolId() },
    process.env.JWT_ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL }
  );
}

// only the one algorithm we sign with is accepted, so a token cannot choose a weaker one for itself
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// The refresh token itself is an opaque random string, not a JWT — only
// its SHA-256 hash is ever stored, so a database leak alone can't be
// used to forge a session, and any individual token can be revoked
// server-side (a stateless JWT refresh token can't be revoked early).
function issueRefreshToken(userId) {
  const rawToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  db.prepare(
    "INSERT INTO refresh_tokens (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)"
  ).run(crypto.randomUUID(), hashToken(rawToken), userId, expiresAt.toISOString());

  return rawToken;
}

function findValidRefreshToken(rawToken) {
  const row = db
    .prepare(
      "SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')"
    )
    .get(hashToken(rawToken));
  return row || null;
}

function revokeRefreshToken(rawToken) {
  db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?").run(
    hashToken(rawToken)
  );
}

function revokeAllRefreshTokensForUser(userId) {
  db.prepare(
    "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL"
  ).run(userId);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  hashToken,
  issueRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
};
