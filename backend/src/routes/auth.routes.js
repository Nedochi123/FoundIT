const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const db = require("../../db");
const { hashPassword, verifyPassword } = require("../utils/password");
const {
  signAccessToken,
  hashToken,
  issueRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} = require("../utils/tokens");
const { sendEmail, welcomeEmail, passwordResetEmail, verifyEmailStandaloneEmail } = require("../utils/email");
const { requireAuth } = require("../middleware/auth");
const { idNumberSchema } = require("../utils/idNumber");
const { isAdminEmail } = require("../utils/admin");
const { retireTagsOf } = require("../utils/tags");
const { publicUser } = require("../utils/publicUser");
const { THEMES, DOODLES, DEFAULT_THEME, DEFAULT_DOODLE } = require("../utils/themes");

const router = express.Router();

const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "nileuniversity.edu.ng").toLowerCase();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const isProd = process.env.NODE_ENV === "production";

// Applies only to the auth actions that could be brute-forced or abused
// by an anonymous caller — not to /me or /refresh, which already require
// a valid token/cookie the attacker wouldn't have.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("access_token", accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie("refresh_token", refreshToken, cookieOptions(30 * 24 * 60 * 60 * 1000));
}

function clearAuthCookies(res) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
}

function issueSession(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = issueRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);
  return { accessToken, refreshToken };
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .refine(
      (email) => email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`) || isAdminEmail(email),
      `Signup requires a @${ALLOWED_EMAIL_DOMAIN} email address.`
    ),
  password: z.string().min(8, "Password must be at least 8 characters."),
  idNumber: idNumberSchema,
  // the look they chose on the sign-up form; leaving it out keeps the default
  theme: z.enum(THEMES, { message: "Pick one of the available colors." }).optional(),
  doodle: z.enum(DOODLES, { message: "Pick one of the available doodle styles." }).optional(),
});

router.post("/signup", authLimiter, async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { name, email, password, idNumber, theme, doodle } = parsed.data;

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO users (id, name, email, password_hash, id_number, theme, doodle) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(userId, name, email, passwordHash, idNumber || null, theme || DEFAULT_THEME, doodle || DEFAULT_DOODLE);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

    // Email verification token, embedded in the welcome email. Not a
    // gate on using the app — just tracked on users.email_verified_at.
    const rawVerifyToken = crypto.randomBytes(32).toString("hex");
    db.prepare(
      "INSERT INTO email_verification_tokens (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
    ).run(crypto.randomUUID(), hashToken(rawVerifyToken), userId);
    const verifyUrl = `${CLIENT_ORIGIN}/?verifyToken=${rawVerifyToken}`;
    sendEmail({
      to: email,
      subject: "Welcome to FoundIT",
      html: welcomeEmail(name, verifyUrl),
      devLogLabel: `Verify URL: ${verifyUrl}`,
    }).catch((err) => console.error("Welcome email failed:", err));

    const { accessToken, refreshToken } = issueSession(res, user);
    res.locals.actorId = user.id; // for the activity log: this request has no signed-in user yet
    res.status(201).json({ user: publicUser(user), accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid email or password." });
    }
    const { email, password } = parsed.data;

    // Identical error for "no such user" and "wrong password" — prevents
    // an attacker from using this endpoint to enumerate real accounts.
    const genericError = () => res.status(401).json({ error: "Invalid email or password." });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return genericError();

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return genericError();

    if (user.suspended_at) {
      return res.status(403).json({ error: "This account has been suspended." });
    }

    const { accessToken, refreshToken } = issueSession(res, user);
    res.locals.actorId = user.id; // for the activity log
    res.json({ user: publicUser(user), accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refresh_token || req.body?.refreshToken;
    if (!rawToken) return res.status(401).json({ error: "No refresh token provided." });

    const stored = findValidRefreshToken(rawToken);
    if (!stored) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(stored.user_id);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    if (user.suspended_at) {
      clearAuthCookies(res);
      revokeAllRefreshTokensForUser(user.id);
      return res.status(403).json({ error: "This account has been suspended." });
    }

    // Rotate: revoke the used refresh token and issue a brand-new pair
    // every time, so a stolen refresh token has a single-use window.
    revokeRefreshToken(rawToken);
    const { accessToken, refreshToken } = issueSession(res, user);
    res.json({ user: publicUser(user), accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(user) });
});

router.post("/logout", (req, res) => {
  const rawToken = req.cookies?.refresh_token || req.body?.refreshToken;
  if (rawToken) revokeRefreshToken(rawToken);
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.post("/logout-all", requireAuth, (req, res) => {
  revokeAllRefreshTokensForUser(req.user.id);
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.post("/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const user = email ? db.prepare("SELECT * FROM users WHERE email = ?").get(email) : null;

    // Always return ok, regardless of whether the account exists — a
    // different response here would let this endpoint be used to check
    // which emails have accounts.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      db.prepare(
        "INSERT INTO password_reset_tokens (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))"
      ).run(crypto.randomUUID(), hashToken(rawToken), user.id);
      const resetUrl = `${CLIENT_ORIGIN}/?resetToken=${rawToken}`;
      sendEmail({
        to: user.email,
        subject: "Reset your FoundIT password",
        html: passwordResetEmail(resetUrl),
        devLogLabel: `Reset URL: ${resetUrl}`,
      }).catch((err) => console.error("Reset email failed:", err));
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", authLimiter, async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || password.length < 8) {
      return res.status(400).json({ error: "A valid token and an 8+ character password are required." });
    }

    const row = db
      .prepare(
        "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')"
      )
      .get(hashToken(token));
    if (!row) return res.status(400).json({ error: "This reset link is invalid or has expired." });

    const passwordHash = await hashPassword(password);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      passwordHash,
      row.user_id
    );
    db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);

    // Resetting the password revokes every existing session — if
    // someone else had access, this locks them out immediately.
    revokeAllRefreshTokensForUser(row.user_id);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Change password while logged in — separate from forgot/reset-password
// (which is for someone locked out entirely). Requires the current
// password, unlike reset, since the caller is already authenticated
// and this isn't recovering from a lost password.
router.post("/change-password", authLimiter, requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Current password and a new 8+ character password are required." });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Current password is incorrect." });

    const passwordHash = await hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      passwordHash,
      user.id
    );

    // Same as reset-password: revokes every session, this one included,
    // so a stolen-but-still-valid refresh token elsewhere is locked out.
    revokeAllRefreshTokensForUser(user.id);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Soft delete, not a cascade: a hard delete would take the user's
// found/lost item posts and every conversation they're part of down
// with them, which would silently break things for the other person in
// that conversation -- someone still trying to reclaim an item from a
// poster who just deleted their account shouldn't lose that thread. So
// this scrubs the personal data the privacy policy actually promises
// removing (name, email, password, ID number) and leaves their posts
// and messages attributed to "Deleted User", the same way most
// marketplaces and forums handle it.
router.post("/delete-account", authLimiter, requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Enter your password to confirm." });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Incorrect password." });

    const anonymizedEmail = `deleted-${crypto.randomUUID()}@deleted.foundit.local`;
    const unusablePasswordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
    db.prepare(
      `UPDATE users
       SET name = 'Deleted User', email = ?, password_hash = ?, id_number = NULL,
           deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(anonymizedEmail, unusablePasswordHash, user.id);

    retireTagsOf(db, user.id);
    revokeAllRefreshTokensForUser(user.id);
    clearAuthCookies(res);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/resend-verification", authLimiter, requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user || user.email_verified_at) {
    return res.json({ ok: true });
  }
  const rawToken = crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO email_verification_tokens (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
  ).run(crypto.randomUUID(), hashToken(rawToken), user.id);
  const verifyUrl = `${CLIENT_ORIGIN}/?verifyToken=${rawToken}`;
  sendEmail({
    to: user.email,
    subject: "Verify your FoundIT email",
    html: verifyEmailStandaloneEmail(verifyUrl),
    devLogLabel: `Verify URL: ${verifyUrl}`,
  }).catch((err) => console.error("Verify email failed:", err));
  res.json({ ok: true });
});

router.post("/verify-email", (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "A token is required." });

  const row = db
    .prepare(
      "SELECT * FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')"
    )
    .get(hashToken(token));
  if (!row) return res.status(400).json({ error: "This verification link is invalid or has expired." });

  db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(row.user_id);
  db.prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);

  res.json({ ok: true });
});

module.exports = router;
