const QRCode = require("qrcode");

function registerShopRoutes(app, db) {

  // Public: shop menu
  app.get("/api/shop/:shopId", (req, res) => {
    const shop = db.prepare("SELECT id, name, phone, language, welcome_msg, whatsapp_number, bank_name, bank_account, bank_account_name FROM shops WHERE id=? AND active=1").get(req.params.shopId);
    if (!shop) return res.status(404).json({ error: "shop not found" });
    const cats = db.prepare("SELECT * FROM categories WHERE shop_id=? ORDER BY sort_order").all(shop.id);
    const items = db.prepare("SELECT * FROM items WHERE shop_id=? AND available=1 ORDER BY sort_order").all(shop.id);
    res.json({ shop, categories: cats, items });
  });

  // Public: menu share link
  app.get("/api/shop/:shopId/menu-link", (req, res) => {
    const shop = db.prepare("SELECT id, name FROM shops WHERE id=? AND active=1").get(req.params.shopId);
    if (!shop) return res.status(404).json({ error: "not found" });
    const link = `${req.appBaseUrl}/order/${shop.id}`;
    const waLink = `https://wa.me/?text=${encodeURIComponent(shop.name + " - Bestel nu: " + link)}`;
    res.json({ link, wa_link: waLink });
  });

  // Public: QR code
  app.get("/api/shop/:shopId/qr", async (req, res) => {
    const shop = db.prepare("SELECT id, name FROM shops WHERE id=? AND active=1").get(req.params.shopId);
    if (!shop) return res.status(404).json({ error: "not found" });
    const url = `${req.appBaseUrl}/order/${shop.id}`;
    try {
      const png = await QRCode.toBuffer(url, { width: 300, margin: 2, color: { dark: "#16a34a", light: "#ffffff" } });
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=86400");
      res.send(png);
    } catch { res.status(500).json({ error: "qr generation failed" }); }
  });

  // Public: WhatsApp direct order link
  app.get("/api/shop/:shopId/whatsapp-order", (req, res) => {
    const shop = db.prepare("SELECT id, name, whatsapp_number, language FROM shops WHERE id=? AND active=1").get(req.params.shopId);
    if (!shop) return res.status(404).json({ error: "not found" });
    const menuUrl = `${req.appBaseUrl}/order/${shop.id}`;
    const text = `Hi! I'd like to order from ${shop.name}:\n[list your items]\n\nName:\nPickup time:\n\nMenu: ${menuUrl}`;
    const waNumber = shop.whatsapp_number || "";
    const waLink = waNumber
      ? `https://wa.me/${waNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(shop.name + " - " + menuUrl)}`;
    res.json({ wa_link: waLink, menu_link: menuUrl });
  });

  // Public: active shop listing
  app.get("/api/shops", (req, res) => {
    const { search, lang } = req.query;
    let sql = "SELECT id, name, phone, language, welcome_msg, whatsapp_number FROM shops WHERE active=1";
    const params = [];
    if (search) { sql += " AND name LIKE ?"; params.push(`%${search}%`); }
    if (lang) { sql += " AND language=?"; params.push(lang); }
    sql += " ORDER BY created_at DESC LIMIT 50";
    const shops = db.prepare(sql).all(...params);
    res.json(shops.map(s => ({ ...s, menu_link: `${req.appBaseUrl}/order/${s.id}` })));
  });
}

module.exports = { registerShopRoutes };
