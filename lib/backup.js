const fs = require("fs");
const path = require("path");

const BACKUP_INTERVAL = 21600000; // 6 hours
const MAX_BACKUPS = 10;

function scheduleBackup(db) {
  const dir = path.join(__dirname, "..", "data");

  function runBackup() {
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
      const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
      const filename = `suriorder-backup-${ts}.db`;
      const dest = path.join(dir, filename);
      fs.copyFileSync(path.join(dir, "suriorder.db"), dest);
      console.log(`Backup created: ${filename}`);

      const backups = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith("suriorder-backup-") && f.endsWith(".db"))
        .sort();

      while (backups.length > MAX_BACKUPS) {
        fs.unlinkSync(path.join(dir, backups.shift()));
      }
    } catch (err) {
      console.error("Backup failed:", err.message);
    }
  }

  runBackup();
  setInterval(runBackup, BACKUP_INTERVAL);
}

module.exports = { scheduleBackup };
