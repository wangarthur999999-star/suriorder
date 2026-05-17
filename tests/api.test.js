const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createTestApp, startServer, cleanup, registerAndLogin, authHeaders } = require("./helper");

describe("SuriOrder API", () => {
  let baseUrl, close, tmpDir, shopId, token;

  before(async () => {
    const { app, db, JWT_SECRET, tmpDir: td } = createTestApp();
    tmpDir = td;
    const srv = await startServer(app);
    baseUrl = srv.baseUrl;
    close = srv.close;
    const auth = await registerAndLogin(baseUrl);
    shopId = auth.shopId;
    token = auth.token;
  });

  after(() => {
    close();
    cleanup(tmpDir);
  });

  // ═══════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════
  describe("POST /api/shops (register)", () => {
    it("creates a new shop and returns id + token", async () => {
      const r = await fetch(`${baseUrl}/api/shops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Shop", phone: "+5979999999", language: "en", admin_pin: "9999" }),
      });
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.ok(d.id);
      assert.ok(d.token);
      assert.equal(d.name, "New Shop");
    });

    it("rejects when name is missing", async () => {
      const r = await fetch(`${baseUrl}/api/shops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_pin: "1234" }),
      });
      assert.equal(r.status, 400);
    });

    it("rejects when PIN is missing", async () => {
      const r = await fetch(`${baseUrl}/api/shops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      });
      assert.equal(r.status, 400);
    });

    it("rejects PIN shorter than 4 characters", async () => {
      const r = await fetch(`${baseUrl}/api/shops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", admin_pin: "12" }),
      });
      assert.equal(r.status, 400);
    });

    it("defaults language to nl when invalid", async () => {
      const r = await fetch(`${baseUrl}/api/shops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lang Test", admin_pin: "1234", language: "xx" }),
      });
      // Should still succeed (drops invalid lang silently and uses nl)
      assert.equal(r.status, 200);
    });
  });

  describe("POST /api/login", () => {
    it("returns token and shop data with valid credentials", async () => {
      const r = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, admin_pin: "5678" }),
      });
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.ok(d.token);
      assert.equal(d.shop.id, shopId);
      assert.equal(d.shop.name, "Test Eatery");
      // admin_pin must not leak
      assert.equal(d.shop.admin_pin, undefined);
    });

    it("rejects invalid PIN", async () => {
      const r = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, admin_pin: "wrong" }),
      });
      assert.equal(r.status, 401);
    });

    it("rejects non-existent shop", async () => {
      const r = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: "nonexistent", admin_pin: "1234" }),
      });
      assert.equal(r.status, 401);
    });
  });

  // ═══════════════════════════════════════
  // SHOPS
  // ═══════════════════════════════════════
  describe("GET /api/shop/:id", () => {
    it("returns shop, categories, and available items", async () => {
      const r = await fetch(`${baseUrl}/api/shop/${shopId}`);
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.equal(d.shop.name, "Test Eatery");
      assert.ok(Array.isArray(d.categories));
      assert.ok(Array.isArray(d.items));
    });

    it("returns 404 for inactive/non-existent shop", async () => {
      const r = await fetch(`${baseUrl}/api/shop/nonexistent`);
      assert.equal(r.status, 404);
    });
  });

  describe("GET /api/shops", () => {
    it("lists active shops", async () => {
      const r = await fetch(`${baseUrl}/api/shops`);
      assert.equal(r.status, 200);
      const shops = await r.json();
      assert.ok(shops.length >= 2); // demo + our test shop
      assert.ok(shops.find(s => s.id === shopId));
    });

    it("filters by search query", async () => {
      const r = await fetch(`${baseUrl}/api/shops?search=Test`);
      const shops = await r.json();
      assert.ok(shops.length >= 1);
      assert.ok(shops.every(s => s.name.toLowerCase().includes("test")));
    });

    it("filters by language", async () => {
      const r = await fetch(`${baseUrl}/api/shops?lang=en`);
      const shops = await r.json();
      assert.ok(shops.every(s => s.language === "en"));
    });
  });

  describe("GET /api/shop/:id/menu-link", () => {
    it("returns order link and WhatsApp share link", async () => {
      const r = await fetch(`${baseUrl}/api/shop/${shopId}/menu-link`);
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.ok(d.link.includes(`/order/${shopId}`));
      assert.ok(d.wa_link.includes("wa.me"));
    });
  });

  describe("GET /api/shop/:id/qr", () => {
    it("returns a PNG image", async () => {
      const r = await fetch(`${baseUrl}/api/shop/${shopId}/qr`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("content-type"), "image/png");
      const buf = await r.arrayBuffer();
      assert.ok(buf.byteLength > 100);
    });
  });

  // ═══════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════
  describe("POST /api/order", () => {
    let testItemId;

    before(async () => {
      // Add an item so we can order it
      const r = await fetch(`${baseUrl}/api/admin/items`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ name: "Test Dish", price: 25 }),
      });
      assert.equal(r.status, 200);
      // fetch the item id
      const itemsR = await fetch(`${baseUrl}/api/admin/items`, { headers: authHeaders(token) });
      const items = await itemsR.json();
      testItemId = items[0].id;
    });

    it("places an order with valid data (cash)", async () => {
      const r = await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          customer_name: "John Doe",
          customer_phone: "+5971234567",
          items: [{ id: testItemId, qty: 2 }],
          note: "extra spicy",
          pickup_time: "12:30",
        }),
      });
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.ok(d.order_id);
      assert.equal(d.total, 50);
      assert.equal(d.items[0].qty, 2);
      assert.equal(d.payment_method, "cod");
    });

    it("places an order with bank_transfer payment", async () => {
      const r = await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          customer_name: "Jane Doe",
          customer_phone: "+5977654321",
          items: [{ id: testItemId, qty: 1 }],
          payment_method: "bank_transfer",
        }),
      });
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.equal(d.payment_method, "bank_transfer");
    });

    it("rejects invalid phone format", async () => {
      const r = await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          customer_name: "Bad Phone",
          customer_phone: "not-a-phone",
          items: [{ id: testItemId, qty: 1 }],
        }),
      });
      assert.equal(r.status, 400);
    });

    it("rejects empty items array", async () => {
      const r = await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          customer_name: "No Items",
          customer_phone: "+5971234567",
          items: [],
        }),
      });
      assert.equal(r.status, 400);
    });

    it("rejects non-existent item id", async () => {
      const r = await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          customer_name: "Bad Item",
          customer_phone: "+5971234567",
          items: [{ id: 99999, qty: 1 }],
        }),
      });
      assert.equal(r.status, 400);
    });

    it("rejects shop not found", async () => {
      const r = await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: "nonexistent",
          customer_name: "Ghost",
          customer_phone: "+5971234567",
          items: [{ id: testItemId, qty: 1 }],
        }),
      });
      assert.equal(r.status, 404);
    });

    it("rejects too many items (>50)", async () => {
      const manyItems = Array.from({ length: 51 }, (_, i) => ({ id: testItemId, qty: 1 }));
      const r = await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          customer_name: "Bulk",
          customer_phone: "+5971234567",
          items: manyItems,
        }),
      });
      assert.equal(r.status, 400);
    });
  });

  // ═══════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════
  describe("Admin endpoints (auth required)", () => {
    it("GET /api/admin/dashboard returns stats", async () => {
      const r = await fetch(`${baseUrl}/api/admin/dashboard`, {
        headers: authHeaders(token),
      });
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.ok("ordersToday" in d);
      assert.ok("ordersWeek" in d);
      assert.ok("pending" in d);
      assert.ok(Array.isArray(d.topItems));
    });

    it("GET /api/admin/orders lists orders", async () => {
      const r = await fetch(`${baseUrl}/api/admin/orders`, {
        headers: authHeaders(token),
      });
      assert.equal(r.status, 200);
      const orders = await r.json();
      assert.ok(Array.isArray(orders));
      assert.ok(orders.length >= 2);
      orders.forEach(o => {
        assert.ok(o.id);
        assert.ok(o.customer_name);
        assert.ok("total" in o);
        assert.ok("status" in o);
      });
    });

    it("GET /api/admin/items lists items", async () => {
      const r = await fetch(`${baseUrl}/api/admin/items`, {
        headers: authHeaders(token),
      });
      assert.equal(r.status, 200);
      const items = await r.json();
      assert.ok(items.length >= 1);
      assert.equal(items[0].name, "Test Dish");
    });

    it("POST + DELETE /api/admin/items CRUD cycle", async () => {
      // Add
      const addR = await fetch(`${baseUrl}/api/admin/items`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ name: "Temp Dish", price: 10, name_zh: "临时菜" }),
      });
      assert.equal(addR.status, 200);

      const itemsR = await fetch(`${baseUrl}/api/admin/items`, { headers: authHeaders(token) });
      const items = await itemsR.json();
      const tempItem = items.find(i => i.name === "Temp Dish");
      assert.ok(tempItem);
      assert.equal(tempItem.price, 10);
      assert.equal(tempItem.name_zh, "临时菜");

      // Delete
      const delR = await fetch(`${baseUrl}/api/admin/items/${tempItem.id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      assert.equal(delR.status, 200);

      const itemsAfter = await (await fetch(`${baseUrl}/api/admin/items`, { headers: authHeaders(token) })).json();
      assert.equal(itemsAfter.find(i => i.name === "Temp Dish"), undefined);
    });

    it("GET /api/admin/categories lists categories", async () => {
      // demo shop has categories, but our test shop might not
      const r = await fetch(`${baseUrl}/api/admin/categories`, {
        headers: authHeaders(token),
      });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(await r.json()));
    });

    it("POST /api/admin/categories adds a category", async () => {
      const r = await fetch(`${baseUrl}/api/admin/categories`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ name: "Soups", name_zh: "汤类", name_en: "Soups" }),
      });
      assert.equal(r.status, 200);

      const catsR = await fetch(`${baseUrl}/api/admin/categories`, { headers: authHeaders(token) });
      const cats = await catsR.json();
      assert.ok(cats.find(c => c.name === "Soups"));
    });

    it("PUT /api/admin/shop updates settings", async () => {
      const r = await fetch(`${baseUrl}/api/admin/shop`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          welcome_msg: "Welcome!",
          bank_name: "DSB",
          bank_account: "123456789",
        }),
      });
      assert.equal(r.status, 200);

      const shopR = await fetch(`${baseUrl}/api/shop/${shopId}`);
      const { shop } = await shopR.json();
      assert.equal(shop.welcome_msg, "Welcome!");
      assert.equal(shop.bank_name, "DSB");
    });

    it("PUT /api/admin/orders/:id updates order status", async () => {
      const ordersR = await fetch(`${baseUrl}/api/admin/orders`, { headers: authHeaders(token) });
      const orders = await ordersR.json();
      const orderId = orders[0].id;

      const r = await fetch(`${baseUrl}/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ status: "confirmed" }),
      });
      assert.equal(r.status, 200);

      const ordersAfter = await (await fetch(`${baseUrl}/api/admin/orders`, { headers: authHeaders(token) })).json();
      assert.equal(ordersAfter[0].status, "confirmed");
    });

    it("PUT /api/admin/orders/:id updates payment status", async () => {
      const ordersR = await fetch(`${baseUrl}/api/admin/orders`, { headers: authHeaders(token) });
      const orders = await ordersR.json();
      const orderId = orders[0].id;

      await fetch(`${baseUrl}/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ payment_status: "paid" }),
      });

      const ordersAfter = await (await fetch(`${baseUrl}/api/admin/orders`, { headers: authHeaders(token) })).json();
      assert.equal(ordersAfter[0].payment_status, "paid");
    });
  });

  describe("Unauthenticated admin access", () => {
    it("returns 401 without token", async () => {
      const r = await fetch(`${baseUrl}/api/admin/dashboard`);
      assert.equal(r.status, 401);
    });

    it("returns 401 with invalid token", async () => {
      const r = await fetch(`${baseUrl}/api/admin/dashboard`, {
        headers: { "Authorization": "Bearer invalid-token-here" },
      });
      assert.equal(r.status, 401);
    });

    it("scopes data to token owner's shop only", async () => {
      const r = await fetch(`${baseUrl}/api/admin/orders`, {
        headers: authHeaders(token),
      });
      const orders = await r.json();
      assert.ok(orders.length > 0);
      // Auth middleware sets req.shopId from token — all results must belong to token owner
      assert.ok(orders.every(o => o.shop_id === shopId));
    });
  });

  // ═══════════════════════════════════════
  // SSE
  // ═══════════════════════════════════════
  describe("GET /api/admin/events (SSE)", () => {
    it("returns text/event-stream with correct headers", async () => {
      const r = await fetch(`${baseUrl}/api/admin/events?token=${encodeURIComponent(token)}`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("content-type"), "text/event-stream");
      assert.equal(r.headers.get("cache-control"), "no-cache");
      r.body?.cancel(); // close the stream
    });

    it("streams new-order event when an order is placed", async () => {
      const ac = new AbortController();
      const r = await fetch(`${baseUrl}/api/admin/events?token=${encodeURIComponent(token)}`, {
        signal: ac.signal,
      });
      assert.equal(r.status, 200);

      // Place an order to trigger the event
      const itemsR = await fetch(`${baseUrl}/api/admin/items`, { headers: authHeaders(token) });
      const items = await itemsR.json();
      const itemId = items[0].id;

      const orderR = await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId, customer_name: "SSE Test",
          customer_phone: "+5971234567", items: [{ id: itemId, qty: 1 }],
        }),
      });
      assert.equal(orderR.status, 200);
      const orderData = await orderR.json();

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let eventReceived = false;

      try {
        const result = await Promise.race([
          (async () => {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              if (text.includes("new-order") && text.includes(orderData.order_id)) {
                return true;
              }
            }
            return false;
          })(),
          new Promise((resolve) => setTimeout(() => resolve(false), 4000)),
        ]);
        eventReceived = result;
      } finally {
        ac.abort();
      }

      assert.ok(eventReceived, "SSE should emit new-order event for placed order");
    });

    it("does not send events from other shops", async () => {
      // Register a second shop and get its token
      const regR = await fetch(`${baseUrl}/api/shops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Shop B", admin_pin: "2222" }),
      });
      const { id: shop2Id } = await regR.json();
      const loginR = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shop2Id, admin_pin: "2222" }),
      });
      const { token: token2 } = await loginR.json();

      const ac = new AbortController();
      const r = await fetch(`${baseUrl}/api/admin/events?token=${encodeURIComponent(token2)}`, {
        signal: ac.signal,
      });
      assert.equal(r.status, 200);

      // Place an order for shop1 — should NOT appear in shop2's stream
      const itemsR = await fetch(`${baseUrl}/api/admin/items`, { headers: authHeaders(token) });
      const items = await itemsR.json();
      const itemId = items[0].id;

      await fetch(`${baseUrl}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId, customer_name: "Should Not See",
          customer_phone: "+5971234567", items: [{ id: itemId, qty: 1 }],
        }),
      });

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let leakedEvent = false;

      try {
        const result = await Promise.race([
          (async () => {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              if (text.includes("Should Not See")) return true;
            }
            return false;
          })(),
          new Promise((resolve) => setTimeout(() => resolve(false), 2500)),
        ]);
        leakedEvent = result;
      } finally {
        ac.abort();
      }

      assert.ok(!leakedEvent, "SSE must not leak events across shops");
    });
  });

  // ═══════════════════════════════════════
  // HEALTH
  // ═══════════════════════════════════════
  describe("GET /health", () => {
    it("returns ok with uptime", async () => {
      const r = await fetch(`${baseUrl}/health`);
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.equal(d.status, "ok");
      assert.ok(typeof d.uptime === "number");
    });
  });
});
