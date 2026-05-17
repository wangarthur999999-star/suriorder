const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");

const { initDb } = require("../db/schema");
const { authMiddleware } = require("../middleware/auth");
const { registerAuthRoutes } = require("../routes/auth");
const { registerShopRoutes } = require("../routes/shops");
const { registerOrderRoutes } = require("../routes/orders");
const { registerAdminRoutes } = require("../routes/admin");

const rateLimit = require("express-rate-limit");

function createTestApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "suriorder-test-"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initDb(db);

  const JWT_SECRET = crypto.randomBytes(32).toString("hex");
  const auth = authMiddleware(JWT_SECRET);
  const apiLimiter = rateLimit({ windowMs: 60_000, max: 1000, standardHeaders: true, legacyHeaders: false });
  const orderLimiter = rateLimit({ windowMs: 60_000, max: 1000, standardHeaders: true, legacyHeaders: false });
  const loginLimiter = rateLimit({ windowMs: 60_000, max: 1000, standardHeaders: true, legacyHeaders: false });

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", apiLimiter);

  app.use((req, _res, next) => {
    req.appBaseUrl = `http://localhost:${req.socket.localPort}`;
    next();
  });

  app.get("/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", uptime: process.uptime() });
  });

  registerAuthRoutes(app, db, { JWT_SECRET, auth, loginLimiter });
  registerShopRoutes(app, db);
  registerOrderRoutes(app, db, { auth, orderLimiter });
  registerAdminRoutes(app, db, { auth });

  return { app, db, JWT_SECRET, tmpDir };
}

function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;
      resolve({ server, baseUrl, close: () => { server.close(); } });
    });
  });
}

function cleanup(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
}

async function registerAndLogin(baseUrl) {
  const r1 = await fetch(`${baseUrl}/api/shops`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Eatery", phone: "+5971234567", language: "nl", admin_pin: "5678", whatsapp_number: "+5971234567" }),
  });
  const { id } = await r1.json();

  const r2 = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: id, admin_pin: "5678" }),
  });
  const { token } = await r2.json();

  return { shopId: id, token };
}

function authHeaders(token) {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

module.exports = { createTestApp, startServer, cleanup, registerAndLogin, authHeaders };
