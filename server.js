const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Ensure data directory exists (needed for fresh Render deploys)
fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });

const app = express();
app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const PORT = process.env.PORT || 3456;

// Rate limiters
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);

const db = new Database(path.join(__dirname, "data", "suriorder.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    language TEXT DEFAULT 'nl',
    admin_pin TEXT NOT NULL,
    welcome_msg TEXT,
    whatsapp_number TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL REFERENCES shops(id),
    name TEXT NOT NULL,
    name_zh TEXT, name_en TEXT,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL REFERENCES shops(id),
    category_id INTEGER REFERENCES categories(id),
    name TEXT NOT NULL,
    name_zh TEXT, name_en TEXT,
    desc TEXT, desc_zh TEXT, desc_en TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    available INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    items_json TEXT NOT NULL,
    total REAL NOT NULL,
    note TEXT,
    pickup_time TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Auto-seed demo shop if not present
const demoExists = db.prepare("SELECT 1 FROM shops WHERE id='demo'").get();
if (!demoExists) {
  const demoHash = bcrypt.hashSync("1234", 10);
  db.prepare("INSERT INTO shops (id, name, phone, language, admin_pin, whatsapp_number) VALUES (?,?,?,?,?,?)").run("demo", "Wangs Eatery", "+5971234567", "nl", demoHash, "+5971234567");
  const cat1 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, sort_order) VALUES (?,?,?,?,?)").run("demo", "Rijst gerechten", "饭类", "Rice dishes", 1).lastInsertRowid;
  const cat2 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, sort_order) VALUES (?,?,?,?,?)").run("demo", "Noedels", "面类", "Noodles", 2).lastInsertRowid;
  const cat3 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, sort_order) VALUES (?,?,?,?,?)").run("demo", "Drankjes", "饮品", "Drinks", 3).lastInsertRowid;
  const insertItem = db.prepare("INSERT INTO items (shop_id, category_id, name, name_zh, name_en, desc, desc_zh, desc_en, price, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const demoItems = [
    [cat1, "Nasi Goreng", "印尼炒饭", "Fried Rice", "Met kip en groenten", "鸡肉蔬菜炒饭", "With chicken and veggies", 45],
    [cat1, "Moksi Meti", "混合米饭", "Mixed Rice", "Surinaamse mix met vlees", "苏里南混合肉类米饭", "Surinamese mixed meat rice", 55],
    [cat1, "Roti Kip", "鸡肉飞饼", "Chicken Roti", "Met aardappel en kousenband", "配土豆和豆角", "With potato and long beans", 50],
    [cat2, "Bami Goreng", "炒面", "Fried Noodles", "Met kip of garnalen", "鸡肉或虾仁", "With chicken or shrimp", 40],
    [cat2, "Tjauw Min", "炒面（潮州）", "Chow Mein", "Chinese stijl met groenten", "中式蔬菜炒面", "Chinese style with veggies", 42],
    [cat3, "Parbo Bier", "Parbo啤酒", "Parbo Beer", "Lokaal gebrouwen", "本地酿造", "Locally brewed", 15],
    [cat3, "Verse Kokoswater", "新鲜椰子水", "Fresh Coconut Water", "Uit eigen tuin", "自家种植", "From our garden", 12],
  ];
  demoItems.forEach((item, idx) => {
    insertItem.run("demo", item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], idx);
  });
  console.log("Auto-seeded demo shop");
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Shop creation
app.post("/api/shops", (req, res) => {
  const { name, phone, language, admin_pin, whatsapp_number } = req.body;
  if (!name || !admin_pin) return res.status(400).json({ error: "name and admin_pin required" });
  if (admin_pin.length < 4) return res.status(400).json({ error: "PIN must be at least 4 characters" });
  const id = crypto.randomBytes(6).toString("hex");
  const hash = bcrypt.hashSync(admin_pin, 10);
  db.prepare("INSERT INTO shops (id, name, phone, language, admin_pin, whatsapp_number) VALUES (?,?,?,?,?,?)").run(id, name, phone, language || "nl", hash, whatsapp_number);
  const token = jwt.sign({ shopId: id }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ id, name, token });
});

