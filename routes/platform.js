const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const logger = require("../lib/logger");

function registerPlatformRoutes(app, db, { JWT_SECRET, platformAuth, platformLimiter }) {

  // Serve platform page
  app.get("/platform", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "platform.html"));
  });

  // PIN auth → JWT
  app.post("/api/platform/auth", platformLimiter, (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "PIN required" });

    const hashFile = path.join(__dirname, "..", "data", ".owner_pin_hash");
    let hash;
    try {
      hash = fs.readFileSync(hashFile, "utf-8").trim();
    } catch (_) {
      return res.status(500).json({ error: "platform not configured" });
    }

    if (!bcrypt.compareSync(pin, hash)) {
      logger.warn("platform auth failed", { ip: req.ip });
      return res.status(401).json({ error: "invalid PIN" });
    }

    const token = jwt.sign(
      { role: "platform_owner", type: "platform" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    logger.info("platform auth success", { ip: req.ip });
    res.json({ token });
  });

  // Section B: aggregate dashboard stats
  app.get("/api/platform/dashboard", platformAuth, (_req, res) => {
    const totals = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM shops) as totalShops,
        (SELECT COUNT(*) FROM orders) as totalOrders,
        (SELECT COUNT(*) FROM items) as totalItems,
        (SELECT ROUND(AVG(total),2) FROM orders) as avgOrderValue,
        (SELECT COALESCE(SUM(total),0) FROM orders) as totalRevenue
    `).get();

    const daily = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as cnt, SUM(total) as total
      FROM orders WHERE created_at >= datetime('now','-7 days')
      GROUP BY date(created_at) ORDER BY day
    `).all();

    const prevWeek = db.prepare(`
      SELECT COALESCE(SUM(total),0) as revenue, COUNT(*) as orders
      FROM orders WHERE created_at >= datetime('now','-14 days') AND created_at < datetime('now','-7 days')
    `).get();

    const processing = db.prepare(`
      SELECT status, COUNT(*) as cnt FROM orders GROUP BY status
    `).all();

    res.json({ ...totals, daily, prevWeek, processing });
  });

  // Section A: shop table with per-shop stats
  app.get("/api/platform/shops", platformAuth, (_req, res) => {
    const shops = db.prepare(`
      SELECT
        s.id, s.name, s.language, s.cuisine_type, s.region,
        s.active, s.wizard_complete, s.created_at,
        COUNT(DISTINCT i.id) as item_count,
        COUNT(DISTINCT o.id) as order_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.created_at >= datetime('now','-7 days')) as orders_7d,
        MAX(o.created_at) as last_order,
        COALESCE((SELECT SUM(o2.total) FROM orders o2 WHERE o2.shop_id = s.id), 0) as total_revenue
      FROM shops s
      LEFT JOIN items i ON i.shop_id = s.id
      LEFT JOIN orders o ON o.shop_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all();
    res.json(shops);
  });

  // Update shop metadata (active toggle, cuisine_type, region, business_hours)
  app.put("/api/platform/shops/:id", platformAuth, (req, res) => {
    const { active, cuisine_type, region, business_hours } = req.body;
    const fields = [];
    const params = [];

    if (typeof active === "number") { fields.push("active=?"); params.push(active); }
    if (cuisine_type !== undefined) { fields.push("cuisine_type=?"); params.push(cuisine_type); }
    if (region !== undefined) { fields.push("region=?"); params.push(region); }
    if (business_hours !== undefined) { fields.push("business_hours=?"); params.push(business_hours); }

    if (!fields.length) return res.status(400).json({ error: "no fields to update" });

    params.push(req.params.id);
    const result = db.prepare(`UPDATE shops SET ${fields.join(",")} WHERE id=?`).run(...params);
    if (result.changes === 0) return res.status(404).json({ error: "shop not found" });
    res.json({ ok: true });
  });

  // Section C: cross-shop recent orders
  app.get("/api/platform/orders", platformAuth, (req, res) => {
    const { shop_id, status } = req.query;
    let sql = `
      SELECT o.*, s.name as shop_name
      FROM orders o JOIN shops s ON o.shop_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (shop_id) { sql += " AND o.shop_id=?"; params.push(shop_id); }
    if (status) { sql += " AND o.status=?"; params.push(status); }
    sql += " ORDER BY o.created_at DESC LIMIT 50";

    const orders = db.prepare(sql).all(...params);
    res.json(orders);
  });

  // Analytics: top items, hourly distribution, weekly AOV, repeat customers
  app.get("/api/platform/analytics", platformAuth, (_req, res) => {
    // Top 10 most ordered items (across all shops)
    const topItems = db.prepare(`
      SELECT json_extract(j.value, '$.name') as name,
             SUM(json_extract(j.value, '$.qty')) as total_qty,
             SUM(json_extract(j.value, '$.qty') * json_extract(j.value, '$.price')) as revenue,
             COUNT(DISTINCT o.shop_id) as shop_count
      FROM orders o, json_each(o.items_json) j
      WHERE json_valid(o.items_json)
      GROUP BY name ORDER BY total_qty DESC LIMIT 10
    `).all().map(r => ({
      ...r,
      avgPrice: r.total_qty > 0 ? Math.round(r.revenue / r.total_qty) : 0
    }));

    // Hourly order distribution (last 30 days)
    const hourlyDist = db.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
             COUNT(*) as cnt, SUM(total) as total
      FROM orders
      WHERE created_at >= datetime('now','-30 days')
      GROUP BY hour ORDER BY hour
    `).all();

    // Weekly average order value (last 90 days)
    const weeklyAOV = db.prepare(`
      SELECT strftime('%Y-W%W', created_at) as week,
             COUNT(*) as cnt,
             ROUND(AVG(total), 2) as aov,
             SUM(total) as total
      FROM orders
      WHERE created_at >= datetime('now','-90 days')
      GROUP BY week ORDER BY week
    `).all();

    // Repeat customers (same phone ordered >1 time)
    const repeatCustomers = db.prepare(`
      SELECT customer_phone, customer_name, COUNT(*) as order_count,
             SUM(total) as total_spent,
             MAX(created_at) as last_order
      FROM orders
      WHERE customer_phone IS NOT NULL AND customer_phone != ''
      GROUP BY customer_phone HAVING COUNT(*) > 1
      ORDER BY order_count DESC
    `).all();

    // Menu depth per shop
    const menuDepth = db.prepare(`
      SELECT s.id, s.name, COUNT(i.id) as item_count,
             ROUND(AVG(i.price), 2) as avg_price,
             MIN(i.price) as min_price, MAX(i.price) as max_price
      FROM shops s LEFT JOIN items i ON i.shop_id = s.id
      WHERE s.active = 1
      GROUP BY s.id ORDER BY item_count DESC
    `).all();

    res.json({ topItems, hourlyDist, weeklyAOV, repeatCustomers, menuDepth });
  });
}

module.exports = { registerPlatformRoutes };
