# GharBox implementation plan

Architecture: Next.js/React/TypeScript → authenticated REST API → domain services → relational SQLite development store. PostgreSQL migration is a production gate; the bundled SQLite store is for a single persistent Node instance, never ephemeral/serverless deployment. Prices use integer minor units. Sessions use random hashed tokens and scrypt passwords. All mutations check origin and authorization.

Customer journey: browse → register → configure household and recipient → generate explainable starter estimate → edit persisted basket → preview cartons → explicitly submit a sample order → review status. Admin journey: sign in with provisioned admin → manage catalogue, destinations, requests → advance order states → inspect audit events.

Database: users 1:N sessions, households, baskets, requests, subscriptions, orders, notifications; baskets N:M products; orders contain immutable item/quote snapshots; destinations configure sample carton/rating rules; audit records identify actor and action. See lib/db.ts for executable versioned migration.

Priority: P0 secure accounts + household + catalogue + basket + bounded packing + transactional order creation; P1 inventory operations, subscriptions controls, requests and admin; P2 real payment/carrier adapters, verified compliance, jobs, delivery events; P3 purchase-history forecasting, localization, multiwarehouse allocation.

Release gates: end-to-end and accessibility audit, PostgreSQL/Prisma deployment migration, distributed rate limiter, password reset/MFA, tax review, carrier and payment contracts, approved import rules, backups/restore rehearsal and monitoring. Do not call this production-ready before those gates pass.
