const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const helmet = require("helmet");

// Modules
const { initDb } = require("./db/schema");
const { scheduleBackup } = require("./lib/backup");
const { authMiddleware } = require("./middleware/auth");
const { apiLimiter } = require("./middleware/rateLimit");
const { registerAuthRoutes } = require("./routes/auth");
const { registerShopRoutes } = require("./routes/shops");
const { registerOrderRoutes } = require("./routes/orders");
const { registerAdminRoutes } = require("./routes/admin");
const { orderLimiter } = require("./middleware/rateLimit");

fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'", "https:", "data:"],
      "connect-src": ["'self'"],
    },
  },
}));
app.use(express.json({ limit: "100kb" }));
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

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const PORT = process.env.PORT || 3456;

const ORDER_HTML = fs.readFileSync(path.join(__dirname, "public", "order.html"), "utf-8");

const db = new Database(path.join(__dirname, "data", "suriorder.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

initDb(db);
scheduleBackup(db);
const auth = authMiddleware(JWT_SECRET);

// Register all routes
registerAuthRoutes(app, db, { JWT_SECRET, auth });
registerShopRoutes(app, db);
registerOrderRoutes(app, db, { auth, orderLimiter });
registerAdminRoutes(app, db, { auth });

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Static pages
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/order/:shopId", (req, res) => {
  const shop = db.prepare("SELECT name, welcome_msg FROM shops WHERE id=? AND active=1").get(req.params.shopId);
  let html = ORDER_HTML;
  if (shop) {
    const esc = (s) => String(s).replace(/"/g, "&quot;");
    html = html.replace('content="" id="og-title"', `content="${esc(shop.name)}" id="og-title"`);
    html = html.replace('content="" id="og-desc"', `content="${esc(shop.welcome_msg || 'Gerechten bestellen')}" id="og-desc"`);
    html = html.replace('content="" id="og-url"', `content="${req.appBaseUrl}/order/${req.params.shopId}" id="og-url"`);
  }
  res.send(html);
});
app.get("/admin/:shopId", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

app.listen(PORT, () => {
  console.log(`SuriOrder running on http://localhost:${PORT}`);
  console.log(`Demo order page: http://localhost:${PORT}/order/demo`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/demo`);
});
