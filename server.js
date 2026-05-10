const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const db = new Database("data/suriorder.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ──
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

// ── Shop routes ──
app.post("/api/shops", (req, res) => {
  const { name, phone, language, admin_pin, whatsapp_number } = req.body;
  if (!name || !admin_pin) return res.status(400).json({ error: "name and admin_pin required" });
  const id = crypto.randomBytes(6).toString("hex");
  db.prepare("INSERT INTO shops (id, name, phone, language, admin_pin, whatsapp_number) VALUES (?,?,?,?,?,?)").run(id, name, phone, language || "nl", admin_pin, whatsapp_number);
  res.json({ id, name });
});

app.post("/api/login", (req, res) => {
  const { shop_id, admin_pin } = req.body;
  const shop = db.prepare("SELECT * FROM shops WHERE id=? AND admin_pin=?").get(shop_id, admin_pin);
  if (!shop) return res.status(401).json({ error: "invalid credentials" });
  res.json({ token: shop.id, shop });
});

// ── Menu routes (public) ──
app.get("/api/shop/:shopId", (req, res) => {
  const shop = db.prepare("SELECT id, name, phone, language, welcome_msg, whatsapp_number FROM shops WHERE id=? AND active=1").get(req.params.shopId);
  if (!shop) return res.status(404).json({ error: "shop not found" });
  const cats = db.prepare("SELECT * FROM categories WHERE shop_id=? ORDER BY sort_order").all(shop.id);
  const items = db.prepare("SELECT * FROM items WHERE shop_id=? AND available=1 ORDER BY sort_order").all(shop.id);
  res.json({ shop, categories: cats, items });
});

app.get("/api/shop/:shopId/menu-link", (req, res) => {
  const shop = db.prepare("SELECT id, name FROM shops WHERE id=? AND active=1").get(req.params.shopId);
  if (!shop) return res.status(404).json({ error: "not found" });
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const link = `${baseUrl}/order/${shop.id}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(shop.name + " - Bestel nu: " + link)}`;
  res.json({ link, wa_link: waLink });
});

// ── Admin routes (requires shop_id header) ──
function auth(req, res, next) {
  const shopId = req.headers["x-shop-id"];
  if (!shopId) return res.status(401).json({ error: "unauthorized" });
  req.shopId = shopId;
  next();
}

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

app.get("/api/admin/orders", auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const orders = db.prepare("SELECT * FROM orders WHERE shop_id=? ORDER BY created_at DESC LIMIT ?").all(req.shopId, limit);
  res.json(orders);
});

app.put("/api/admin/orders/:id", auth, (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE orders SET status=? WHERE id=? AND shop_id=?").run(status, req.params.id, req.shopId);
  res.json({ ok: true });
});

app.get("/api/admin/items", auth, (req, res) => {
  const items = db.prepare(`
    SELECT i.*, c.name as category_name FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    WHERE i.shop_id=? ORDER BY c.sort_order, i.sort_order
  `).all(req.shopId);
  res.json(items);
});

app.post("/api/admin/items", auth, (req, res) => {
  const { name, name_zh, name_en, desc, desc_zh, desc_en, price, category_id, image_url } = req.body;
  if (!name || !price) return res.status(400).json({ error: "name and price required" });
  db.prepare("INSERT INTO items (shop_id, category_id, name, name_zh, name_en, desc, desc_zh, desc_en, price, image_url) VALUES (?,?,?,?,?,?,?,?,?,?)").run(req.shopId, category_id, name, name_zh, name_en, desc, desc_zh, desc_en, price, image_url);
  res.json({ ok: true });
});

app.put("/api/admin/items/:id", auth, (req, res) => {
  const { name, name_zh, name_en, desc, desc_zh, desc_en, price, available, category_id, image_url } = req.body;
  db.prepare("UPDATE items SET name=?, name_zh=?, name_en=?, desc=?, desc_zh=?, desc_en=?, price=?, available=?, category_id=?, image_url=? WHERE id=? AND shop_id=?").run(name, name_zh, name_en, desc, desc_zh, desc_en, price, available ?? 1, category_id, image_url, req.params.id, req.shopId);
  res.json({ ok: true });
});

app.delete("/api/admin/items/:id", auth, (req, res) => {
  db.prepare("DELETE FROM items WHERE id=? AND shop_id=?").run(req.params.id, req.shopId);
  res.json({ ok: true });
});

// ── Categories ──
app.get("/api/admin/categories", auth, (req, res) => {
  res.json(db.prepare("SELECT * FROM categories WHERE shop_id=? ORDER BY sort_order").all(req.shopId));
});

app.post("/api/admin/categories", auth, (req, res) => {
  const { name, name_zh, name_en } = req.body;
  db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en) VALUES (?,?,?,?)").run(req.shopId, name, name_zh, name_en);
  res.json({ ok: true });
});

// ── Order (public) ──
app.post("/api/order", (req, res) => {
  const { shop_id, customer_name, customer_phone, items, note, pickup_time } = req.body;
  if (!shop_id || !customer_name || !items || !items.length) return res.status(400).json({ error: "missing fields" });
  const shop = db.prepare("SELECT * FROM shops WHERE id=?").get(shop_id);
  if (!shop) return res.status(404).json({ error: "shop not found" });

  const ids = items.map(i => i.id);
  const dbItems = db.prepare(`SELECT * FROM items WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids);
  let total = 0;
  const orderItems = items.map(oi => {
    const dbi = dbItems.find(d => d.id === oi.id);
    if (!dbi) throw new Error(`item ${oi.id} not found`);
    total += dbi.price * (oi.qty || 1);
    return { id: dbi.id, name: dbi.name, price: dbi.price, qty: oi.qty || 1 };
  });

  const orderId = crypto.randomBytes(4).toString("hex");
  db.prepare("INSERT INTO orders (id, shop_id, customer_name, customer_phone, items_json, total, note, pickup_time) VALUES (?,?,?,?,?,?,?,?)").run(orderId, shop_id, customer_name, customer_phone, JSON.stringify(orderItems), total, note, pickup_time);

  res.json({ order_id: orderId, total, items: orderItems });
});

// ── AI translate helper (multi-lang menu) ──
app.post("/api/translate", auth, (req, res) => {
  const { text, from, to } = req.body;
  // Simple prompt for AI translation — in production call Claude/OpenAI API
  // For MVP, returns a template the user can fill
  res.json({
    original: text,
    suggestion: `[${to.toUpperCase()}] ${text} [AI翻译待接入 - 当前请手动填写]`,
    hint: "In production, this endpoint calls an LLM API for instant translation"
  });
});

// ── SPA fallback ──
app.get("/order/:shopId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "order.html"));
});

app.get("/admin/:shopId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`SuriOrder running on http://localhost:${PORT}`);
  console.log(`Demo order page: http://localhost:${PORT}/order/demo`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/demo`);
});
