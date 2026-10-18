const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const { AsyncLocalStorage } = require("node:async_hooks");
const { SCHOOLS, DEFAULT_SCHOOL_ID } = require("../src/config/schools");

// EACH SCHOOL HAS ITS OWN DATABASE FILE. Every student, item, chat, token, report and log of one school lives in that
// school's file and nowhere else.
//
// The rest of the server keeps writing `db.prepare(...)` exactly as before: `db` (exported below) always means "the
// database of the school this request is for". middleware/school.js decides the school for each request and runs the
// request inside it; work outside a request (start-up, the daily jobs) is the default school's unless it is run with
// forEachSchool() or runWithSchool().

// DATABASE_URL follows the "file:" URL convention: strip the prefix for
// a relative path (joined against this directory) or pass an absolute
// path straight through — the latter is what a Railway persistent
// volume mount looks like in production.
function resolveDbPath() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  const stripped = raw.startsWith("file:") ? raw.slice(5) : raw;
  return path.isAbsolute(stripped) ? stripped : path.join(__dirname, "..", stripped);
}

// Where a school's database lives. The default school keeps the original file, so nothing moves for it (on the live
// server that is the file DATABASE_URL points at); every other school gets its own file beside it, on the same volume:
// foundit.db -> foundit-baze.db, foundit-veritas.db and so on.
function schoolDbPath(id) {
  const main = resolveDbPath();
  if (id === DEFAULT_SCHOOL_ID) return main;
  const ext = path.extname(main);
  return path.join(path.dirname(main), `${path.basename(main, ext)}-${id}${ext || ".db"}`);
}

function initSchema(handle) {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  handle.exec(schema);
}

// Hand-rolled migration runner: for each [table, column, ddl] entry,
// checks PRAGMA table_info before running an ALTER TABLE, so this is
// safe to call on every boot without erroring on a column that already
// exists (node:sqlite has no "ADD COLUMN IF NOT EXISTS").
function columnExists(handle, table, column) {
  const columns = handle.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some((c) => c.name === column);
}

function runMigrations(handle) {
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
    // The look the student picked at sign-up: a color theme and a style of floating doodles.
    ["users", "theme", "ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'classic'"],
    ["users", "doodle", "ALTER TABLE users ADD COLUMN doodle TEXT NOT NULL DEFAULT 'none'"],
    // Which chat the owner confirmed the return in, so only that owner can add a thank-you reward.
    [
      "found_items",
      "return_confirmed_conversation_id",
      "ALTER TABLE found_items ADD COLUMN return_confirmed_conversation_id TEXT",
    ],
    // "Urgently need" posts (see utils/urgent.js)
    ["lost_items", "urgent_reward", "ALTER TABLE lost_items ADD COLUMN urgent_reward INTEGER"],
    ["lost_items", "urgent_at", "ALTER TABLE lost_items ADD COLUMN urgent_at TEXT"],
    ["lost_items", "urgent_agreed_at", "ALTER TABLE lost_items ADD COLUMN urgent_agreed_at TEXT"],
    // sticker sales recorded by the owner (see utils/revenue.js)
    ["revenue_entries", "quantity", "ALTER TABLE revenue_entries ADD COLUMN quantity INTEGER"],
    ["revenue_entries", "note", "ALTER TABLE revenue_entries ADD COLUMN note TEXT"],
    ["revenue_entries", "recorded_at", "ALTER TABLE revenue_entries ADD COLUMN recorded_at TEXT"],
    ["revenue_entries", "voided_at", "ALTER TABLE revenue_entries ADD COLUMN voided_at TEXT"],
  ];
  for (const [table, column, ddl] of migrations) {
    if (!columnExists(handle, table, column)) {
      handle.exec(ddl);
    }
  }
}

// Opens (creating it if it does not exist yet) one school's database, with the full schema and every migration, so
// all schools' files always have the same tables.
function openSchoolDb(id) {
  const handle = new DatabaseSync(schoolDbPath(id));
  handle.exec("PRAGMA journal_mode = WAL;");
  handle.exec("PRAGMA foreign_keys = ON;");
  initSchema(handle);
  runMigrations(handle);
  return handle;
}

// Every school's database is made and opened at start-up, open or not: a school that is not open yet simply cannot be
// reached (middleware/school.js refuses it), but its file is ready the moment it opens.
const handles = new Map(SCHOOLS.map((s) => [s.id, openSchoolDb(s.id)]));
const schoolOfRequest = new AsyncLocalStorage();

/** The school the code is running for: the request's school, or the default school outside a request. */
function currentSchoolId() {
  return schoolOfRequest.getStore() || DEFAULT_SCHOOL_ID;
}

/** A school's database (the current school's when no id is given). */
function schoolDb(id = currentSchoolId()) {
  const handle = handles.get(id);
  if (!handle) throw new Error(`No database for school "${id}".`);
  return handle;
}

/** Runs fn with `db` meaning this school's database (also inside anything fn awaits). */
function runWithSchool(id, fn) {
  if (!handles.has(id)) throw new Error(`No database for school "${id}".`);
  return schoolOfRequest.run(id, fn);
}

/** Runs fn once for every school, each time with `db` meaning that school's database. Returns { schoolId: result }. */
function forEachSchool(fn) {
  const results = {};
  for (const school of SCHOOLS) results[school.id] = runWithSchool(school.id, () => fn(school));
  return results;
}

function closeAll() {
  for (const handle of handles.values()) {
    try {
      handle.close();
    } catch {
      // already closed
    }
  }
}

// node:sqlite has no built-in transaction helper — this wraps a
// synchronous function in BEGIN/COMMIT, rolling back on any thrown error.
// It works on the database of the school the code is running for.
function transaction(fn) {
  return (...args) => {
    const handle = schoolDb();
    handle.exec("BEGIN");
    try {
      const result = fn(...args);
      handle.exec("COMMIT");
      return result;
    } catch (err) {
      handle.exec("ROLLBACK");
      throw err;
    }
  };
}

const helpers = {
  transaction,
  // the default school's file (the original one); see schoolDbPath() for any school's
  dbPath: resolveDbPath(),
  schoolDbPath,
  schoolDb,
  currentSchoolId,
  runWithSchool,
  forEachSchool,
  close: closeAll,
};

// `db` stands for "the current school's database": db.prepare(), db.exec() and the rest go to that school's file.
const db = new Proxy(
  {},
  {
    get(_target, prop) {
      if (Object.prototype.hasOwnProperty.call(helpers, prop)) return helpers[prop];
      const handle = schoolDb();
      const value = handle[prop];
      return typeof value === "function" ? value.bind(handle) : value;
    },
    set() {
      throw new Error("db is read-only");
    },
  }
);

module.exports = db;
