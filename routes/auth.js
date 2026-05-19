const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sanitizeName, sanitizeText } = require("../lib/sanitize");

const validLangs = ["nl", "en", "zh", "es"];

function registerAuthRoutes(app, db, { JWT_SECRET, auth, loginLimiter }) {

  // Shop creation
  app.post("/api/shops", (req, res) => {
    const { name, phone, language, admin_pin, whatsapp_number } = req.body;
    if (!name || !admin_pin) return res.status(400).json({ error: "name and admin_pin required" });
    if (admin_pin.length < 4) return res.status(400).json({ error: "PIN must be at least 4 characters" });
    const id = crypto.randomBytes(6).toString("hex");
    const lang = validLangs.includes(language) ? language : "nl";
    const hash = bcrypt.hashSync(admin_pin, 10);
    db.prepare("INSERT INTO shops (id, name, phone, language, admin_pin, whatsapp_number) VALUES (?,?,?,?,?,?)").run(id, sanitizeName(name), sanitizeName(phone), lang, hash, sanitizeName(whatsapp_number));
    const token = jwt.sign({ shopId: id }, JWT_SECRET, { expiresIn: "7d" });
    const created = db.prepare("SELECT * FROM shops WHERE id=?").get(id);
    const { admin_pin: _, ...safeShop } = created;
    res.json({ id, name, token, shop: safeShop });
  });

  // Login
  app.post("/api/login", loginLimiter, (req, res) => {
    const { shop_id, admin_pin } = req.body;
    if (!shop_id || !admin_pin) return res.status(400).json({ error: "shop_id and admin_pin required" });
    const shop = db.prepare("SELECT * FROM shops WHERE id=?").get(shop_id);
    if (!shop) return res.status(401).json({ error: "invalid credentials" });
    const valid = bcrypt.compareSync(admin_pin, shop.admin_pin);
    if (!valid) return res.status(401).json({ error: "invalid credentials" });
    const token = jwt.sign({ shopId: shop.id }, JWT_SECRET, { expiresIn: "7d" });
    const { admin_pin: _, ...safeShop } = shop;
    res.json({ token, shop: safeShop });
  });

  // Setup wizard
  app.post("/api/shops/:id/setup", auth, (req, res) => {
    if (req.shopId !== req.params.id) return res.status(403).json({ error: "forbidden" });
    const { welcome_msg, whatsapp_number, language, categories, menu_items } = req.body;
    if (language && validLangs.includes(language)) {
      db.prepare("UPDATE shops SET language=? WHERE id=?").run(language, req.shopId);
    }
    if (welcome_msg !== undefined) {
      db.prepare("UPDATE shops SET welcome_msg=? WHERE id=?").run(sanitizeText(welcome_msg), req.shopId);
    }
    if (whatsapp_number !== undefined) {
      db.prepare("UPDATE shops SET whatsapp_number=? WHERE id=?").run(sanitizeName(whatsapp_number), req.shopId);
    }
    if (Array.isArray(categories)) {
      const insCat = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_es) VALUES (?,?,?,?,?)");
      for (const c of categories) {
        if (c.name) insCat.run(req.shopId, sanitizeName(c.name), sanitizeName(c.name_zh), sanitizeName(c.name_en), sanitizeName(c.name_es));
      }
    }
    if (Array.isArray(menu_items)) {
      const insItem = db.prepare("INSERT INTO items (shop_id, category_id, name, name_zh, name_en, name_es, price) VALUES (?,?,?,?,?,?,?)");
      for (const i of menu_items) {
        if (i.name && i.price != null) insItem.run(req.shopId, i.category_id || null, sanitizeName(i.name), sanitizeName(i.name_zh), sanitizeName(i.name_en), sanitizeName(i.name_es), i.price);
      }
    }
    db.prepare("UPDATE shops SET wizard_complete=1 WHERE id=?").run(req.shopId);
    res.json({ ok: true, menu_link: `${req.appBaseUrl}/order/${req.shopId}` });
  });

  // Delete account and all associated data
  app.delete("/api/shops/:id", auth, (req, res) => {
    if (req.shopId !== req.params.id) return res.status(403).json({ error: "forbidden" });
    db.prepare("DELETE FROM orders WHERE shop_id=?").run(req.shopId);
    db.prepare("DELETE FROM items WHERE shop_id=?").run(req.shopId);
    db.prepare("DELETE FROM categories WHERE shop_id=?").run(req.shopId);
    db.prepare("DELETE FROM shops WHERE id=?").run(req.shopId);
    res.json({ ok: true });
  });

  // Translate helper (disabled — requires LLM API key)
  app.post("/api/translate", auth, (req, res) => {
    res.status(501).json({ error: "translation not available", hint: "configure an LLM API key to enable" });
  });
}

module.exports = { registerAuthRoutes };
