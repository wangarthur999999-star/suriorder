// Structured JSON logger
// Levels: debug, info, warn, error
// Set LOG_LEVEL env var to control verbosity (default: info)

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function log(level, message, extra) {
  if (LEVELS[level] < currentLevel) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(extra || {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

const logger = {
  debug: (msg, extra) => log("debug", msg, extra),
  info: (msg, extra) => log("info", msg, extra),
  warn: (msg, extra) => log("warn", msg, extra),
  error: (msg, extra) => log("error", msg, extra),
};

module.exports = logger;
