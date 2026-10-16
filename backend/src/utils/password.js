const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// A hash nobody can match. It is compared when an email is unknown, so "no such account" takes as long as "wrong password"
// and the answer time cannot be used to find out which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync(`not-a-real-password-${Math.random()}`, SALT_ROUNDS);

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt only reads the first 72 bytes: anything longer would be silently cut short

/** A password we accept for a new or changed password: text, at least 8 characters, and no more than bcrypt can use. */
const isAcceptablePassword = (plain) => typeof plain === "string" && plain.length >= MIN_PASSWORD_LENGTH && Buffer.byteLength(plain) <= MAX_PASSWORD_BYTES;

module.exports = { hashPassword, verifyPassword, DUMMY_HASH, isAcceptablePassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES };
