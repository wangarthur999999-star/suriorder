const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const helmet = require("helmet");
const morgan = require("morgan");

// Modules
const { initDb } = require("./db/schema");
const { scheduleBackup } = require("./lib/backup");
const logger = require("./lib/logger");
const { authMiddleware } = require("./middleware/auth");
const { apiLimiter, orderLimiter } = require("./middleware/rateLimit");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: "too many attempts" } });
const { registerAuthRoutes } = require("./routes/auth");
const { registerShopRoutes } = require("./routes/shops");
const { registerOrderRoutes } = require("./routes/orders");
const { registerAdminRoutes } = require("./routes/admin");
const { registerWebhookRoute } = require("./routes/webhook");

fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'", "https:", "data:"],
      "connect-src": ["'self'"],
    },
  },
}));
app.use(morgan("short"));
app.use(express.json({ limit: "100kb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.static("public"));
app.use("/api", apiLimiter);

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use((req, res, next) => {
  req.appBaseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  next();
});

// JWT secret: env var > persisted file > generate once and save
const JWT_SECRET_FILE = path.join(__dirname, "data", ".jwt_secret");
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  try { JWT_SECRET = fs.readFileSync(JWT_SECRET_FILE, "utf-8").trim(); } catch (_) {}
  if (!JWT_SECRET) {
    JWT_SECRET = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(JWT_SECRET_FILE, JWT_SECRET);
  }
} else {
  try { fs.writeFileSync(JWT_SECRET_FILE, JWT_SECRET); } catch (_) {}
}
const PORT = process.env.PORT || 3456;

const ORDER_HTML = fs.readFileSync(path.join(__dirname, "public", "order.html"), "utf-8");

const db = new Database(path.join(__dirname, "data", "suriorder.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

initDb(db);
scheduleBackup(db);
const auth = authMiddleware(JWT_SECRET);

// Register all routes
registerAuthRoutes(app, db, { JWT_SECRET, auth, loginLimiter });
registerShopRoutes(app, db);
registerOrderRoutes(app, db, { auth, orderLimiter });
registerAdminRoutes(app, db, { auth });
registerWebhookRoute(app, db);

// Health check
app.get("/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", uptime: process.uptime() });
  } catch (e) {
    res.status(503).json({ status: "error", message: e.message });
  }
});

// Static pages
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/order/:shopId", (req, res) => {
  const shop = db.prepare("SELECT name, welcome_msg FROM shops WHERE id=? AND active=1").get(req.params.shopId);
  let html = ORDER_HTML;
  if (shop) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
    html = html.replace('content="" id="og-title"', `content="${esc(shop.name)}" id="og-title"`);
    html = html.replace('content="" id="og-desc"', `content="${esc(shop.welcome_msg || 'Gerechten bestellen')}" id="og-desc"`);
    html = html.replace('content="" id="og-url"', `content="${req.appBaseUrl}/order/${req.params.shopId}" id="og-url"`);
  }
  res.send(html);
});
app.get("/admin/:shopId", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/register", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/privacy", (_req, res) => res.sendFile(path.join(__dirname, "public", "privacy.html")));
app.get("/tos", (_req, res) => res.sendFile(path.join(__dirname, "public", "tos.html")));

const server = app.listen(PORT, () => {
  logger.info("server started", { port: PORT, env: process.env.NODE_ENV || "development" });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  server.close(() => { logger.info("server closed"); process.exit(0); });
  setTimeout(() => { process.exit(0); }, 9000);
});

process.on("uncaughtException", (err) => {
  logger.error("uncaught exception", { error: err.stack || err.message });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection", { error: reason.stack || reason });
});
