# AXXES Pulse

Analytics at https://pulse.axxes.app: a public landing page and demo, intuitive app setup, organization-scoped reports, consent controls, and native AXXES integration.

Develop with Node 24: `npm ci`, copy `.env.example` to `.env.local` with explicit identity and isolated analytics database URLs, then `npm run dev`. `npm test`, `npm run test:browser`, and `npm run build` verify the app. Never point analytics event storage at shared identity storage.

Metadata/source outbox migrations belong to the Members portal. Apply additive migrations with `scripts/pulse-migrate.mjs`; no schema push. Source SDK files and setup recipes are under `public/sdk` and served by `/docs`.

Production uses the existing GCP Cloud Run/Cloud SQL/load-balancer stack. The secured per-app Cloud Build pipeline runs browser/unit/build checks, secret-layer scanning, immutable image release, readiness guards and rollback. This release used authorized direct Cloud Build submissions: the existing GitHub identity provider permits `main` while workflows target `deploy/gcp`, so GitHub automatic delivery currently needs a separate shared IAM correction. Runtime secrets are mounted from Secret Manager. See [release notes](docs/release/pulse-analytics-2026-10-03.md), [integration inventory](docs/integration-matrix.md) and [GCP CI/CD](docs/GCP-CI-CD.md).
