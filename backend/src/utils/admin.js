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

module.exports = { isAdminEmail };
