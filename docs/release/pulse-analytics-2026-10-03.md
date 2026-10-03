# Pulse analytics release — 2026-10-03

Canonical destination: https://pulse.axxes.app. Existing Pulse.club hosts remain available for same-site AXXES portal embedding and one-time session adoption. Pulse is live on the existing GCP infrastructure. Initial production revision: `pulse-00025-mad`; all eight native apps and the Members portal are also deployed. Canonical DNS points to the existing load balancer with valid TLS.

Implemented: public landing/demo/docs; organization-scoped reports and URL filters; real collection and verification; goals/funnels; measured performance; consent-controlled persistent retention; downloadable typed/React/server SDKs; native app layouts, transactional business outbox, portal embed/widget/search/activity contracts; guarded Linux image release.

Storage: dedicated `pulse_analytics_prod` owned by a non-superuser account; account cannot access shared primary identity database. Events are hash-partitioned in 16 partitions. Metadata migrations are additive and portal-owned. No destructive schema push is used. Credentials/codes are hashed; raw IP is not persisted. Secret Manager runtime secret is `pulse-analytics-env`; no credentials are included here.

Verification checkpoints: 51 unit tests and TypeScript passed after review fixes; Linux Pulse build and Chromium/WebKit public checks passed (66cb609e-8d77-408e-8665-aaa278bd12d8); Linux builds for Members, Relay, Lanes, Office and Vibez passed. Real two-tenant workflow verified 15 collection/report/isolation checks; authenticated onboarding/embed/server credential workflow verified another 15. Production-host Chromium and WebKit passed the actual cross-family sign-in, scoped report access/second-organization denial, authenticated portal embedding, embedded filters/theme/message isolation, and all eight native browser trackers (Cloud Build `3f2979fa-ae38-4c54-a1c2-18f9fa812a1d`). A separate real production snippet check passed automatic first-event verification, two initial/SPA pageviews, a custom event, measured browser performance, and private query redaction. The production public release checker passed 11/11. Transactional source/rollback/worker/dedup delivery passed 7/7. Production rate-limit, retention, partition and aggregate fixtures passed. Local mercelle unavailable due incompatible OrbStack/missing QEMU; authorized secured Cloud Build provided real Linux verification.

Independent review: nine Important findings corrected (task timestamp guard, React client scope, SDK full configuration/lifecycle, bootstrap generation, embedded routing/domain, shared funnel filtering, retention observation window). Regression tests reproduce the SDK and timestamp/retention failures before fixes. Remaining raw query upper-bound optimization is documented in the execution ledger.

Tracker measurement: 2,176 bytes gzip at the pre-release checkpoint, below declared 4KiB budget; production checker confirmed this measurement. No generalized latency/capacity benchmark claims are made from functional fixtures.

Rollback: guarded release script preserves the previous ready revision, checks traffic has not changed concurrently, stages without traffic, probes readiness, promotes by immutable image digest, and restores the previous revision on failed health checks. Old revision retains its old runtime secret. Disable the scheduled queue worker during rollback; analytics and metadata tables/data remain intact. Disable individual Pulse sites to pause collection without changing business source data.

Production releases (secured Linux checks and guarded promotion):

| Service | Cloud Build |
| --- | --- |
| Pulse | 2859780c-a25d-4d7c-be0a-0fecd4560214 |
| Members | 99ef0d54-485f-4581-98d5-aa2e41e3b2f5 |
| Relay | d7c4063e-9db3-4bbb-9709-4ea062eb4b57 |
| Lanes | 415d0401-a764-49e5-936f-2d3423bf9b21 |
| Vibez | 70d772a1-6f29-438d-bb37-98ca9f876ee2 |
| Office (quill) | c3088b71-d9ff-48b7-81fc-f9ad28f5c738 |
| Tollbooth | 335f5957-509c-42ca-be5b-d77575300c94 |
| Manifest | 343b7aed-2bc4-4c0f-8e33-aaf7c55f7f3d |
| Folders (DAM) | 111ccbbd-44ff-40ed-9062-447f491071b7 |

The protected `pulse-analytics-maintenance` Cloud Scheduler job is enabled every minute. Its authenticated production execution passed; it drains transaction-backed native outcomes, rebuilds daily aggregates, expires nonce/rate rows, and removes expired raw events. Native connections remain organization opt-in. Catalog URL and Members `/pulse` launch are migrated.

Existing GitHub Workload Identity pins `refs/heads/main` while deployment workflows target `deploy/gcp`. GitHub automatic submissions are rejected before build. This release used authorized direct submissions to the same per-app build service accounts and identical secured pipeline; shared IAM was not changed.

Measured fixture latency (20 sequential requests per operation, concurrency 1, external HTTPS round trip from Puerto Rico to us-west1, one synthetic owned organization): collector p50 142 ms / p95 327 ms; report p50 164 ms / p95 374 ms. These are a small functional-fixture measurement, not a throughput or customer-scale claim.

Limits: raw report/export queries cap at 100,000 events; raw history is 90 days and operational summaries 365 days. Historical narrow queries can reach the raw cap when substantial newer traffic exists. Default rotating cookieless identity estimates visitors; persistent retention requires consent. Eight native AXXES products are automatically instrumented; remaining catalog products use manual integration recipes. SDKs are downloadable typed source artifacts; mobile examples are illustrative backend recipes. See the integration inventory for precise coverage.
