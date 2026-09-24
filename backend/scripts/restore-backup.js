#!/usr/bin/env node
// Restores the live database from one of the automated daily backups.
// This is a deliberately manual, operator-run script rather than an
// admin UI button -- restoring is destructive (it overwrites everything
// created since the chosen snapshot), and running it needs a service
// restart right after anyway, since the live process's already-open
// database handle won't pick up a file swapped out from under it.
//
// Usage:
//   node scripts/restore-backup.js --list
//   node scripts/restore-backup.js <backup-filename>

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const db = require("../db");
const { listBackups, runBackup, BACKUP_DIR } = require("../src/utils/backup");

const arg = process.argv[2];

function printUsage() {
  const backups = listBackups();
  if (backups.length === 0) {
    console.log("No backups found in " + BACKUP_DIR);
  } else {
    console.log("Available backups:");
    for (const b of backups) {
      console.log(`  ${b.name}  (${(b.sizeBytes / 1024).toFixed(0)} KB, ${b.createdAt})`);
    }
  }
  console.log("\nUsage: node scripts/restore-backup.js <backup-filename>");
}

if (!arg || arg === "--list" || arg === "-h" || arg === "--help") {
  printUsage();
  process.exit(0);
}

const backupPath = path.join(BACKUP_DIR, arg);
if (!fs.existsSync(backupPath)) {
  console.error(`Backup not found: ${arg}\n`);
  printUsage();
  process.exit(1);
}

// Validate the file is actually a readable FoundIT database before
// touching anything live -- opening it read-only can't corrupt it
// either way, so this check is free.
try {
  const check = new DatabaseSync(backupPath, { readOnly: true });
  const tables = check.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  check.close();
  if (!tables.some((t) => t.name === "users")) {
    throw new Error("no 'users' table found -- this doesn't look like a FoundIT database");
  }
} catch (err) {
  console.error(`Backup file failed validation: ${err.message}`);
  process.exit(1);
}

console.log("Taking a safety snapshot of the current live database first...");
const { file: safetyFile } = runBackup();
console.log(`Safety snapshot saved: ${safetyFile} (restore from this to undo)`);

const dbPath = db.dbPath;
// This script's own require("../db") opened a live WAL-mode connection
// to the database -- closing it here isn't optional cleanup, it's what
// makes the sidecar files below removable at all. Without this, the
// script is the thing holding its own dev.db-wal locked and fails
// every time, even with no other process running.
db.close();

// WAL/SHM sidecar files describe uncommitted changes against the OLD
// database file -- replaying them against the just-restored file would
// silently reintroduce data the restore was meant to remove, so they
// have to go. Cleared BEFORE touching the live .db file itself: if a
// still-running service (or, as above, this same connection) has them
// locked, this fails here instead of after the base file has already
// been overwritten, leaving the database in whatever state it was in
// before this script ran.
const sidecars = ["-wal", "-shm"].map((ext) => dbPath + ext).filter((p) => fs.existsSync(p));
for (const sidecar of sidecars) {
  try {
    fs.unlinkSync(sidecar);
  } catch (err) {
    console.error(`\nCouldn't remove ${path.basename(sidecar)}: ${err.message}`);
    console.error("This usually means the service is still running and has the database open.");
    console.error("Stop the service first, then run this script again. Nothing has been changed.");
    process.exit(1);
  }
}

console.log(`Restoring from ${arg}...`);
fs.copyFileSync(backupPath, dbPath);

console.log("\nRestore complete.");
console.log("IMPORTANT: restart the service now -- the running process still has the");
console.log("old database open in memory and won't see this change until it restarts.");
