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

module.exports = { newTagCode, normalizeCode };
