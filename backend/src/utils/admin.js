// Comma-separated allowlist of emails with admin access (cash-out
// review). Deliberately just an env-configured list rather than a
// roles/permissions table — there's exactly one admin surface in this
// app, and a full RBAC system would be solving a problem that doesn't
// exist yet.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes((email || "").toLowerCase());
}

// Being on the admin list is not enough: anyone can type an admin address into the sign-up form, and only the real
// owner of that inbox receives the verification email. So an admin account counts only once its email is verified
// (by the emailed verification link, or by completing a password reset, which is also emailed). Accounts made before
// this rule existed are trusted as they are, so nobody who already has admin access is locked out.
const TRUSTED_BEFORE = "2026-10-10 00:00:00"; // UTC, as SQLite stores created_at

/** row: a users row (email, email_verified_at, created_at). */
function isAdminAccount(row) {
  return Boolean(row) && isAdminEmail(row.email) && (Boolean(row.email_verified_at) || String(row.created_at) < TRUSTED_BEFORE);
}

module.exports = { isAdminEmail, isAdminAccount, TRUSTED_BEFORE };
