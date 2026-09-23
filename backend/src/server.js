require("./instrument");
const app = require("./app");
const { runBackup } = require("./utils/backup");

const PORT = process.env.PORT || 4000;
const DAY_MS = 24 * 60 * 60 * 1000;

app.listen(PORT, () => {
  console.log(`FoundIT backend listening on http://localhost:${PORT}`);
  console.log(`Allowed client origin: ${process.env.CLIENT_ORIGIN || "http://localhost:5173"}`);
});

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

// Delayed by 2 minutes past boot so a deploy's own startup work isn't
// competing with a VACUUM, then once every 24h after that.
setTimeout(() => {
  backupOnSchedule();
  setInterval(backupOnSchedule, DAY_MS);
}, 2 * 60 * 1000);
