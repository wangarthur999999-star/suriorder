# SuriOrder

WhatsApp-first ordering SaaS for Suriname restaurants. Free, multi-tenant, phone-first.

## Tech Stack
- **Backend:** Node.js + Express 4 + better-sqlite3 (WAL mode)
- **Frontend:** Vanilla HTML/CSS/JS — no framework, phone-first design
- **Auth:** JWT (7-day expiry) + bcrypt PIN (cost 10)
- **Multi-tenant:** `req.shopId` from JWT, scoped to every DB query
- **Host:** Render.com free tier (15-min idle cold start)
- **Test:** Node built-in test runner (`node --test`), 40 tests

## Key Files
| File | Purpose |
|------|---------|
| `server.js` | Express app, CSP, middleware stack |
| `db/schema.js` | SQLite schema + migrations + demo seed |
| `routes/auth.js` | Login, register, token refresh |
| `routes/orders.js` | Place order + admin order list/update |
| `routes/admin.js` | Menu CRUD, categories, dashboard stats |
| `routes/shops.js` | Public shop list, QR, menu-link |
| `routes/webhook.js` | WhatsApp Cloud API webhook |
| `public/order.html` | Customer-facing order page |
| `public/admin.html` | Restaurant admin dashboard |
| `lib/whatsapp.js` | WhatsApp Cloud API client |
| `lib/sanitize.js` | XSS sanitization (`sanitizeName`) |
| `lib/events.js` | SSE event emitter for real-time order notifications |

## Current State (2026-05-19)
- **Deployed:** https://suriorder.onrender.com
- **Demo shop:** `demo` / PIN `1234`
- **All 40 tests passing**
- **P0 features done:** sold-out toggle (已售罄标记) + return customer count (熟客统计)
- **CSP:** `script-src 'self' 'unsafe-inline'` (required for inline scripts)
- **Languages:** nl, en, zh, es (Sranan Tongo replaced with Spanish)

## Active Work
- **UI overhaul** — highest priority. User wants to improve visual design before first restaurant trial tomorrow. The current UI is functional but template-looking. New conversation should focus on design quality (see `.claude/rules/ecc/web/design-quality.md`).
- **First restaurant trial** — tomorrow. Wang's Eatery or similar Chinese restaurant.

## Cross-Conversation Workflow
When opening a new conversation for UI work:
1. New conversation reads this CLAUDE.md automatically — full context
2. **Save a memory** at the end of each conversation: what was done, what's pending
3. **Update this CLAUDE.md** if project state changes (new features, new files, new conventions)
4. Use `MEMORY.md` at `~/.claude/projects/C--Users-wanga-OneDrive-Desktop-SuriOrder/memory/` for persistent cross-session notes

## Conventions
- No `console.log` in production — use `lib/logger.js`
- Input validation at boundaries: `sanitizeName()` for names, regex for phones, Zod-like manual checks
- Immutable data patterns preferred
- Small focused files (<400 lines preferred)
- Parameterized SQL only — never string interpolation in queries
- WhatsApp webhook signature verification: `crypto.timingSafeEqual` with length guard
- better-sqlite3 `.changes` for row-exists checks on PUT/DELETE
- Phone format: `/^\+?597\d{6,7}$/`
