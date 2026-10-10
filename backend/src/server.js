require("./instrument");
const app = require("./app");
const { runBackup } = require("./utils/backup");
const { expireStaleItems } = require("./utils/expireItems");
const { purgeOldActivity, RETENTION_DAYS } = require("./utils/monitor");
const { installShutdown } = require("./utils/shutdown");
const db = require("../db");

const PORT = process.env.PORT || 4000;
const DAY_MS = 24 * 60 * 60 * 1000;

const server = app.listen(PORT, () => {
  console.log(`FoundIT backend listening on http://localhost:${PORT}`);
  console.log(`Allowed client origin: ${process.env.CLIENT_ORIGIN || "http://localhost:5173"}`);
});

// Exit cleanly when the host stops the server, so a redeploy isn't reported as a crash (see utils/shutdown.js).
installShutdown(server, { onClose: () => db.close() });

// A failed backup logs but never crashes the process -- missing one
// day's snapshot shouldn't take the whole app down.
function backupOnSchedule() {
  try {
    const { file } = runBackup();
    console.log(`Database backup written: ${file}`);
  } catch (err) {
    console.error("Database backup failed:", err);
  }
}

function expireItemsOnSchedule() {
  try {
    const { lostExpired, foundExpired } = expireStaleItems();
    if (lostExpired || foundExpired) {
      console.log(`Auto-expired ${lostExpired} lost item(s), ${foundExpired} found item(s)`);
    }
  } catch (err) {
    console.error("Item auto-expiry failed:", err);
  }
}

// Delayed by 2 minutes past boot so a deploy's own startup work isn't
// competing with a VACUUM, then once every 24h after that.
setTimeout(() => {
  backupOnSchedule();
  setInterval(backupOnSchedule, DAY_MS);
}, 2 * 60 * 1000);

setTimeout(() => {
  expireItemsOnSchedule();
  setInterval(expireItemsOnSchedule, DAY_MS);
}, 3 * 60 * 1000);

// The activity log (and the locations in it) is only kept for RETENTION_DAYS.
function purgeActivityOnSchedule() {
  try {
    const { activity } = purgeOldActivity();
    if (activity) console.log(`Deleted ${activity} activity row(s) older than ${RETENTION_DAYS} days`);
  } catch (err) {
    console.error("Activity purge failed:", err);
  }
}
setTimeout(() => {
  purgeActivityOnSchedule();
  setInterval(purgeActivityOnSchedule, DAY_MS);
}, 4 * 60 * 1000);
