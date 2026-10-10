const Sentry = require("@sentry/node");
const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const lostItemsRoutes = require("./routes/lost-items.routes");
const foundItemsRoutes = require("./routes/found-items.routes");
const conversationsRoutes = require("./routes/conversations.routes");
const pushRoutes = require("./routes/push.routes");
const tokensRoutes = require("./routes/tokens.routes");
const adminRoutes = require("./routes/admin.routes");
const reportsRoutes = require("./routes/reports.routes");
const tagsRoutes = require("./routes/tags.routes");
const boostsRoutes = require("./routes/boosts.routes");
const activityRoutes = require("./routes/activity.routes");
const monitorRoutes = require("./routes/monitor.routes");
const { activityLogger } = require("./utils/monitor");

const app = express();

// Railway puts one reverse proxy in front of this app, which sets
// X-Forwarded-For. Without trust proxy, express-rate-limit throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request and rate limiting
// keys on the proxy's IP instead of the real client IP.
app.set("trust proxy", 1);

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// credentials: true is required so the browser will send/receive the
// httpOnly auth cookies — each origin must be an exact match, not "*",
// whenever credentials are involved. ALLOWED_ORIGINS supports a comma
// separated list while CLIENT_ORIGIN stays a single canonical URL for
// building links in emails.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// records what students do (and where their phone said it was) for the owner's security view; see utils/monitor.js
app.use(activityLogger);

app.get("/api/health", (req, res) => res.json({ ok: true, service: "foundit-backend" }));

// Uploaded found-item photos — served from a different origin than the
// frontend in dev (and often in production too), so helmet's default
// same-origin CORP header has to be relaxed just for this path or the
// browser silently refuses to render the images.
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(process.env.UPLOAD_ROOT || path.join(__dirname, "..", "uploads"))
);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/lost-items", lostItemsRoutes);
app.use("/api/found-items", foundItemsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/tokens", tokensRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/tags", tagsRoutes);
app.use("/api/boosts", boostsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/monitor", monitorRoutes);

// The owner's private page: plain HTML, CSS and JS in owner-page/, separate from the app. It is only a viewer: it
// signs in with the owner's account and reads /api/monitor (owner only). Not linked from anywhere and kept out of
// search engines and caches.
app.use(
  "/owner",
  (req, res, next) => {
    res.set({
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    next();
  },
  express.static(path.join(__dirname, "..", "owner-page"))
);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

Sentry.setupExpressErrorHandler(app);

// Central error handler — catches anything thrown/rejected in a route
// that wasn't already handled, so the client always gets clean JSON
// instead of an HTML stack trace or a hung request.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error." });
});

module.exports = app;
