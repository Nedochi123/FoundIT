const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/auth");

// The app calls this when it is opened, with the phone's location in the X-Geo header. It does nothing itself:
// the activity logger (utils/monitor.js) records it as "Opened the app", at most once every 10 minutes per student.
const router = express.Router();

const checkinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many check-ins. Please try again later." },
});

router.post("/checkin", requireAuth, checkinLimiter, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
