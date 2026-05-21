// WhatsApp webhook route — receives incoming messages and status updates
const crypto = require("crypto");
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
    // Verify X-Hub-Signature-256 when app secret is configured
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const signature = req.headers["x-hub-signature-256"];
      if (!signature) return res.status(403).json({ error: "missing signature" });
      const hmac = crypto.createHmac("sha256", appSecret);
      hmac.update(req.rawBody || JSON.stringify(req.body));
      const expected = "sha256=" + hmac.digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(403).json({ error: "invalid signature" });
      }
    }
    const events = processIncoming(req.body);

    for (const ev of events) {
      if (ev.type === "text" && ev.from && ev.text) {
        // Check if message is from a known restaurant (normalize phone for exact match)
        const normalizedFrom = ev.from.replace(/\D/g, '');
        const shops = db.prepare("SELECT id, whatsapp_number FROM shops WHERE active=1").all();
        const shop = shops.find(s => s.whatsapp_number.replace(/\D/g, '') === normalizedFrom);
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
