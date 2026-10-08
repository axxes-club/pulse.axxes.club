# Pulse billing

Pulse is a paid product. Every plan has every feature, unlimited apps and unlimited teammates. Plans
differ only by monthly events. Money is taken by AXXES Payments (payments.axxes.app) on the AXXES
Stripe account. Pulse keeps its own entitlement records and changes them only from state it reads
back from Payments on the server.

## Plans

Source of truth: `src/lib/billing/plans.ts`. `scripts/pulse-stripe-prices.mjs` must match it, and a
test enforces that.

| Events / month | Monthly | Annual (2 months free) | Lookup keys |
| --- | --- | --- | --- |
| 25k | $5 | $50 | `pulse_e25k_monthly` / `_annual` |
| 100k | $9 | $90 | `pulse_e100k_…` |
| 250k | $14 | $140 | `pulse_e250k_…` |
| 1M | $19 | $190 | `pulse_e1m_…` |
| 5M | $49 | $490 | `pulse_e5m_…` |
| 10M | $79 | $790 | `pulse_e10m_…` |

- **Event:** a pageview or custom event. Web vitals and `pulse.verify` are not billed.
- **Trial:** 30 days, no card, up to 1M events. It starts the first time Pulse sees an organization,
  which for existing organizations is the first request after this ships. If someone chooses a plan
  during the trial, the remaining trial days pass to Stripe (`trialDays`), so they aren't charged early.
- **Over the plan:** collection continues up to 1.5× the plan with no extra charge, and the
  workspace says so. Past that, batches get `402` until the UTC month resets or the plan grows.
  Web vitals stop at 4× the plan in stored rows. There is never an automatic overage charge.
- **No plan (trial ended, canceled, unpaid):** collection gets `402`. Reports, history and exports
  stay readable. Payment-failure retries (`past_due`) keep collecting.
- **Owner access:** the AXXES owner's verified account (`AXXES_OWNER_USER_ID`, which must also be
  `is_superadmin`) can turn on free, unlimited access for an organization they own or administer,
  from Plan & billing. The grant is explicit, per organization and audited in
  `pulse_billing_audit`. It is never inferred from superadmin status, email or membership.

## How it fits together

```
Plan & billing ──POST /api/billing/checkout──▶ Payments /api/v1/checkouts (lookupKey, reference = tenant id)
       ▲                                              │ embedded Stripe checkout on payments.axxes.app
       │ 303                                          ▼
/api/axxes-payments/return?axxes_checkout=cs_…  ◀── "Return to Pulse"
       │ getCheckout + getSubscription (server, Pulse key) → pulse_billing
Payments ──signed subscription.updated──▶ /api/axxes-payments/events → re-read getSubscription → pulse_billing
Plan change ──POST /api/billing/change──▶ Payments POST /api/v1/subscriptions/<id> (in place, prorated)
Manage billing ──POST /api/billing/portal──▶ Stripe billing portal (card, invoices, cancel)
Collect / server events / native outbox ──allowance(tenant)──▶ persistBatch meters pulse_usage
```

- `pulse_billing` and `pulse_billing_audit` live in the shared database. They are Pulse-owned and
  `pulse_`-prefixed (`db/pulse-billing.sql`, additive). The shared `subscriptions` table is never
  touched, so no other product's plan can be overwritten.
- `pulse_usage` lives in the isolated analytics database (`db/pulse-analytics.sql`). It's incremented
  in the same transaction as the events it counts.
- Entitlements are cached for 60 s per instance. A change clears that instance's cache at once.
- A plan is written only from a snapshot fetched from Payments with Pulse's key. Events are
  verified (`AXXES-Payments-Signature`) and then re-read, never applied from their body. An ended
  subscription never closes access that a different live subscription still pays for.
- One tenant lock serializes checkout creation. A persisted full request and stable key recover lost responses. Plan reselection expires the old session first; completion races reconcile the subscription and ask the user to refresh. Unresolved reservations older than 23 hours need operator recovery because Stripe may discard idempotency keys after 24 hours.
- Billing actions need a same-origin request from an owner or admin of the active organization.

## Cost model (estimate, not measured)

These are per-event infrastructure costs on the current stack (Cloud Run 1 vCPU / 512 MiB, Cloud SQL
PD-SSD at about $0.17/GB-month plus about $0.08/GB backups). They assume ~700 B per stored event
including indexes, kept for 90 days, and a worst case of one event per request at ~30 ms CPU.
Stripe is 2.9% + $0.30 per charge.

| Plan | Price | Infra at 100% | Stripe | Margin | Worst case (1.5× + 4× vitals) |
| --- | --- | --- | --- | --- | --- |
| 25k | $5 | ~$0.04 | $0.45 | ~90% | ~85% |
| 100k | $9 | ~$0.17 | $0.56 | ~92% | ~85% |
| 250k | $14 | ~$0.42 | $0.71 | ~92% | ~85% |
| 1M | $19 | ~$1.70 | $0.85 | ~87% | ~70% |
| 5M | $49 | ~$8.30 | $1.72 | ~80% | ~55% |
| 10M | $79 | ~$16.60 | $2.59 | ~76% | ~50% |

Annual plans pay one Stripe fee a year, which improves these numbers. Fixed costs are not in the
table. The analytics database shares `axxes-prod-db` (2 vCPU, 20 GB disk) with every other product.
A single 10M customer stores roughly 20–70 GB, so before the first 5M+ customer, analytics should
move to its own Cloud SQL instance (roughly $100+/month). At the 1M plan, the model leaves about $16.45/month after variable infrastructure and Stripe fees; seven such organizations cover a $100/month fixed database bill before support and other overhead. Measure real row size and request CPU after launch, then replace these estimates.

