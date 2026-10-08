const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

// DATABASE_URL follows the "file:" URL convention: strip the prefix for
// a relative path (joined against this directory) or pass an absolute
// path straight through — the latter is what a Railway persistent
// volume mount looks like in production.
function resolveDbPath() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  const stripped = raw.startsWith("file:") ? raw.slice(5) : raw;
  return path.isAbsolute(stripped) ? stripped : path.join(__dirname, "..", stripped);
}

const db = new DatabaseSync(resolveDbPath());

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
}

// node:sqlite has no built-in transaction helper — this wraps a
// synchronous function in BEGIN/COMMIT, rolling back on any thrown error.
function transaction(fn) {
  return (...args) => {
    db.exec("BEGIN");
    try {
      const result = fn(...args);
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };
}

// Hand-rolled migration runner: for each [table, column, ddl] entry,
// checks PRAGMA table_info before running an ALTER TABLE, so this is
// safe to call on every boot without erroring on a column that already
// exists (node:sqlite has no "ADD COLUMN IF NOT EXISTS").
function columnExists(table, column) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some((c) => c.name === column);
}

function runMigrations() {
  const migrations = [
    // [table, column, "ALTER TABLE ... ADD COLUMN ..."] — add future
    // migrations here as the schema evolves after launch.
    ["users", "tokens", "ALTER TABLE users ADD COLUMN tokens INTEGER NOT NULL DEFAULT 0"],
    ["found_items", "return_confirmed_at", "ALTER TABLE found_items ADD COLUMN return_confirmed_at TEXT"],
    ["found_items", "expired_at", "ALTER TABLE found_items ADD COLUMN expired_at TEXT"],
    ["lost_items", "expired_at", "ALTER TABLE lost_items ADD COLUMN expired_at TEXT"],
    [
      "push_subscriptions",
      "notify_lost",
      "ALTER TABLE push_subscriptions ADD COLUMN notify_lost INTEGER NOT NULL DEFAULT 1",
    ],
    [
      "push_subscriptions",
      "notify_found",
      "ALTER TABLE push_subscriptions ADD COLUMN notify_found INTEGER NOT NULL DEFAULT 1",
    ],
    ["users", "suspended_at", "ALTER TABLE users ADD COLUMN suspended_at TEXT"],
    ["users", "deleted_at", "ALTER TABLE users ADD COLUMN deleted_at TEXT"],
    ["lost_items", "category", "ALTER TABLE lost_items ADD COLUMN category TEXT"],
    ["found_items", "category", "ALTER TABLE found_items ADD COLUMN category TEXT"],
    // Which chat the owner confirmed the return in, so only that owner can add a thank-you reward.
    [
      "found_items",
      "return_confirmed_conversation_id",
      "ALTER TABLE found_items ADD COLUMN return_confirmed_conversation_id TEXT",
    ],
  ];
  for (const [table, column, ddl] of migrations) {
    if (!columnExists(table, column)) {
      db.exec(ddl);
    }
  }
}

initSchema();
runMigrations();

module.exports = db;
module.exports.transaction = transaction;
module.exports.dbPath = resolveDbPath();
