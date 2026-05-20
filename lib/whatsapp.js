// WhatsApp Cloud API client (Meta Graph API)
// Requires env vars: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN

const logger = require("./logger");

const API_VERSION = "v22.0";
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

let token, phoneId, verifyToken;
let configured = false;

function init() {
  token = process.env.WHATSAPP_TOKEN;
  phoneId = process.env.WHATSAPP_PHONE_ID;
  verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  configured = !!(token && phoneId);
  if (!configured) {
    if (token || phoneId) {
      logger.warn("whatsapp: both WHATSAPP_TOKEN and WHATSAPP_PHONE_ID must be set");
    }
  }
}

function isConfigured() {
  return configured;
}

// Send a text message (free-form, within 24h customer service window)
async function sendText(to, text) {
  if (!configured) return null;
  return sendMessage(to, { type: "text", text: { body: text } });
}

// Send a template message (requires approved template)
async function sendTemplate(to, templateName, params) {
  if (!configured) return null;
  const components = [];
  if (params && params.length) {
    components.push({
      type: "body",
      parameters: params.map(p => ({ type: "text", text: String(p) })),
    });
  }
  return sendMessage(to, {
    type: "template",
    template: { name: templateName, language: { code: "nl" }, components },
  });
}

async function sendMessage(to, message) {
  if (!configured) return null;
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(to),
    ...message,
  });

  try {
    const r = await fetch(`${API_BASE}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await r.json();
    if (!r.ok) {
      logger.error("whatsapp send error", { response: data });
    }
    return data;
  } catch (err) {
    logger.error("whatsapp send failed", { error: err.message });
    return null;
  }
}

// Verify webhook subscription
function verifyWebhook(mode, challenge, receivedToken) {
  if (mode !== "subscribe") return null;
  if (receivedToken !== verifyToken) return null;
  return challenge;
}

// Process incoming messages from webhook
function processIncoming(body) {
  if (!body.object || body.object !== "whatsapp_business_account") return [];
  const events = [];
  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      for (const msg of (value.messages || [])) {
        events.push({
          from: msg.from,
          type: msg.type,
          text: msg.text ? msg.text.body : null,
          timestamp: msg.timestamp ? Number(msg.timestamp) : Date.now(),
          messageId: msg.id,
        });
      }
      for (const status of (value.statuses || [])) {
        events.push({
          type: "status",
          messageId: status.id,
          status: status.status,
          timestamp: status.timestamp ? Number(status.timestamp) : Date.now(),
        });
      }
    }
  }
  return events;
}

// Send restaurant new-order notification
async function notifyMerchantNewOrder(shopWhatsapp, order) {
  if (!configured || !shopWhatsapp) return;

  const diningLabel = order.dining_option === 'dine_in' ? '🍽 Dine-in' : '🛍 Takeaway';
  const paymentLabel = order.payment_method === 'bank_transfer' ? '🏦 Bankoverschrijving' : '💳 Contant';

  let itemsText = '';
  if (order.items && order.items.length) {
    itemsText = order.items.map(i => `  ${i.qty}x ${i.name} — SRD ${Number(i.price).toFixed(2)}`).join('\n');
  }

  const lines = [
    `🛎 *Nieuwe bestelling #${order.order_id}*`,
    '',
    `👤 ${order.customer_name} — 📞 ${order.customer_phone}`,
  ];

  if (itemsText) {
    lines.push('');
    lines.push(`📦 ${itemsText}`);
  }

  lines.push('');
  lines.push(`💰 Totaal: SRD ${Number(order.total).toFixed(2)}`);

  if (order.pickup_time) {
    lines.push('');
    lines.push(`🕐 Ophalen: ${order.pickup_time}`);
  }

  if (order.dining_option) {
    lines.push('');
    lines.push(diningLabel);
  }

  lines.push('');
  lines.push(paymentLabel);

  if (order.note) {
    lines.push('');
    lines.push(`📝 ${order.note}`);
  }

  const text = lines.join('\n');
  return sendText(shopWhatsapp, text);
}

// Send customer order confirmation
async function sendCustomerConfirmation(customerPhone, order, shopName) {
  if (!configured || !customerPhone) return;
  const text = [
    `✅ *Bedankt voor uw bestelling bij ${shopName}!*`,
    `Bestelling #${order.order_id}`,
    `Totaal: SRD ${Number(order.total).toFixed(2)}`,
    order.pickup_time ? `Ophaaltijd: ${order.pickup_time}` : "",
    order.payment_method === "bank_transfer"
      ? "Betaal a.u.b. via bankoverschrijving."
      : "Betaal contant bij afhalen.",
  ].filter(Boolean).join("\n");
  return sendText(customerPhone, text);
}

function normalizePhone(phone) {
  let n = String(phone).replace(/[^0-9]/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (!n.startsWith("597")) n = "597" + n;
  return n;
}

init();

module.exports = {
  init,
  isConfigured,
  sendText,
  sendTemplate,
  verifyWebhook,
  processIncoming,
  notifyMerchantNewOrder,
  sendCustomerConfirmation,
};
