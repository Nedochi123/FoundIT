const fs = require("node:fs");
const path = require("node:path");
const db = require("../../db");

// Lives next to the live database file, on the same Railway volume.
// This protects against the most likely real failure modes -- a bad
// migration, an application bug, or an accidental delete -- by keeping
// same-day recovery points. It does NOT protect against total volume
// loss, since a backup on the same volume disappears with it; an admin
// can pull a copy off-platform via GET /api/admin/backups/:filename.
const BACKUP_DIR = path.join(path.dirname(db.dbPath), "backups");
const MAX_BACKUPS = 14;

function backupFilename(date = new Date()) {
  return `backup-${date.toISOString().replace(/[:.]/g, "-")}.db`;
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("backup-") && name.endsWith(".db"))
    .map((name) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// VACUUM INTO also compacts the copy (the live file accumulates WAL/free
// pages over time), so a backup is usually smaller than the live db.
// The target path can't already exist, which the timestamped filename
// guarantees in practice.
function runBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filePath = path.join(BACKUP_DIR, backupFilename());
  db.exec(`VACUUM INTO '${filePath.replace(/'/g, "''")}'`);

  const backups = listBackups();
  for (const old of backups.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old.name));
  }

  return { file: path.basename(filePath) };
}

module.exports = { runBackup, listBackups, BACKUP_DIR };
