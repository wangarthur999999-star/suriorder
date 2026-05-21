const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const BACKUP_INTERVAL = 3600000; // 1 hour (was 6h — tighter for trial)
const MAX_BACKUPS = 48; // 2 days of hourly backups (was 10)

function scheduleBackup(db) {
  const dir = path.join(__dirname, "..", "data");

  function runBackup() {
    try {
      const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
      const filename = `suriorder-backup-${ts}.db`;
      const dest = path.join(dir, filename);
      // better-sqlite3 .backup() handles WAL checkpoint internally + atomic snapshot
      db.backup(dest);
      logger.info("backup created", { filename });

      const backups = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith("suriorder-backup-") && f.endsWith(".db"))
        .sort();

      while (backups.length > MAX_BACKUPS) {
        const removed = backups.shift();
        fs.unlinkSync(path.join(dir, removed));
        logger.info("old backup pruned", { filename: removed });
      }
    } catch (err) {
      logger.error("backup failed", { error: err.message });
    }
  }

  runBackup();
  setInterval(runBackup, BACKUP_INTERVAL);
}

module.exports = { scheduleBackup };
