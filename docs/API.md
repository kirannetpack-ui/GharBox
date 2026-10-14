# REST API

JSON request/response; errors use `{error: string}`. Session authentication uses an HttpOnly, SameSite=Lax cookie, Secure in production. Mutations reject mismatched origins. Validation failures return 400; unauthenticated requests 401; unauthorized admin access 403.

| Endpoint | Method | Purpose |
|---|---|---|
| /api/catalog | GET | Public products and configured destinations |
| /api/me | GET | Current identity, never password hash |
| /api/auth | POST | `{mode:register or login,email,password,name?}` |
| /api/logout | POST | Revoke all current user's sessions |
| /api/dashboard | GET | Owned households, basket quote, orders, requests, notifications and planning preferences |
| /api/households | POST | `{id?,name,recipient,address,destination,adults,children,budget,days,vegan}`; budget in minor units |
| /api/forecast | POST | Replace current basket with stock/budget-bounded starter estimate |
| /api/basket | POST | `{productId,quantity}`; 0 removes item |
| /api/orders | POST | `{idempotency: UUID}`; sample-only, Nepal-only, transactional deduction |
| /api/requests | POST | `{name,brand,comments}` |
| /api/subscriptions | POST | `{status,intervalDays,consent}`; planning preferences only |
| /api/admin/overview | GET | Admin products, countries, orders, requests, audit |
| /api/admin/products | POST | Validated full product object; dimensions cm, mass kg, integer minor-unit prices |
| /api/admin/destinations | POST | Full destination/carton sample rule object |
| /api/admin/requests | POST | `{id,status}`; submitted, under review, sourcing, approved, unavailable, completed |
| /api/admin/orders | POST | `{id,status}`; next sequential operational state |

Order state machine: `sample_confirmed → picking → packed → dispatched → delivered`. A sample order is never marked paid. No payment webhook endpoint exists: it must be added with provider signature verification, event-id uniqueness and atomic payment transitions before production acceptance. Admin state changes are manual operations, not carrier telemetry or verified item scans.

Quote: sum product minor-unit prices × packs; packaging = 150 minor units/carton; actual = item gross weights + 0.4 kg carton tare; dimensional = external dimensions (internal + 2 cm each axis) product / configured divisor; billable = max(actual, dimensional), rounded up to 0.5 kg; sample shipping = base + billable × kg rate. Tax unconfigured, not a legal assertion of zero tax. Current rates have no live carrier association, effective-date history or separate carton catalogue.
