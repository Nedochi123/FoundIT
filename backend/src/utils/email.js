// Real email delivery, using Resend (https://resend.com) — same service
// and pattern already used for Pup Facts and the Kimberly Vet backend.

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  const { Resend } = require("resend");
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = process.env.EMAIL_FROM || "FoundIT <onboarding@resend.dev>";

// Returns { sent: true } on real delivery, { sent: false, reason } when
// falling back to a console log — callers should treat both as "handled
// successfully" (a request shouldn't fail just because email isn't
// configured yet).
async function sendEmail({ to, subject, html, devLogLabel }) {
  const client = getResendClient();

  if (!client) {
    console.log(`[dev only — no RESEND_API_KEY configured] Email to ${to}`);
    console.log(`[dev only] Subject: ${subject}`);
    if (devLogLabel) console.log(`[dev only] ${devLogLabel}`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    await client.emails.send({ from: FROM_ADDRESS, to, subject, html });
    return { sent: true };
  } catch (err) {
    console.error("Resend email send failed:", err.message);
    return { sent: false, reason: "send_failed" };
  }
}

function passwordResetEmail(resetUrl) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1F3A5F;">Reset your FoundIT password</h2>
      <p>We got a request to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="background: #1F3A5F; color: white; padding: 12px 20px; border-radius: 24px; text-decoration: none; display: inline-block;">Reset Password</a></p>
      <p style="color: #6b6459; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

function welcomeEmail(name, verifyUrl) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1F3A5F;">Welcome to FoundIT, ${name}</h2>
      <p>FoundIT is Nile University's campus lost &amp; found. Lost something? Post it and we'll notify everyone. Found something? Snap a photo and help it get home.</p>
      ${verifyUrl ? `
      <p>One more thing — please verify your email address so we know it's really you:</p>
      <p><a href="${verifyUrl}" style="background: #1F3A5F; color: white; padding: 12px 20px; border-radius: 24px; text-decoration: none; display: inline-block;">Verify Email</a></p>
      <p style="color: #6b6459; font-size: 13px;">This link expires in 24 hours. You can keep using FoundIT either way — this is just a trust and safety check.</p>
      ` : ""}
    </div>
  `;
}

function verifyEmailStandaloneEmail(verifyUrl) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1F3A5F;">Verify your FoundIT email</h2>
      <p>Click below to confirm this is your email address. This link expires in 24 hours.</p>
      <p><a href="${verifyUrl}" style="background: #1F3A5F; color: white; padding: 12px 20px; border-radius: 24px; text-decoration: none; display: inline-block;">Verify Email</a></p>
      <p style="color: #6b6459; font-size: 13px;">If you didn't create a FoundIT account, you can safely ignore this email.</p>
    </div>
  `;
}

module.exports = { sendEmail, passwordResetEmail, welcomeEmail, verifyEmailStandaloneEmail };