// Login
app.post("/api/login", (req, res) => {
  const { shop_id, admin_pin } = req.body;
  if (!shop_id || !admin_pin) return res.status(400).json({ error: "shop_id and admin_pin required" });
  const shop = db.prepare("SELECT * FROM shops WHERE id=?").get(shop_id);
  if (!shop) return res.status(401).json({ error: "invalid credentials" });
  const valid = bcrypt.compareSync(admin_pin, shop.admin_pin);
  if (!valid) return res.status(401).json({ error: "invalid credentials" });
  const token = jwt.sign({ shopId: shop.id }, JWT_SECRET, { expiresIn: "24h" });
  const { admin_pin: _, ...safeShop } = shop;
  res.json({ token, shop: safeShop });
});

// Auth middleware — verifies JWT
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.shopId = payload.shopId;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}

// Public: shop menu
app.get("/api/shop/:shopId", (req, res) => {
  const shop = db.prepare("SELECT id, name, phone, language, welcome_msg, whatsapp_number FROM shops WHERE id=? AND active=1").get(req.params.shopId);
  if (!shop) return res.status(404).json({ error: "shop not found" });
  const cats = db.prepare("SELECT * FROM categories WHERE shop_id=? ORDER BY sort_order").all(shop.id);
  const items = db.prepare("SELECT * FROM items WHERE shop_id=? AND available=1 ORDER BY sort_order").all(shop.id);
  res.json({ shop, categories: cats, items });
});

// Public: menu share link
app.get("/api/shop/:shopId/menu-link", (req, res) => {
  const shop = db.prepare("SELECT id, name FROM shops WHERE id=? AND active=1").get(req.params.shopId);
  if (!shop) return res.status(404).json({ error: "not found" });
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const link = `${baseUrl}/order/${shop.id}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(shop.name + " - Bestel nu: " + link)}`;
  res.json({ link, wa_link: waLink });
});

// Admin: dashboard
app.get("/api/admin/dashboard", auth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const ordersToday = db.prepare("SELECT COUNT(*) as count, SUM(total) as total FROM orders WHERE shop_id=? AND date(created_at)=?").get(req.shopId, today);
  const ordersWeek = db.prepare("SELECT COUNT(*) as count, SUM(total) as total FROM orders WHERE shop_id=? AND created_at >= datetime('now','-7 days')").get(req.shopId);
  const pending = db.prepare("SELECT COUNT(*) as count FROM orders WHERE shop_id=? AND status='pending'").get(req.shopId);
  const topItems = db.prepare(`
    SELECT i.name, COUNT(*) as cnt FROM orders o, json_each(o.items_json) j
    JOIN items i ON i.id = json_extract(j.value, '$.id')
    WHERE o.shop_id=? AND o.created_at >= datetime('now','-30 days')
    GROUP BY i.name ORDER BY cnt DESC LIMIT 5
  `).all(req.shopId);
  res.json({ ordersToday, ordersWeek, pending, topItems });
});

// Admin: orders list
app.get("/api/admin/orders", auth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const orders = db.prepare("SELECT * FROM orders WHERE shop_id=? ORDER BY created_at DESC LIMIT ?").all(req.shopId, limit);
  res.json(orders);
});

// Admin: update order status
app.put("/api/admin/orders/:id", auth, (req, res) => {
  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "done", "cancelled"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "invalid status" });
  db.prepare("UPDATE orders SET status=? WHERE id=? AND shop_id=?").run(status, req.params.id, req.shopId);
  res.json({ ok: true });
});

// Admin: items list
app.get("/api/admin/items", auth, (req, res) => {
  const items = db.prepare(`
    SELECT i.*, c.name as category_name FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    WHERE i.shop_id=? ORDER BY c.sort_order, i.sort_order
  `).all(req.shopId);
  res.json(items);
});

