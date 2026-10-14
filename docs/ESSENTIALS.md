# Essentials-first catalogue and household planning

This update adds migration 003 with 10 editable categories, 44 editable commodities, product-to-commodity assignments, unit quantities, archive controls, private supplier costs, price history, supplier price proposals, accepted basket prices and private pantry levels. Migration runs atomically against local SQLite or persistent Turso; it preserves existing accounts, products, prices and orders. The original synthetic catalogue remains explicitly labeled until operators replace it with approved inventory and prices. No invented stock, supplier or price has been added for missing commodities.

## Customer experience

Home shows essential aisles first; each opens its filtered product catalogue. My pantry lets customers report full or half packs, inspect commodity coverage and explore three familiar meal templates. Pantry edits update their saved household answers; generating a new plan remains an explicit action. Meal ideas are fixed templates with pantry/availability checks, not verified recipes, nutrition advice or generative AI.

The registration interview asks which commodities the household uses. An empty selection uses the essential catalogue; exclusions and dietary/allergen checks remain hard filters. Snacks are excluded from suggestions unless explicitly enabled. Essentials receive budget priority and only one brand/pack per commodity is suggested, preventing duplicate consumption estimates. Manual product choices remain available. Quantity learning from purchase history is still future work.

## Administrator workflow

Sign in using a privately provisioned admin account, then open Operations dashboard → The essentials control room. Create/edit category names in English/Nepali, essential status, order and visibility. Create/edit commodities and their parent categories. IDs are stable references: renaming means editing the name, not changing its ID. Archive rather than delete. Archiving a category hides all its commodities/products; archived basket items prevent sample order approval.

The product form manages pack labels, units, stock, price, supplier cost, dimensions, consumption assumptions and archive status. Save a new product, then add the exact product photograph in Catalogue Studio. Product creation, details and pricing are separate API calls; partial failures show an error and may require retrying the remaining step. Supplier costs and invoice reasons are admin-only; public catalogue/recommendations omit them.

Supplier updates can be pasted as `productId,sellingPriceNPR,costNPR,source`, one row per existing SKU, without headers/quoted commas, up to 50 rows. Import creates proposals; it never changes selling prices. Approve/reject each proposal; approval records old/new price and source. This is an operator-driven supplier feed import. There is no contracted live supplier API, scheduled price updater, autonomous margin optimization, market-specific price list or automatic currency conversion configured.

Saved baskets compare current prices against the buyer's accepted prices. Changes are displayed and require explicit acceptance before sample ordering. Approval of a stale recommendation price is rejected until the buyer regenerates/reviews suggestions. Confirmed order snapshots retain their original totals.

## Discovery

Discovery searches six staple commodity tags from the editable rice, masoor, mustard-oil, spices, atta and tea records, restricted to Nepal-market source records. It caches the refresh attempt for 24 hours and restricts admin refreshes to one per minute. Source failures retain previous data. Conservative name matching demotes snacks, cereal treats, juices and ambiguous records; uncertain records remain optional. Matching is a starter rule, not proof of product identity, origin, availability or ingredient suitability.

Open Food Facts returned HTTP 503 during local verification of the new targeted queries. The application correctly kept cached records and exposed source-unavailable status. A sparse or unavailable public feed must be supplemented with approved supplier records and photos. Missing staples appear as catalogue gaps; they never become fictional sellable packs. Existing ODbL/CC BY-SA attribution remains in the discovery UI and intelligence documentation.

## API additions

- Public `GET /api/catalog`: active products plus editable category/commodity taxonomy.
- Private `GET/POST /api/pantry`: owned pantry coverage and pack updates.
- Private `POST /api/basket/accept-prices`: explicitly accept current basket prices.
- Admin `GET /api/admin/catalogue`: complete catalogue, taxonomy, private costs, recent price history and pending proposals.
- Admin `POST /api/admin/categories`, `/commodities`, `/product-details`, `/pricing`, `/price-feed`, `/price-review`: validated and audited mutations.

Automated verification covers taxonomy, pack reassignment, archives, private costs, proposal review/history, pantry persistence, stale recommendation rejection and price-change acceptance, alongside the existing order/session/ownership tests. Production payment, carrier, compliance, account recovery and distributed abuse-control gates remain unchanged.
