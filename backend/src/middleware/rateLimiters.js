const rateLimit = require("express-rate-limit");

// Applies to authenticated content-creation actions (posting items,
// sending messages) that auth-only rate limiting doesn't cover -- a
// compromised or malicious account could otherwise flood the gallery or
// a conversation with no limit beyond manual moderation catching it
// after the fact.
const postItemLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many items posted. Please try again later." },
});

const messageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please slow down and try again shortly." },
});

// Public: anyone who scans a tag can leave a message without an account, so cap it per device.
const tagFoundLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages from this device. Please try again later." },
});

// Public: everything a finder types after the first message (chat messages, sharing a contact).
const tagChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You're sending messages too quickly. Please wait a little and try again." },
});

// Starting a paid boost: each one creates a payment reference, so keep it sensible.
const boostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many boost requests. Please try again later." },
});

// Activating a tag by its code: slows anyone trying codes.
const tagClaimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

module.exports = { postItemLimiter, messageLimiter, tagFoundLimiter, tagChatLimiter, tagClaimLimiter, boostLimiter };
