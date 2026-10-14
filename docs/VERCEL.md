# GitHub and Vercel deployment

Repository: https://github.com/kirannetpack-ui/GharBox

Public app: https://gharbox.vercel.app

Verified on 14 October 2026: production build, type checking, 13 automated tests, isolated customer/admin integration workflows, zero known dependency audit vulnerabilities, and live HTTPS checks covering registration/login, persistent household/basket data, buyer approval, disabled public sample orders and 55 photographed discoveries. Run `BASE_URL=https://gharbox.vercel.app node scripts/live-check.mjs` with the appropriate shell environment syntax to repeat the live check. It creates one clearly named synthetic test customer and does not place orders or collect payments.

The Vercel project is `gharbox` under `kiran-thapa-s-projects`. A dedicated Turso database in Mumbai uses the existing Starter integration. `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are server-only environment variables managed by the integration. Never commit credentials, local databases or account records. Vercel builds contain only code and synthetic catalogue fixtures; local test accounts are not uploaded.

The asynchronous libSQL adapter supports local file storage for development and remote Turso storage for Vercel. Each API request has its own transaction context; writes are committed or rolled back on that connection. Schema initialization and fixture seeding run atomically once per warm instance and are idempotent across instances. Uploaded media bytes are stored in the persistent database. Remote latency, transaction deadlines and Starter quotas still apply.

Vercel refuses to start database operations without its persistent database configuration. There is no temporary filesystem fallback. API execution and database are located in Mumbai. Public deployment leaves sample order approval disabled by default; no live payment or carrier service is configured. Optional AI credentials and administrator provisioning must be configured privately. Admins should use a unique password and never send it through GitHub.

Pushes to `main` deploy through the connected GitHub repository. Run `npm test`, `npm run typecheck`, `npm run build` and `npm run test:integration` before pushing. Integration tests use a separate temporary local database. `vercel --prod` can also deploy the reviewed source from the linked workspace. Check public catalogue/discovery endpoints, registration and saved preferences after deployment.

Use Turso's managed backup/recovery facilities for the cloud database and verify restore procedures. Local SQLite backup instructions apply only to local deployments. Distributed abuse controls, account recovery, retention/export/deletion, payment/carrier integration and operational acceptance remain launch requirements. This is a publicly hosted working MVP, not a production commerce launch.
