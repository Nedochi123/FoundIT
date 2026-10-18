const fs = require("node:fs");
const path = require("node:path");
const db = require("../../db");

// Lives next to the live database file, on the same Railway volume.
// This protects against the most likely real failure modes -- a bad
// migration, an application bug, or an accidental delete -- by keeping
// same-day recovery points. It does NOT protect against total volume
// loss, since a backup on the same volume disappears with it; an admin
// can pull a copy off-platform via GET /api/admin/backups/:filename.
// The default school's backups stay in backups/; every other school's go in backups/<school>/.
const BACKUP_DIR = path.join(path.dirname(db.dbPath), "backups");
const { DEFAULT_SCHOOL_ID } = require("../config/schools");
function backupDir(schoolId = db.currentSchoolId()) {
  return schoolId === DEFAULT_SCHOOL_ID ? BACKUP_DIR : path.join(BACKUP_DIR, schoolId);
}
const MAX_BACKUPS = 14;

function backupFilename(date = new Date()) {
  return `backup-${date.toISOString().replace(/[:.]/g, "-")}.db`;
}

function listBackups() {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("backup-") && name.endsWith(".db"))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// VACUUM INTO also compacts the copy (the live file accumulates WAL/free
// pages over time), so a backup is usually smaller than the live db.
// The target path can't already exist, which the timestamped filename
// guarantees in practice.
function runBackup() {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, backupFilename());
  db.exec(`VACUUM INTO '${filePath.replace(/'/g, "''")}'`);

  const backups = listBackups();
  for (const old of backups.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(dir, old.name));
  }

  return { file: path.basename(filePath) };
}

module.exports = { runBackup, listBackups, backupDir, BACKUP_DIR };
