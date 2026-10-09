const crypto = require("crypto");

// No 0/O/1/I, so a code read aloud or typed from a sticker isn't mistaken. 8 characters from 32
// symbols is about 1.1 trillion combinations, so a code can't be guessed by trying them.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function newTagCode() {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** What a person typed or scanned -> the stored form ("k7m2-qx4p " -> "K7M2QX4P"). */
function normalizeCode(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * When a student deletes their account: erase every chat on their tags (finders may have shared numbers)
 * and retire the tags, so a scan says "hand it to campus security" rather than reaching nobody.
 */
function retireTagsOf(db, userId) {
  db.transaction(() => {
    db.prepare(
      "DELETE FROM tag_messages WHERE thread_id IN (SELECT id FROM tag_threads WHERE tag_id IN (SELECT id FROM tags WHERE owner_id = ?))"
    ).run(userId);
    db.prepare("DELETE FROM tag_threads WHERE tag_id IN (SELECT id FROM tags WHERE owner_id = ?)").run(userId);
    db.prepare("UPDATE tags SET owner_id = NULL, label = NULL, status = 'retired' WHERE owner_id = ?").run(userId);
  })();
}

module.exports = { newTagCode, normalizeCode, retireTagsOf };
