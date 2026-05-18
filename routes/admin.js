const validLangs = ["nl", "en", "zh"];
const { sanitizeName, sanitizeText } = require("../lib/sanitize");

function registerAdminRoutes(app, db, { auth }) {

  // Dashboard
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

  // Items list
  app.get("/api/admin/items", auth, (req, res) => {
    const items = db.prepare(`
      SELECT i.*, c.name as category_name FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.shop_id=? ORDER BY c.sort_order, i.sort_order
    `).all(req.shopId);
    res.json(items);
  });

  // Add item
  app.post("/api/admin/items", auth, (req, res) => {
    const { name, name_zh, name_en, name_srn, desc, desc_zh, desc_en, desc_srn, price, category_id, image_url } = req.body;
    if (!name || price == null) return res.status(400).json({ error: "name and price required" });
    if (typeof price !== "number" || price < 0) return res.status(400).json({ error: "invalid price" });
    db.prepare("INSERT INTO items (shop_id, category_id, name, name_zh, name_en, name_srn, desc, desc_zh, desc_en, desc_srn, price, image_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(req.shopId, category_id || null, sanitizeName(name), sanitizeName(name_zh), sanitizeName(name_en), sanitizeName(name_srn), sanitizeText(desc), sanitizeText(desc_zh), sanitizeText(desc_en), sanitizeText(desc_srn), price, image_url || null);
    res.json({ ok: true });
  });

  // Update item
  app.put("/api/admin/items/:id", auth, (req, res) => {
    const { name, name_zh, name_en, name_srn, desc, desc_zh, desc_en, desc_srn, price, available, category_id, image_url } = req.body;
    if (price != null && (typeof price !== "number" || price < 0)) return res.status(400).json({ error: "invalid price" });
    db.prepare(`UPDATE items SET
      name=COALESCE(?,name), name_zh=COALESCE(?,name_zh), name_en=COALESCE(?,name_en), name_srn=COALESCE(?,name_srn),
      desc=COALESCE(?,desc), desc_zh=COALESCE(?,desc_zh), desc_en=COALESCE(?,desc_en), desc_srn=COALESCE(?,desc_srn),
      price=COALESCE(?,price), available=COALESCE(?,available), category_id=COALESCE(?,category_id), image_url=COALESCE(?,image_url)
      WHERE id=? AND shop_id=?`)
    .run(name != null ? sanitizeName(name) : null, name_zh != null ? sanitizeName(name_zh) : null, name_en != null ? sanitizeName(name_en) : null, name_srn != null ? sanitizeName(name_srn) : null,
      desc != null ? sanitizeText(desc) : null, desc_zh != null ? sanitizeText(desc_zh) : null, desc_en != null ? sanitizeText(desc_en) : null, desc_srn != null ? sanitizeText(desc_srn) : null,
      price ?? null, available ?? null, category_id ?? null, image_url ?? null,
      req.params.id, req.shopId);
    res.json({ ok: true });
  });

  // Delete item
  app.delete("/api/admin/items/:id", auth, (req, res) => {
    db.prepare("DELETE FROM items WHERE id=? AND shop_id=?").run(req.params.id, req.shopId);
    res.json({ ok: true });
  });

  // Categories list
  app.get("/api/admin/categories", auth, (req, res) => {
    res.json(db.prepare("SELECT * FROM categories WHERE shop_id=? ORDER BY sort_order").all(req.shopId));
  });

  // Add category
  app.post("/api/admin/categories", auth, (req, res) => {
    const { name, name_zh, name_en, name_srn } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_srn) VALUES (?,?,?,?,?)").run(req.shopId, sanitizeName(name), sanitizeName(name_zh), sanitizeName(name_en), sanitizeName(name_srn));
    res.json({ ok: true });
  });

  // Update shop settings
  app.put("/api/admin/shop", auth, (req, res) => {
    const { welcome_msg, whatsapp_number, language, bank_name, bank_account, bank_account_name } = req.body;
    const fields = [];
    const values = [];
    if (welcome_msg !== undefined) { fields.push("welcome_msg=?"); values.push(sanitizeText(welcome_msg)); }
    if (whatsapp_number !== undefined) { fields.push("whatsapp_number=?"); values.push(sanitizeName(whatsapp_number)); }
    if (language !== undefined && validLangs.includes(language)) { fields.push("language=?"); values.push(language); }
    if (bank_name !== undefined) { fields.push("bank_name=?"); values.push(sanitizeName(bank_name)); }
    if (bank_account !== undefined) { fields.push("bank_account=?"); values.push(sanitizeName(bank_account)); }
    if (bank_account_name !== undefined) { fields.push("bank_account_name=?"); values.push(sanitizeName(bank_account_name)); }
    if (fields.length) {
      values.push(req.shopId);
      db.prepare(`UPDATE shops SET ${fields.join(",")} WHERE id=?`).run(...values);
    }
    res.json({ ok: true });
  });

  // SSE: real-time order events
  app.get("/api/admin/events", auth, (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");

    const events = require("../lib/events");
    const onOrder = (data) => {
      if (data.shop_id === req.shopId) {
        res.write(`event: new-order\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };
    events.on("new-order", onOrder);

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 30000);

    req.on("close", () => {
      events.off("new-order", onOrder);
      clearInterval(heartbeat);
    });
  });
}

module.exports = { registerAdminRoutes };
