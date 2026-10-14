# GharBox

A smarter way to care for home. A working, database-backed MVP for household grocery planning and care-box operations. **Not production-ready:** payment, carrier, import approval, automated billing, email/SMS and external AI are not connected.

**New: household-first intelligence.** Start with **Your pantry guides** for a resumable requirements interview with Maya & Arjun in animated Nepali attire. Product/quantity suggestions remain separate until the buyer approves selected items. **Discover Nepal** automatically fetches and categorizes source-linked product photos. **Catalogue Studio** adds admin photo uploads, sourced product review/import and ingredient verification. Optional model conversation has a gateway adapter, but requires provider credentials and user consent; the default runs private guided rules. See [the intelligence guide](docs/INTELLIGENCE.md) for API contracts, data sources, licensing and exact implementation limits.

## Run locally

Requires Node.js 24 (uses built-in `node:sqlite`).

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3001. Create an account with a password of at least 12 characters. No default accounts or passwords are shipped. For admin access set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` in `.env.local`, restart, then sign in. Never commit that file. Existing account roles are never automatically elevated by environment configuration.

## End-to-end demonstration

1. Register → complete Your pantry guides: household, recipient, food preferences, buying challenges and pantry packs. Prices are synthetic NPR examples.
2. Generate suggestions → review explanations, uncheck unwanted products, adjust quantities, then explicitly approve choices for your basket. Draft choices persist separately.
3. My boxes → inspect dimension-based carton placements and sample billable weights; play, pause or replay the illustrative animation.
4. Approve sample order. `ENABLE_SAMPLE_ORDERS=true` permits this local demonstration; no money is collected. Repeated requests with the same idempotency UUID return the same order.
5. Product requests → submit a product. Subscription controls save manual planning preferences; no recurring job runs.
6. Admin → edit products/stock, destination rules and requests. Advance order status one step at a time. Customer Orders and notifications reflect the saved state.

Changing the recipient destination away from Nepal changes sample carton limits/currency but blocks order approval. Market-specific prices, tax, payment and route eligibility must be approved before overseas ordering is enabled. Synthetic price numbers must not be interpreted as actual retail or carrier offers.

## Verify

```powershell
npm test
npm run typecheck
npm run build
```

Integration smoke checks are in `scripts/smoke.mjs`; run a local server then `node scripts/smoke.mjs`. Uses an isolated new customer and creates sample records, so use a development database. Browser accessibility and complete end-to-end automation remain release gates.

## Delivered and deferred

Working: responsive customer app and admin, registration/session login/logout, server-enforced customer ownership/admin access, persisted household records and basket, searchable seeded catalogue, conservative explainable forecast, stock/budget/vegan filters, six-orientation 3D guillotine packing, configurable countries and carton/rating rules, sample transactional orders with stock deduction/idempotency, order history/reorder, manual order state machine, request review, subscription preference controls, in-app notifications, admin audit trail.

Illustrative: packing preview, synthetic prices/rates and manual sample fulfilment statuses. Discovery uses attributed real photographs; legacy catalogue items await admin photos. Quantity forecasting is deterministic starter logic. Optional model conversation requires gateway configuration. All 27 EU countries and GCC countries are separate seeded destinations; their operational rules require review. The seed is a development data fixture.

Pending: PostgreSQL/Prisma migration; independent household selection and household-specific baskets (current basket uses most recently created household); historical consumption learning and expiry modelling; live payments/refunds/webhooks/reconciliation; real carrier ratings/labels/tracking; approved product-level compliance rules; taxes/duties; confirmed barcode/carton warehouse events; role matrix beyond customer/admin; lot/expiry/recall and supplier workflows; festival calendar/campaign administration; live AI provider validation; background subscription billing/reminders; email/SMS/address validation; coupons; CSV imports/exports; account export/deletion; password reset/MFA; comprehensive automated security/accessibility/browser testing. Recipient sharing is not enabled.

See [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), and [operations/deployment](docs/OPERATIONS.md). The database migration and repeatable seed run in `lib/db.ts`; no migration-capable production ORM is claimed.

Run `npm run test:integration` after a successful production build to verify customer/admin workflows against an isolated temporary database. Test-only admin credentials are generated in memory; no default password is stored.


