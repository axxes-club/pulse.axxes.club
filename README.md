# AXXES Pulse

Standalone analytics at https://pulse.axxes.app: a public landing page and demo, intuitive app setup, organization-scoped reports, consent controls, and native AXXES integration.

Develop with Node 24: `npm ci`, copy `.env.example` to `.env.local` with explicit identity and isolated analytics database URLs, then `npm run dev`. `npm test`, `npm run test:browser`, and `npm run build` verify the app. Never point analytics event storage at shared identity storage.

Users register without an invite code, create their workspace inside Pulse, and return to their original report after Handshake sign-in. Using another AXXES product is optional.

Pulse is paid: every plan has every feature and plans differ only by monthly events. Billing runs through AXXES Payments; see [docs/billing.md](docs/billing.md).

Metadata/source outbox migrations belong to the Members portal. Apply additive migrations with `scripts/pulse-migrate.mjs`; no schema push. Source SDK files and setup recipes are under `public/sdk` and served by `/docs`.

Production uses the existing GCP Cloud Run/Cloud SQL/load-balancer stack. The secured per-app Cloud Build pipeline runs browser/unit/build checks, secret-layer scanning, immutable image release, readiness guards and rollback. Production releases and pull requests use the repository's secured main/verification workflows. Authorized direct Cloud Build submissions also run the same immutable release checks. Runtime secrets are mounted from Secret Manager. See [release notes](docs/release/pulse-analytics-2026-10-03.md), [integration inventory](docs/integration-matrix.md) and [GCP CI/CD](docs/GCP-CI-CD.md).