## Reports at any volume

Report memory and returned rows are bounded, while database scan cost still depends on traffic and filters. Each visitor or session sampling query targets 90k events, accepts at most 112,500 rows, and retries at most six times (at most 675,006 returned rows across attempts). Exact reports use one raw-event load; sampled reports use at most two, for visitors and complete sessions (at most 1,350,012 returned rows across both retry sequences). Exact live/recent queries return at most 130 rows after filtering. These limits do not cap database rows scanned or CPU.

- When a window holds more than that (estimated from `pulse_daily_aggregates`), Pulse reads a fixed
  share of visitors and scales the counts up.
- Visitor and session samples use separate 4096-bucket hashes. Visitor-based counts and retention use visitor sampling; sessions, converted sessions and funnels use session sampling. This preserves cross-midnight sessions while anonymous visitor hashes continue rotating daily.
- Rates and performance percentiles are not scaled. Live activity and recent events always come
  from a separate exact query.
- Reports disclose estimated visitor and session shares; CSV exports carry the share appropriate to each counting unit.
- `pulse_events_sample_idx` and `pulse_events_session_sample_idx` support visitor/session-bucket selection; planner choices, time windows and exact activity filters can still scan more rows than returned. On 300k events, a
  1.5% sample read about 4.8k rows in 6 ms (PGlite).
- Reports are cached for 20 s per instance, so the 10-second refresh on Overview and Live doesn't
  recompute the window. Live activity is re-read on every refresh.

The sample index was estimated at about 70 B per stored event. The session-entry index adds storage for pageviews, and the session-sampling index adds storage for every event; the ~700 B cost assumption has not been remeasured with all three indexes. Validate storage and query CPU on production PostgreSQL before treating the margin table as measured.

## Launch checklist (approved by the owner in `pulse-oct8`, 2026-10-08)

1. Payments: merge and deploy the in-place plan change and checkout expiration endpoints (payments.axxes.app branch
   `feat/subscription-change`).
2. Payments: add `pulse` to `PAYMENTS_PRODUCTS` in `payments-env`. It needs new random live and test
   keys and an `eventSecret`, with `returnOrigins` `https://pulse.axxes.app` and
   `https://pulse.axxes.club`, and `events.live` `https://pulse.axxes.app/api/axxes-payments/events`.
3. Stripe: `STRIPE_SECRET_KEY=<test key> node scripts/pulse-stripe-prices.mjs --apply`, then the
   same with the live key.
4. Shared DB: `node scripts/pulse-migrate.mjs billing`. Analytics DB:
   `node scripts/pulse-migrate.mjs analytics` (adds `pulse_usage` and the sample index; building the index briefly blocks event writes, which is short at current volume).
5. `pulse-analytics-env` (the secret actually mounted by production Pulse): `AXXES_PAYMENTS_KEY`, `AXXES_PAYMENTS_EVENT_SECRET`, `AXXES_OWNER_USER_ID`.
6. Deploy Pulse. Then turn on owner access for AXXES's own organizations from Plan & billing, and
   make a test-mode purchase, upgrade, cancel and event delivery before the first live charge.

Apply the migrations before the deploy. Otherwise collection falls back to trial-sized limits and
the billing page shows "unavailable".


## 2026-10-08 launch verification

The owner approved pushes, PRs, Stripe prices, registration, additive migrations, secrets, deployment and sandbox checks in `pulse-oct8`. Pulse PR #5 and Payments PRs #3/#4 contain the implementation and pre-launch corrections. Production uses `pulse-analytics-env`, not the older `pulse-env`.

- Pulse Linux CI passed all 86 tests, including real PostgreSQL checks for ten concurrent visitors at the monthly ceiling and two concurrent checkout callbacks in a two-connection pool. Payments Linux CI passed its 19 tests, lint, types and build.
- Pulse image build `8620aa85-6831-4946-9cde-f0f47b6c08dd` passed Chromium/WebKit browser tests, container tests, production build and image-layer secret scan. Its image digest is `sha256:7df01f00523e30a5509a9ecf1cf01ab520c3ab6da1bb673f0a857148e4ea3e33`.
- All 12 prices exist in both Stripe modes. Pulse is registered in Payments, billing/usage/index migrations are applied, and production billing secrets reference the verified owner binding. The AXXES organization has an explicit audited owner grant; other organizations retain their own trial/plan policy and the owner-grant button.
- A hosted sandbox checkout was paid with Stripe's test card in the browser. The same subscription upgraded from 25k to 100k in place. Automatic Stripe → Payments → sandbox Pulse events applied the upgraded entitlement; tampered signed delivery was rejected.
- Billing portal opened and showed subscription, invoice and proration. Scheduling and final cancellation were verified through the Stripe test API and automatic signed events; scheduling was visible in the portal. The automated portal cancellation click path was not reliably completed.
- Test and live unpaid checkouts were created and expired through Payments, with cross-product access denied. No live charge was performed. Tests used an isolated billing schema; that schema, tag and temporary secrets must be removed after verification.

Production promotion uses this already-tested immutable image with the normal readiness/rollback release script. The merge commit skips duplicate push workflows; PR Linux CI and the independent image checks above remain the verification evidence. Profit margins remain estimates, including unmeasured query CPU/index storage and a separate analytics-server cost before 5M+ customers. Do not promise fixed report scan cost or measured margins.

Resolved in the October 8 hardening pass: repeated `web_vital` IDs within one batch now count once toward stored usage, while retaining the latest sample. Regression tests verify the metering correction.
