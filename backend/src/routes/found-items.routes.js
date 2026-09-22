const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireOwnedFoundItem } = require("../middleware/auth");
const { broadcastPush } = require("../utils/push");
const { idNumberSchema } = require("../utils/idNumber");

const router = express.Router();

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.join(__dirname, "..", "..", "uploads");
const UPLOAD_DIR = path.join(UPLOAD_ROOT, "found-items");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED_MIME_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      return cb(new Error("Only JPEG, PNG, or WEBP images are allowed."));
    }
    cb(null, true);
  },
});

function serialize(row, posterName) {
  return {
    id: row.id,
    posterId: row.poster_id,
    posterName,
    photoUrl: row.photo_url,
    description: row.description,
    location: row.location,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get("/", (req, res) => {
  const status = req.query.status === "resolved" ? "resolved" : "open";
  const rows = db
    .prepare(
      `SELECT found_items.*, users.name AS poster_name
       FROM found_items JOIN users ON users.id = found_items.poster_id
       WHERE found_items.status = ?
       ORDER BY found_items.created_at DESC`
    )
    .all(status);
  res.json({ items: rows.map((r) => serialize(r, r.poster_name)) });
});

const createSchema = z.object({
  description: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(200).optional(),
  idNumber: idNumberSchema,
});

router.post("/", requireAuth, upload.single("photo"), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "A photo of the found item is required." });
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { description, location, idNumber } = parsed.data;

    // Fill id_number once, only if the user hasn't already provided it —
    // never overwrite an existing value or re-ask on every post.
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (idNumber && !user.id_number) {
      db.prepare("UPDATE users SET id_number = ? WHERE id = ?").run(idNumber, req.user.id);
    }

    const id = crypto.randomUUID();
    const photoUrl = `/uploads/found-items/${req.file.filename}`;
    db.prepare(
      "INSERT INTO found_items (id, poster_id, photo_url, description, location) VALUES (?, ?, ?, ?, ?)"
    ).run(id, req.user.id, photoUrl, description || null, location || null);

    const item = db.prepare("SELECT * FROM found_items WHERE id = ?").get(id);
    res.status(201).json({ item: serialize(item, req.user.name) });

    broadcastPush({
      title: "Found something!",
      body: `${req.user.name} found something on campus — check the gallery.`,
      url: "/gallery",
      excludeUserId: req.user.id,
    }).catch((err) => console.error("Broadcast push failed:", err));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/resolve", requireAuth, requireOwnedFoundItem(db), (req, res) => {
  db.prepare(
    "UPDATE found_items SET status = 'resolved', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
