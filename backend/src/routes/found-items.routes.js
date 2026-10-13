const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireOwnedFoundItem } = require("../middleware/auth");
const { postItemLimiter } = require("../middleware/rateLimiters");
const { broadcastPush } = require("../utils/push");
const { idNumberSchema } = require("../utils/idNumber");
const { ITEM_CATEGORIES } = require("../utils/itemCategories");
const { fileIsImage } = require("../utils/imageCheck");

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
      return cb(Object.assign(new Error("Only JPEG, PNG, or WEBP images are allowed."), { status: 400 }));
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
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get("/", (req, res) => {
  // "reunited" is its own branch (not just another status value) since
  // it orders by return_confirmed_at, not created_at -- the Wall of
  // Reunions cares about when the return happened, not when the item
  // was originally posted.
  if (req.query.status === "reunited") {
    const rows = db
      .prepare(
        `SELECT found_items.*, users.name AS poster_name
         FROM found_items JOIN users ON users.id = found_items.poster_id
         WHERE found_items.return_confirmed_at IS NOT NULL
         ORDER BY found_items.return_confirmed_at DESC
         LIMIT 12`
      )
      .all();
    return res.json({ items: rows.map((r) => serialize(r, r.poster_name)) });
  }

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
  category: z.enum(ITEM_CATEGORIES).optional(),
  idNumber: idNumberSchema,
});

router.post("/", requireAuth, postItemLimiter, upload.single("photo"), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "A photo of the found item is required." });
    }
    // the file is already on disk: a photo that is refused below must not be left there
    const discard = () => fs.rm(req.file.path, { force: true }, () => {});
    // the upload SAYS it is an image; the file's first bytes must agree (a web page renamed ".png" is not kept)
    if (!fileIsImage(req.file.path, req.file.mimetype)) {
      discard();
      return res.status(400).json({ error: "That file doesn't look like a photo. Please choose a JPEG, PNG or WEBP image." });
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      discard();
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { description, location, category: itemCategory, idNumber } = parsed.data;

    // Fill id_number once, only if the user hasn't already provided it —
    // never overwrite an existing value or re-ask on every post.
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (idNumber && !user.id_number) {
      db.prepare("UPDATE users SET id_number = ? WHERE id = ?").run(idNumber, req.user.id);
    }

    const id = crypto.randomUUID();
    const photoUrl = `/uploads/found-items/${req.file.filename}`;
    db.prepare(
      "INSERT INTO found_items (id, poster_id, photo_url, description, location, category) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, req.user.id, photoUrl, description || null, location || null, itemCategory || null);

    const item = db.prepare("SELECT * FROM found_items WHERE id = ?").get(id);
    res.status(201).json({ item: serialize(item, req.user.name) });

    broadcastPush({
      title: "Found something!",
      body: `${req.user.name} found something on campus — check the gallery.`,
      url: "/gallery",
      excludeUserId: req.user.id,
      category: "found",
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
