# Pulse analytics release — 2026-10-03

Canonical destination: https://pulse.axxes.app. Existing Pulse.club hosts remain available for same-site AXXES portal embedding and one-time session adoption. Current release is being verified; this document is not a deployment claim.

Implemented: public landing/demo/docs; organization-scoped reports and URL filters; real collection and verification; goals/funnels; measured performance; consent-controlled persistent retention; downloadable typed/React/server SDKs; native app layouts, transactional business outbox, portal embed/widget/search/activity contracts; guarded Linux image release.

Storage: dedicated `pulse_analytics_prod` owned by a non-superuser account; account cannot access shared primary identity database. Events are hash-partitioned in 16 partitions. Metadata migrations are additive and portal-owned. No destructive schema push is used. Credentials/codes are hashed; raw IP is not persisted. Secret Manager runtime secret is `pulse-analytics-env`; no credentials are included here.

Verification checkpoints: 51 unit tests and TypeScript passed after review fixes; Linux Pulse build and Chromium/WebKit public checks passed (66cb609e-8d77-408e-8665-aaa278bd12d8); Linux builds for Members, Relay, Lanes, Office and Vibez passed. Real two-tenant workflow verified 15 collection/report/isolation checks; authenticated onboarding/embed/server credential workflow verified another 15. Final deployed smoke checks and integration matrix updates remain pending. Local mercelle unavailable due incompatible OrbStack/missing QEMU; authorized secured Cloud Build provided real Linux verification.

Independent review: nine Important findings corrected (task timestamp guard, React client scope, SDK full configuration/lifecycle, bootstrap generation, embedded routing/domain, shared funnel filtering, retention observation window). Regression tests reproduce the SDK and timestamp/retention failures before fixes. Remaining raw query upper-bound optimization is documented in the execution ledger.

Tracker measurement: 2,176 bytes gzip at the pre-release checkpoint, below declared 4KiB budget; final checker prints the final measured byte count. No generalized latency/capacity benchmark claims are made from functional fixtures.

Rollback: guarded release script preserves the previous ready revision, checks traffic has not changed concurrently, stages without traffic, probes readiness, promotes by immutable image digest, and restores the previous revision on failed health checks. Old revision retains its old runtime secret. Disable the scheduled queue worker during rollback; analytics and metadata tables/data remain intact. Disable individual Pulse sites to pause collection without changing business source data.
