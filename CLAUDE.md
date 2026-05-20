# SuriOrder

Free ordering SaaS for Suriname restaurants → data pipeline → B2B catering engine.

**SaaS is not the product. The SaaS is the data entry form.** The real product builds on top: aggregated restaurant supply matched to corporate catering demand (10-15% commission), then own-brand pickup points positioned by consumption data.

## Tech Stack
- **Backend:** Node.js + Express 4 + better-sqlite3 (WAL mode)
- **Frontend:** Vanilla HTML/CSS/JS — no framework, phone-first (375-430px)
- **Auth:** JWT (7d shop / 1h platform) + bcrypt PIN (cost 10)
- **Multi-tenant:** `req.shopId` from JWT, scoped to every DB query
- **Host:** Render.com free tier (15-min idle cold start → ~30s warm-up)
- **Test:** Node built-in test runner (`node --test`), 40 tests

## Key Files
| File | Purpose |
|------|---------|
| `server.js` | Express app, CSP, middleware stack, OWNER_PIN init |
| `db/schema.js` | SQLite schema + migrations + demo seed |
| `routes/auth.js` | Shop login, register, token refresh |
| `routes/orders.js` | Customer place order + admin order list/update |
| `routes/admin.js` | Menu CRUD, categories, dashboard stats |
| `routes/shops.js` | Public shop list, QR, menu-link |
| `routes/webhook.js` | WhatsApp Cloud API webhook (verify + receive) |
| `middleware/auth.js` | Shop JWT — extracts `req.shopId`, rejects if missing |
| `middleware/platformAuth.js` | Platform JWT — requires `role:"platform_owner"` + `type:"platform"` |
| `public/order.html` | Customer order page (bottom tab bar, category filters, cart) |
| `public/admin.html` | Restaurant admin dashboard (menu CRUD, orders, stats) |
| `public/index.html` | Landing page with shop directory |
| `public/platform.html` | Platform owner cross-shop data dashboard |
| `lib/whatsapp.js` | WhatsApp Cloud API client (fire-and-forget) |
| `lib/sanitize.js` | XSS sanitization (`sanitizeName`) |
| `lib/events.js` | SSE event emitter for real-time order notifications |
| `lib/logger.js` | Structured JSON logging |
| `docs/obsidian/` | Product strategy, value prop, cold start, data assets, monetization |

## Business Model (Three-Layer)
1. **SaaS (free forever)** — Give restaurants free ordering software → collect menu data, order data, restaurant relationships. The trade, not the product.
2. **B2B Catering (first revenue)** — Aggregate restaurant supply → match corporate demand → 10-15% commission. Moat = restaurant network, not software.
3. **Own-Brand Pickup (endgame)** — Consumption data decides where/what price point to place food trucks/pickup points. 100% margin.

## Current State (2026-05-20)
- **Deployed:** https://suriorder.onrender.com
- **Demo:** `demo` / PIN `1234` | Platform PIN: auto-generated on first start (see console logs)
- **All 40 tests passing**
- **Platform panel:** `/platform` — cross-shop dashboard with PIN login, 3 sections (shop table, aggregate stats, recent orders), 6 API endpoints
- **Auth hardened:** shop tokens require `type:"shop"`, platform tokens require `role:"platform_owner"` + `type:"platform"` — dual-auth with explicit checks
- **P0 done:** sold-out toggle, return customer count badge, category management, platform data panel
- **CSP:** `script-src 'self' 'unsafe-inline'` (required for inline event handlers)
- **Languages:** nl, en, zh, es
- **Uncommitted:** UI overhaul (Steps 1-4) + platform data panel (Step 5) — 10 files total, ~500 lines
- **Today:** First restaurant trial (Wang's Eatery or similar Chinese restaurant)

## Active Work
- **Smoke test platform panel** — Start server, visit `/platform`, verify PIN login → dashboard renders with demo data
- **Push & deploy** — Commit all changes, push to GitHub, deploy to Render
- **UI overhaul (Steps 1-4)** — Partially implemented. Design tokens upgraded, order.html bottom tab bar done. Remaining: admin.html mobile card layout, index.html polish. Style: "Warm Utility" — cream/off-white, green brand (#16a34a), warm orange accent (#f97316), 14-18px radii.

## Conventions
- No `console.log` in production — use `lib/logger.js`
- Input validation at boundaries: `sanitizeName()` for names, regex for phones
- Immutable data patterns preferred
- Small focused files (<400 lines preferred)
- Parameterized SQL only — never string interpolation in queries
- WhatsApp webhook: `crypto.timingSafeEqual` with length guard
- better-sqlite3 `.changes` for row-exists checks on PUT/DELETE
- Phone format: `/^\+?597\d{6,7}$/`
- **Auth hardening:** Explicitly check `payload.shopId` exists — do NOT rely on SQL NULL comparison
- **Platform auth:** Separate JWT with `role:"platform_owner"` + `type:"platform"`, 1h expiry, sessionStorage only
- **OWNER_PIN:** Auto-generate on first start (like JWT_SECRET), print to console, bcrypt hash persisted to `data/.owner_pin_hash`, overridable via env var
