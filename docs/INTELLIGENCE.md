# Household-first intelligence — October 2026 update

## What is working

Registration leads directly to a six-step household interview. Existing users can open **Your pantry guides**. Answers and progress persist privately in SQLite, including household composition, recipient, destination, budget, planning period, diet, optional allergies, exclusions, category priorities, brand preferences, buying difficulties, pantry packs, incoming packs, cooking routine, safety stock and optional notes. Users can select Maya or Arjun, animated code-native Nepali guides with reduced-motion support.

Suggestions are separate persisted recommendation drafts. Generating them does **not** change a basket, order or payment. Buyers select products, change quantities and explicitly approve a draft. Draft checkbox and quantity choices are autosaved independently. Only selected products replace the editable basket. Approval revalidates current product availability, exclusions, dietary/allergen filters, budget and the packing calculation. Order approval remains a separate operation.

Formula: starter daily packs per equivalent adult × (adults + 0.6 × children) × (meals at home / 3) × (planning days + safety days) − pantry packs − incoming packs. Round up to packs, then bound by inventory, product budget and request size. Category priorities and preferred brand matches affect ranking. This is an uncertain starter forecast; purchase-history learning is not implemented. Spice preferences, substitute consent and free-text notes are captured for future matching and operational review; no unverified ingredient or spice inference is made.

Known allergies exclude both conflicting products and products with unverified ingredients. Admins review ingredient facts in Catalogue Studio. This does not guarantee allergy safety: buyers must check the current product label. Vegetarian recommendations use the conservative vegan-flag subset until richer product-level dietary evidence is available.

## Automatic discovery and real photos

`GET /api/discover` performs a server-side Open Food Facts structured Nepal-market search, maps source category tags into commodity groups, saves named products with valid photographs and reuses the local cache for 24 hours. This is refresh-on-use, not a background scheduled crawler. Admins can force a refresh, limited to once per minute. Source outages keep the last stored discoveries visible. Missing names/photos are skipped; a failed source is not replaced with fabricated records.

The current development fetch returned 55 photographed records. This count will change with the upstream data. Being listed in Nepal does not establish Nepal manufacture, availability, merchant selling price, supplier approval or import eligibility. Discoveries are kept in a separate table and shown with source links and license attribution. A sourcing request creates an ordinary request for review, never stock or shipment approval.

Catalogue Studio lets admins choose a discovered product and supply actual selling price, stock, pack measurements and consumption assumptions before adding it to the sellable catalogue. Imported products start with conservative dietary status. The source photograph and credit are attached after creation. These are two API calls; if photo attachment fails, the product remains with a visible photo-pending state and the admin should retry the photo step. No upstream price or stock is invented.

Admins can also upload JPEG/PNG/WebP photos up to 2 MB, or supply an HTTPS image URL, credit and source page. File signatures are checked. Uploaded bytes live in the database and are served from `/api/media/:productId`. There is no server-side fetch of arbitrary image URLs. Catalogue, basket and recommendation cards use the actual associated photo. Legacy demonstration products without identity-matched photos show **Product photo pending**, not a generated imitation. Production image processing, dimension limits, malware inspection and object storage remain deployment work.

Open Food Facts records are a separate attributed discovery dataset. Review ODbL share-alike implications before combining licensed datasets or distributing a derived database. Individual contents use the Database Contents License; contributor photos use CC BY-SA and may contain other protected elements. Manufacturer websites are research references, not automatically scraped feeds or licensed image sources.

## Conversation modes

The assistant endpoint saves private messages and provides useful deterministic guidance without an external account. It explains budgeting, pantry deductions, sourcing and delivery limitations. Optional model conversation uses a replaceable HTTPS chat-completions-compatible gateway configured by `AI_GATEWAY_URL`, `AI_GATEWAY_KEY` and `AI_MODEL`. No gateway credentials are shipped or configured by default; live model inference has **not** been verified with a real provider.

External requests require the user's explicit AI consent. Structured context contains only household counts, planning days, priorities, selected shopping challenges, their chat question and safe guidance. Recipient names, addresses, email, private notes and allergy fields are not automatically forwarded. Questions themselves may contain sensitive information, so the UI tells users not to enter it. Provider contractual/privacy review is required before deployment.

Provider responses must parse as a bounded JSON message. Timeouts, HTTP errors and invalid output fall back to grounded rules. Models do not have tools or database mutation privileges and never calculate financials, shipping or final quantities. The provider must support the documented chat-completions JSON response contract; no automatic assumption of provider compatibility is made. Conversation and deterministic financial/eligibility logic remain separate.

## New API contracts

| Route | Method | Body / result |
|---|---|---|
| `/api/discover` | GET | Public cached source records, run status and attribution |
| `/api/onboarding` | GET | Owned interview progress and structured answers |
| `/api/onboarding` | POST | `{step:0..5,complete:boolean,answers:Preferences}`; completion also saves household |
| `/api/recommendations` | GET | Owned persisted draft |
| `/api/recommendations` | POST | Create suggestions from completed preferences; no basket change |
| `/api/recommendations/selection` | POST | `{selected:{productId:quantity}}`; save draft choices without changing basket |
| `/api/recommendations/apply` | POST | `{items:[{productId,quantity}]}`; explicit selected draft approval |
| `/api/assistant` | GET | Private last 30 messages and provider configuration flag |
| `/api/assistant` | POST | `{message}`; bounded response and truthful mode label; 10 questions/minute/account |
| `/api/admin/discovery` | POST | Rate-limited source refresh, audit record |
| `/api/admin/media` | POST | `{productId,imageUrl? or imageData?,credit,sourceUrl?}` |
| `/api/admin/facts` | POST | `{productId,allergens:string[],ingredientsVerified:boolean}` |
| `/api/media/:productId` | GET | Public uploaded photo bytes, content type and cache header |

Migration 002 adds onboarding, drafts, photo assets, ingredient reviews, discoveries, source run status and private assistant history. Private profile/chat data follows the same backup and access controls as accounts. Retention/export/deletion workflows remain a production gate. Authenticated API routes are server-authorized; discovery/photo reads are intentionally public.

## Research references

- [Instacart Smart Shop](https://company.instacart.com/updates/introducing-smart-shop-personalization): preference-led recommendations and continuous customer corrections. Inspiration only; no affiliation or proprietary integration.
- [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/): structured search, attribution/license rules, caching, custom User-Agent and rate limits. V2 remains the documented structured search endpoint while product APIs evolve toward V3.
- [Wai Wai manufacturer product catalogue](https://waiwai.com.np/products/) and [vegetable noodle product](https://waiwai.com.np/product/wai-wai-veg-noodle/): manufacturer research context. No automated manufacturer feed or image license is claimed.

Before production, register real API usage and support contact with Open Food Facts, review licensing and supplier data agreements, configure an approved model provider if desired, and complete existing payment/carrier/compliance/database deployment gates. This update improves the working MVP; it does not assert global uniqueness or production readiness.

