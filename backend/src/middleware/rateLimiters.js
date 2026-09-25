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

module.exports = { postItemLimiter, messageLimiter };