// Admin: add item
app.post("/api/admin/items", auth, (req, res) => {
  const { name, name_zh, name_en, desc, desc_zh, desc_en, price, category_id, image_url } = req.body;
  if (!name || price == null) return res.status(400).json({ error: "name and price required" });
  if (typeof price !== "number" || price < 0) return res.status(400).json({ error: "invalid price" });
  db.prepare("INSERT INTO items (shop_id, category_id, name, name_zh, name_en, desc, desc_zh, desc_en, price, image_url) VALUES (?,?,?,?,?,?,?,?,?,?)").run(req.shopId, category_id || null, name, name_zh || null, name_en || null, desc || null, desc_zh || null, desc_en || null, price, image_url || null);
  res.json({ ok: true });
});

// Admin: update item
app.put("/api/admin/items/:id", auth, (req, res) => {
  const { name, name_zh, name_en, desc, desc_zh, desc_en, price, available, category_id, image_url } = req.body;
  if (price != null && (typeof price !== "number" || price < 0)) return res.status(400).json({ error: "invalid price" });
  db.prepare("UPDATE items SET name=?, name_zh=?, name_en=?, desc=?, desc_zh=?, desc_en=?, price=?, available=?, category_id=?, image_url=? WHERE id=? AND shop_id=?").run(name, name_zh, name_en, desc, desc_zh, desc_en, price, available ?? 1, category_id, image_url, req.params.id, req.shopId);
  res.json({ ok: true });
});

// Admin: delete item
app.delete("/api/admin/items/:id", auth, (req, res) => {
  db.prepare("DELETE FROM items WHERE id=? AND shop_id=?").run(req.params.id, req.shopId);
  res.json({ ok: true });
});

// Admin: categories list
app.get("/api/admin/categories", auth, (req, res) => {
  res.json(db.prepare("SELECT * FROM categories WHERE shop_id=? ORDER BY sort_order").all(req.shopId));
});

// Admin: add category
app.post("/api/admin/categories", auth, (req, res) => {
  const { name, name_zh, name_en } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en) VALUES (?,?,?,?)").run(req.shopId, name, name_zh || null, name_en || null);
  res.json({ ok: true });
});

// Public: place order
app.post("/api/order", orderLimiter, (req, res) => {
  const { shop_id, customer_name, customer_phone, items, note, pickup_time } = req.body;
  if (!shop_id || !customer_name || !items || !items.length) return res.status(400).json({ error: "missing fields" });
  if (!Array.isArray(items) || items.length > 50) return res.status(400).json({ error: "too many items" });
  const shop = db.prepare("SELECT * FROM shops WHERE id=? AND active=1").get(shop_id);
  if (!shop) return res.status(404).json({ error: "shop not found" });

  const ids = items.map(i => i.id);
  const placeholders = ids.map(() => "?").join(",");
  const dbItems = db.prepare(`SELECT * FROM items WHERE id IN (${placeholders})`).all(...ids);
  let total = 0;
  const orderItems = [];
  for (const oi of items) {
    const dbi = dbItems.find(d => d.id === oi.id);
    if (!dbi) return res.status(400).json({ error: `item ${oi.id} not found` });
    const qty = oi.qty || 1;
    total += dbi.price * qty;
    orderItems.push({ id: dbi.id, name: dbi.name, price: dbi.price, qty });
  }

  const orderId = crypto.randomBytes(4).toString("hex");
  db.prepare("INSERT INTO orders (id, shop_id, customer_name, customer_phone, items_json, total, note, pickup_time) VALUES (?,?,?,?,?,?,?,?)").run(orderId, shop_id, customer_name, customer_phone || null, JSON.stringify(orderItems), total, note || null, pickup_time || null);

  res.json({ order_id: orderId, total, items: orderItems });
});

// Translate helper
app.post("/api/translate", auth, (req, res) => {
  const { text, from, to } = req.body;
  if (!text || !to) return res.status(400).json({ error: "text and to required" });
  res.json({
    original: text,
    suggestion: `[${to.toUpperCase()}] ${text}`,
    hint: "In production, attach an LLM API key for instant translation"
  });
});

// SPA fallback
app.get("/order/:shopId", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "order.html"));
});

app.get("/admin/:shopId", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(PORT, () => {
  console.log(`SuriOrder running on http://localhost:${PORT}`);
  console.log(`Demo order page: http://localhost:${PORT}/order/demo`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/demo`);
});
