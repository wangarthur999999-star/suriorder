// WhatsApp webhook route — receives incoming messages and status updates
const { verifyWebhook, processIncoming, sendText } = require("../lib/whatsapp");

function registerWebhookRoute(app, db) {
  // Meta verification (GET)
  app.get("/api/whatsapp/webhook", (req, res) => {
    const challenge = verifyWebhook(
      req.query["hub.mode"],
      req.query["hub.challenge"],
      req.query["hub.verify_token"]
    );
    if (challenge !== null) {
      res.status(200).type("text/plain").send(challenge);
    } else {
      res.status(403).json({ error: "verification failed" });
    }
  });

  // Incoming messages and status updates (POST)
  app.post("/api/whatsapp/webhook", (req, res) => {
    const events = processIncoming(req.body);

    for (const ev of events) {
      if (ev.type === "text" && ev.from && ev.text) {
        // Check if message is from a known restaurant
        const shop = db.prepare(
          "SELECT id FROM shops WHERE whatsapp_number LIKE ? AND active=1"
        ).get(`%${ev.from}%`);
        if (shop) {
          handleMerchantMessage(shop.id, ev.from, ev.text, db);
        }
      }
    }

    res.status(200).send("ok");
  });
}

function handleMerchantMessage(shopId, from, text, db) {
  const lower = text.toLowerCase().trim();

  if (lower === "orders" || lower === "bestellingen" || lower === "订单") {
    const orders = db.prepare(
      "SELECT id, order_id, customer_name, total, status, created_at FROM orders WHERE shop_id=? ORDER BY created_at DESC LIMIT 5"
    ).all(shopId);

    if (!orders.length) {
      sendText(from, "Geen recente bestellingen.");
      return;
    }

    const lines = orders.map(o =>
      `#${o.order_id} — ${o.customer_name} — SRD ${Number(o.total).toFixed(2)} — ${o.status}`
    );
    sendText(from, "*Recente bestellingen:*\n" + lines.join("\n"));
  }
}

module.exports = { registerWebhookRoute };
