const db = require("../../db");
const { notifyUser } = require("./push");
const { sendEmail } = require("./email");
const { isMonitorAccount } = require("./monitor");

// Complaints and problems: a student writes to the admin from the app (routes/support.routes.js) and the owner reads
// and answers every one in the "Messages" tab of the owner page (routes/monitor.routes.js). One private thread per
// student. These helpers tell the right person when something new arrives.

const MAX_LENGTH = 1000;

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The accounts that act as the admin (the owner): their push notification and email are how a new message is noticed. */
function ownerAccounts() {
  return db
    .prepare("SELECT id, email, email_verified_at FROM users WHERE deleted_at IS NULL")
    .all()
    .filter((u) => isMonitorAccount(u));
}

/** Tells the owner a student has written. The message text is not put in the email or the notification. */
function notifyOwnerOfMessage(studentName, ownerPageUrl) {
  for (const owner of ownerAccounts()) {
    notifyUser(owner.id, {
      title: "New message for the admin",
      body: `${studentName} sent you a message. Open the owner page to read and reply.`,
      url: ownerPageUrl,
    }).catch(() => {});
    sendEmail({
      to: owner.email,
      subject: `FoundIT: new message from ${studentName}`,
      html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1F3A5F;">New message for the admin</h2>
        <p><strong>${escapeHtml(studentName)}</strong> sent a message through FoundIT.</p>
        <p><a href="${escapeHtml(ownerPageUrl)}" style="background: #1F3A5F; color: white; padding: 12px 20px; border-radius: 24px; text-decoration: none; display: inline-block;">Open the owner page</a></p>
      </div>`,
      devLogLabel: `Owner page: ${ownerPageUrl}`,
    }).catch((err) => console.error("Owner message email failed:", err));
  }
}

/** Tells a student the admin has replied (no text in the notification). */
function notifyStudentOfReply(userId) {
  notifyUser(userId, {
    title: "The FoundIT admin replied",
    body: "Open FoundIT to read the reply.",
    url: "/?support=1",
  }).catch(() => {});
}

const toMessage = (m) => ({ id: m.id, from: m.sender, body: m.body, at: m.created_at, read: Boolean(m.read_at) });

module.exports = { MAX_LENGTH, ownerAccounts, notifyOwnerOfMessage, notifyStudentOfReply, toMessage, escapeHtml };
