const crypto = require("crypto");

function registerOrderRoutes(app, db, { auth, orderLimiter }) {

  // Public: place order
  app.post("/api/order", orderLimiter, (req, res) => {
    const { shop_id, customer_name, customer_phone, items, note, pickup_time } = req.body;
    if (!shop_id || !customer_name || !customer_phone || !items || !items.length) return res.status(400).json({ error: "missing fields" });
    if (!/^\+?597\d{7}$/.test(customer_phone)) return res.status(400).json({ error: "invalid phone" });
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

    const validPaymentMethods = ["cod", "bank_transfer"];
    const paymentMethod = validPaymentMethods.includes(req.body.payment_method) ? req.body.payment_method : "cod";

    const orderId = crypto.randomBytes(4).toString("hex");
    db.prepare("INSERT INTO orders (id, shop_id, customer_name, customer_phone, items_json, total, note, pickup_time, payment_method) VALUES (?,?,?,?,?,?,?,?,?)").run(orderId, shop_id, customer_name, customer_phone, JSON.stringify(orderItems), total, note || null, pickup_time || null, paymentMethod);

    res.json({ order_id: orderId, total, items: orderItems, payment_method: paymentMethod });
  });

  // Admin: orders list
  app.get("/api/admin/orders", auth, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const orders = db.prepare("SELECT * FROM orders WHERE shop_id=? ORDER BY created_at DESC LIMIT ?").all(req.shopId, limit);
    res.json(orders);
  });

  // Admin: update order status / payment
  app.put("/api/admin/orders/:id", auth, (req, res) => {
    const { status, payment_status, payment_note } = req.body;
    if (status) {
      const validStatuses = ["pending", "confirmed", "done", "cancelled"];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: "invalid status" });
      db.prepare("UPDATE orders SET status=? WHERE id=? AND shop_id=?").run(status, req.params.id, req.shopId);
    }
    if (payment_status) {
      const validPaymentStatuses = ["unpaid", "paid", "refunded"];
      if (!validPaymentStatuses.includes(payment_status)) return res.status(400).json({ error: "invalid payment_status" });
      db.prepare("UPDATE orders SET payment_status=? WHERE id=? AND shop_id=?").run(payment_status, req.params.id, req.shopId);
    }
    if (payment_note !== undefined) {
      db.prepare("UPDATE orders SET payment_note=? WHERE id=? AND shop_id=?").run(payment_note, req.params.id, req.shopId);
    }
    res.json({ ok: true });
  });
}

module.exports = { registerOrderRoutes };
