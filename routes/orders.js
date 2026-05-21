const crypto = require("crypto");
const logger = require("../lib/logger");
const { sanitizeName } = require("../lib/sanitize");

function registerOrderRoutes(app, db, { auth, orderLimiter }) {

  // Public: place order
  app.post("/api/order", orderLimiter, (req, res) => {
    const { shop_id, customer_phone, items, note, pickup_time, dining_option } = req.body;
    const customer_name = sanitizeName(req.body.customer_name);
    if (!shop_id || !customer_name || !customer_phone || !items || !items.length) return res.status(400).json({ error: "missing fields" });
    if (!/^\+?597\d{6,7}$/.test(customer_phone)) return res.status(400).json({ error: "invalid phone" });
    if (!Array.isArray(items) || items.length > 50) return res.status(400).json({ error: "too many items" });
    const diningOption = dining_option || 'takeaway';
    if (!['dine_in', 'takeaway'].includes(diningOption)) return res.status(400).json({ error: "invalid dining_option" });
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
      const qty = parseInt(oi.qty);
      if (!Number.isFinite(qty) || qty < 1 || qty > 999) return res.status(400).json({ error: "invalid quantity" });
      total += dbi.price * qty;
      orderItems.push({ id: dbi.id, name: dbi.name, price: dbi.price, qty });
    }

    const validPaymentMethods = ["cod", "bank_transfer"];
    const paymentMethod = validPaymentMethods.includes(req.body.payment_method) ? req.body.payment_method : "cod";

    const orderId = crypto.randomBytes(4).toString("hex");
    db.prepare("INSERT INTO orders (id, shop_id, customer_name, customer_phone, items_json, total, note, pickup_time, dining_option, payment_method) VALUES (?,?,?,?,?,?,?,?,?,?)").run(orderId, shop_id, customer_name, customer_phone, JSON.stringify(orderItems), total, note || null, pickup_time || null, diningOption, paymentMethod);

    const events = require("../lib/events");
    events.emit("new-order", {
      id: orderId, shop_id, customer_name, customer_phone,
      items: orderItems, total, note: note || null,
      pickup_time: pickup_time || null, status: "pending",
      payment_method: paymentMethod, payment_status: "unpaid",
      dining_option: diningOption,
      created_at: new Date().toISOString(),
    });

    res.json({ order_id: orderId, total, items: orderItems, payment_method: paymentMethod });

    // WhatsApp notifications (fire-and-forget)
    const wa = require("../lib/whatsapp");
    wa.notifyMerchantNewOrder(shop.whatsapp_number, {
      order_id: orderId,
      customer_name,
      customer_phone,
      items: orderItems,
      total,
      payment_method: paymentMethod,
      pickup_time: pickup_time || null,
      note: note || null,
      dining_option: diningOption,
    });
    wa.sendCustomerConfirmation(customer_phone, {
      order_id: orderId, total, payment_method: paymentMethod, pickup_time: pickup_time || null,
    }, shop.name);
  });


  // Public: append items to existing order (Pizza Hut style add-to-order)
  app.put('/api/order/:id/append', orderLimiter, (req, res) => {
    const { items, note } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'missing items' });
    if (!Array.isArray(items) || items.length > 50) return res.status(400).json({ error: 'too many items' });

    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'order is already being prepared, cannot append' });

    const shop = db.prepare('SELECT * FROM shops WHERE id=? AND active=1').get(order.shop_id);
    if (!shop) return res.status(404).json({ error: 'shop not found' });

    let existingItems;
    try { existingItems = JSON.parse(order.items_json); } catch (_) { existingItems = []; }

    let appendTotal = 0;
    const appendItems = [];
    for (const oi of items) {
      const dbi = db.prepare('SELECT * FROM items WHERE id=? AND shop_id=?').get(oi.id, order.shop_id);
      if (!dbi) return res.status(400).json({ error: 'item ' + oi.id + ' not found' });
      const qty = parseInt(oi.qty);
      if (!Number.isFinite(qty) || qty < 1 || qty > 999) return res.status(400).json({ error: 'invalid quantity' });
      appendTotal += dbi.price * qty;
      appendItems.push({ id: dbi.id, name: dbi.name, price: dbi.price, qty });
    }

    // Merge: same item increments qty, new item pushes
    const merged = existingItems.slice();
    appendItems.forEach(ai => {
      const exist = merged.find(m => m.id === ai.id);
      if (exist) { exist.qty += ai.qty; }
      else { merged.push(ai); }
    });
    const newTotal = merged.reduce((sum, mi) => sum + mi.price * mi.qty, 0);

    db.prepare('UPDATE orders SET items_json=?, total=?, note=CASE WHEN ? IS NOT NULL THEN ? ELSE note END WHERE id=?')
      .run(JSON.stringify(merged), newTotal, note || null, note || null, req.params.id);

    const events = require('../lib/events');
    events.emit('order-updated', {
      id: order.id, shop_id: order.shop_id,
      items: merged, total: newTotal,
      status: order.status, payment_method: order.payment_method,
      payment_status: order.payment_status, dining_option: order.dining_option,
      customer_name: order.customer_name, customer_phone: order.customer_phone,
      note: note !== undefined ? note : order.note,
      pickup_time: order.pickup_time,
      created_at: order.created_at,
    });

    res.json({ order_id: order.id, total: newTotal, items: merged, payment_method: order.payment_method });

    // WhatsApp: notify merchant about appended items
    const wa = require('../lib/whatsapp');
    wa.notifyMerchantNewOrder(shop.whatsapp_number, {
      order_id: order.id, customer_name: order.customer_name,
      customer_phone: order.customer_phone, items: merged, total: newTotal,
      payment_method: order.payment_method, pickup_time: order.pickup_time,
      note: note !== undefined ? note : order.note,
      dining_option: order.dining_option, is_append: true,
    });
  });

  // Admin: orders list
  app.get("/api/admin/orders", auth, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const orders = db.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM orders o2
         WHERE o2.shop_id=o.shop_id
           AND o2.customer_phone=o.customer_phone
           AND o2.created_at < o.created_at
        ) as prev_orders
      FROM orders o
      WHERE o.shop_id=?
      ORDER BY o.created_at DESC LIMIT ?
    `).all(req.shopId, limit);
    res.json(orders);
  });

  // Admin: update order status / payment
  app.put("/api/admin/orders/:id", auth, (req, res) => {
    const { status, payment_status, payment_note } = req.body;
    let changes = 0;
    if (status) {
      const validStatuses = ["pending", "confirmed", "done", "cancelled"];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: "invalid status" });
      changes += db.prepare("UPDATE orders SET status=? WHERE id=? AND shop_id=?").run(status, req.params.id, req.shopId).changes;
    }
    if (payment_status) {
      const validPaymentStatuses = ["unpaid", "paid", "refunded"];
      if (!validPaymentStatuses.includes(payment_status)) return res.status(400).json({ error: "invalid payment_status" });
      changes += db.prepare("UPDATE orders SET payment_status=? WHERE id=? AND shop_id=?").run(payment_status, req.params.id, req.shopId).changes;
    }
    if (payment_note !== undefined) {
      changes += db.prepare("UPDATE orders SET payment_note=? WHERE id=? AND shop_id=?").run(payment_note, req.params.id, req.shopId).changes;
    }
    if (changes === 0) return res.status(404).json({ error: "order not found" });
    res.json({ ok: true });
  });
}

module.exports = { registerOrderRoutes };
