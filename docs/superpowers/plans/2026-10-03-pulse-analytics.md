# AXXES Pulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver AXXES Pulse at `pulse.axxes.app` with a premium landing page, actual website analytics, and verified native AXXES integrations.

**Architecture:** Extend the existing Pulse repository. Keep identity and organizations in the shared AXXES database, isolate analytics events behind a storage interface, and reuse one report UI for demo, authenticated, and embedded views. Deliver four integrated stages; a visual preview does not complete the product.

**Tech Stack:** Existing Next.js 16.3.6, React 19.2.8, TypeScript, Tailwind v4, Better Auth, Drizzle, PostgreSQL; Vitest for metric/security tests and Playwright for browser acceptance checks. Preserve the lockfile and install only the test dependencies and UI primitives needed.

**Spec:** [Approved design](../specs/2026-10-03-pulse-analytics-design.md)

## Global Constraints

- Keep the stable `pulse` product key; use `pulse.axxes.app` as the target host and preserve `.axxes.club` compatibility.
- Reuse shared identity and live organization memberships; new tables are migrated through the portal repository.
- Use existing AXXES wordmark assets, Geist and Geist Mono, near-black surfaces, restrained App blue accents, fine borders, and tabular numbers.
- Embedded views use the portal's warm neutrals, Inter, square corners, and current theme, hiding standalone navigation.
- Default traffic analytics uses no persistent cross-site identifier, no raw IP storage, and no arbitrary form capture.
- Realtime means accepted persisted events in a rolling five-minute window, refreshed every ten seconds while visible.
- Sessions use a documented 30-minute inactivity window within site scope.
- Every production report is backed by real data; demo data is visibly labeled and isolated.
- Do not publish invented customer endorsements, speed claims, unapproved prices, or unverified scale claims.
- Read installed Next.js documentation before changing its APIs; verify production builds on Linux with mercelle.

## Review Focus

- Malformed, duplicate, delayed, or oversized events must not inflate reports or exhaust ingestion resources (Tasks 3–4).
- Revoked membership and forged site/organization selectors must never reveal another organization's data (Tasks 3, 5, 8).
- SPA back/forward navigation, repeated mounting, and beacon delivery must not duplicate pageviews (Task 4).
- Timezone boundaries, daylight saving, partial periods, and distinct visitor counts must yield explainable comparisons (Task 5).
- Disabled tracking, missing credentials, blocked cookies, and unavailable adapters must show honest setup status (Tasks 6–10).

## Execution preparation

- [ ] Read the approved spec and this plan. Use using-git-worktrees for isolated branches in Pulse and each repository changed. Inventory branch status and local changes without exposing environment secrets.
- [ ] Read local AGENTS.md and relevant installed Next.js routing, route handler, and server/client documentation in each repository. Use the existing deployment configuration; do not create a separate Sites project.
- [ ] Add the minimum meaningful test harness in Task 1; build independently deployable commits at each stage. Run required checks once per substantive change, avoiding redundant full builds.

## Stage 1 — public website and analytics experience

### Task 1: Public landing page and shared design system

**Files:** Create `src/components/pulse/brand.tsx`, `theme.tsx`, `chart.tsx`, `metric-card.tsx`, `report-table.tsx`, `src/app/(marketing)/page.tsx`, `src/app/(marketing)/docs/page.tsx`; modify `src/app/globals.css`, `src/product.config.ts`, `src/app/layout.tsx`, `package.json`; move `src/app/(app)/page.tsx` to `src/app/(app)/dashboard/business/page.tsx`; create `tests/browser/marketing.spec.ts`, `playwright.config.ts`, `vitest.config.ts`.

**Interfaces:** Produce `PulseChart({series: Array<{time: string; value: number}>, comparison?: Array<{time: string; value: number}>, label: string})`, `MetricCard({label: string; value: string; comparison?: string})`, and an accessible `ThemeProvider`. Existing `getVitals(tenantId)` continues to power business vitals.

- [ ] Write browser assertions: `/` is public; start action reaches sign-in; the demo link works; navigation and theme switch are usable at 390px and 1440px; keyboard focus is visible; no horizontal page overflow at 200% text size. Run `npx playwright test tests/browser/marketing.spec.ts` and observe the expected missing-page failures.
- [ ] Build the page around an actual report preview, a strong AXXES lockup, crisp product typography, installation, integrations, privacy controls, and transparent entitlement copy. Keep the interactive report component reusable. Copy existing brand assets into `public/brand/` with source attribution in docs. Migrate root-dependent sidebar links and sign-in redirects to `/dashboard`.
- [ ] Run browser checks and `npx tsc --noEmit`; commit the verified landing page and primitives.

### Task 2: Interactive demo and report navigation

**Files:** Create `src/lib/analytics/types.ts`, `query.ts`, `demo.ts`, `src/components/pulse/report-shell.tsx`, `report-view.tsx`, `filters.tsx`, `src/app/(marketing)/demo/page.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/dashboard/[view]/page.tsx`, `tests/analytics/query.test.ts`, `tests/browser/demo.spec.ts`; modify `src/app/(app)/layout.tsx`.

**Interfaces:** Define `ReportQuery = {siteId: string; from: string; to: string; timezone: string; compare: boolean; filters: Record<string,string>}`; `ReportView = 'overview' | 'realtime' | 'pages' | 'acquisition' | 'events' | 'funnels' | 'performance' | 'retention'`; `parseReportQuery(search: URLSearchParams): ReportQuery`; `ReportData` with metrics, current/comparison series, breakdown rows, freshness, and identity mode. `ReportViewComponent({view: ReportView; query: ReportQuery; data: ReportData; mode: 'demo' | 'production' | 'embed'})` is shared by later tasks.

- [ ] Test query serialization round trips, invalid dates/timezones, and demo filtering. Browser test asserts persistent demo badge, working date/metric/source filters, browser back/refresh state, table drilldown, mobile drawer, and keyboard chart alternatives. Run `npx vitest run tests/analytics/query.test.ts` before implementation to confirm failure.
- [ ] Implement deterministic synthetic demo events and meaningful computed reports. Production dashboard initially shows a genuine connect-site empty state. Add URL-persisted filters, comparison labels, chart focus details, and responsive tables. Retention explains the required opt-in identity mode rather than displaying fabricated customer results.
- [ ] Run focused unit/browser tests and production build; commit the first reviewable visual product slice. Open a meaningful local preview only after navigation and demo interactions work.

## Stage 2 — real collection and reporting

### Task 3: Metadata, storage, tenant access, and ingestion

**Files:** Portal repository: create `src/lib/db/schema/pulse.ts`, `scripts/pulse-migrate.mjs`, `db/pulse-metadata.sql`, `db/pulse-analytics.sql`; update schema exports. Pulse: create `src/lib/analytics/access.ts`, `storage.ts`, `postgres.ts`, `ingest.ts`, `validation.ts`, `src/app/api/pulse/collect/route.ts`, `tests/analytics/ingest.test.ts`, `access.test.ts`; copy portal metadata schema to Pulse and update its exports.

**Interfaces:** `requireAnalyticsAccess(siteId: string, action: 'read'|'manage'): Promise<{tenantId: string; site: AnalyticsSite}>`; `EventInput = {id: string; name: string; timestamp: string; url: string; referrer?: string; properties?: Record<string,string|number|boolean>; sessionId?: string}`; `ingestBatch(input: {publicSiteId: string; origin: string; events: EventInput[]}, request: {ip: string; userAgent: string}): Promise<{accepted: number; duplicates: number}>`. `AnalyticsStore` provides `writeEvents(events: StoredEvent[]): Promise<{accepted:number;duplicates:number}>` and `report(tenantId: string, query: ReportQuery, view: ReportView): Promise<ReportData>`. Resolve tenant/site on the server; raw IP is never a persisted field.

- [ ] Test forged tenant identifiers, nonmember and revoked memberships, viewer management denial, disabled sites, wrong origins, duplicates, malformed properties, query-string redaction, overlarge batches, future timestamps, and storage failure returning a failure response rather than acceptance. Management is limited to live `owner`/`admin` memberships; all entitled live roles can view.
- [ ] Implement metadata tables for sites/goals/integrations and isolated analytics tables for partitioned events, scoped credentials, aggregates, processing watermarks, and session keys. Use `ANALYTICS_DATABASE_URL`, with local explicit test configuration, never silent fallback to production identity storage. Enforce 32 KiB request body, 50 events/batch, 20 properties/event, 256-character property values, and a configurable shared-storage rate limit. Accept events no more than 24 hours old or five minutes in the future. Reject unsupported media types and nonfinite numeric properties. Apply origin checks to CORS and ingestion; beacon JSON sent as text/plain is parsed through the same validation.
- [ ] Implement parameterized writes, partition provisioning, per-site unique event IDs, and HTTP 202 only after durable persistence. Derive rotating HMAC site-scoped counting keys and store short-lived session state with no raw IP. Document the session/counting limitations around secret rotation. Create a tested injectable clock and storage adapter.
- [ ] Run `npx vitest run tests/analytics/ingest.test.ts tests/analytics/access.test.ts` and apply migration scripts only against an isolated test database first. Commit portal and Pulse changes separately; production migration follows release checks.

### Task 4: Tracker and typed SDK

**Files:** Create `public/pulse.v1.js`, `sdk/src/index.ts`, `sdk/package.json`, `tests/analytics/tracker.test.ts`, `tests/browser/tracker.spec.ts`, `tests/fixtures/tracked-site/`; modify documentation from Task 1.

**Interfaces:** `createPulse({siteId: string; endpoint: string; consent: 'granted'|'denied'; identityMode?: 'ephemeral'|'persistent'}): {page(): void; track(name: string, properties?: Record<string,string|number|boolean>): void; consent(value: 'granted'|'denied'): void; destroy(): void}`. Default browser script requires a valid site attribute and uses ephemeral mode; persistent mode is explicit and documented.

- [ ] Test initial page, pushState/replaceState/popstate, repeated mounting, teardown, denied consent/GPC, beacon failure fallback, bounded queues, and host-page operation during network failure. Assert one pageview per actual navigation and no arbitrary query/form capture. Run focused unit/browser tests and confirm failures first.
- [ ] Implement automatic pageviews, explicit custom events, visibility/pagehide flushing, unique event IDs, and capped retries. Keep public identifiers distinct from trusted server credentials. Add a documented opt-in persistent identifier mode for retention without extending identifiers across sites.
- [ ] Verify fixture events reach isolated storage, inspect the resulting records for sanitization, measure compressed tracker size, and commit. Publish no SDK package without an explicit release decision; local source and installable build artifacts suffice for this website release.

### Task 5: Metric engine, aggregates, and real reports

**Files:** Create `src/lib/analytics/metrics.ts`, `periods.ts`, `attribution.ts`, `reports.ts`, `src/app/api/pulse/sites/[siteId]/reports/route.ts`, `export/route.ts`, `scripts/pulse-aggregate.mjs`, `scripts/pulse-retain.mjs`, `tests/analytics/metrics.test.ts`, `periods.test.ts`, `reports.test.ts`; extend storage from Task 3 and report components from Task 2.

**Interfaces:** `getReport(tenantId: string, query: ReportQuery, view: ReportView): Promise<ReportData>`; `resolvePeriods(query: ReportQuery, now: Date): {current: {from: Date; to: Date}; previous: {from: Date; to: Date}}`; `attributeSession(events: StoredEvent[]): {source: string; medium: string; campaign: string|null}`. All time intervals are half-open; reports include their visitor-estimate methodology and freshness.

- [ ] Test a visitor spanning two days counts once in the combined period, 30-minute session expiration, exact interval boundaries, spring/fall DST, leap day, equal comparable periods, partial current buckets, campaign entry attribution, and duplicate goals counted once per session. Test CSV scope and spreadsheet-formula neutralization. Run focused tests and confirm failures.
- [ ] Implement SQL-backed reports and idempotent aggregate/retention jobs. Use event-derived distinct keys for visitor counts across days; never sum daily distinct visitors. Refresh realtime every ten seconds only while visible and display five-minute persisted activity. Parameterize all filters; bound query intervals and export sizes. Separate currencies in business reports and replace misleading authorized-order revenue labels with accurately documented values.
- [ ] Wire production pages to authenticated report APIs with actual empty/loading/error/retry states. Run unit tests and fixture-browser flow, reconcile SQL counts against fixtures, verify retention rerun safety, and commit.

### Task 6: Site onboarding and organization entitlements

**Files:** Create `src/app/(app)/dashboard/sites/page.tsx`, `src/app/(app)/dashboard/settings/page.tsx`, `src/app/api/pulse/sites/route.ts`, `src/app/api/pulse/sites/[siteId]/route.ts`, `src/lib/analytics/sites.ts`, `entitlements.ts`, `tests/analytics/sites.test.ts`, `tests/browser/onboarding.spec.ts`; update `.env.example`.

**Interfaces:** `createSite(input: {name: string; origin: string; timezone: string; identityMode: 'ephemeral'|'persistent'}): Promise<AnalyticsSite>`; `getSiteSetup(siteId: string): Promise<{status: 'awaiting-installation'|'connected'|'disabled'; lastEventAt: string|null}>`; `getPulseEntitlement(tenantId: string): Promise<{enabled: boolean; siteLimit: number|null}>`.

- [ ] Test canonical origins, rejected credential URLs, duplicate site handling, unknown timezones, disabled sites, unauthorized updates, and first-event setup verification. Add browser acceptance for copyable script, consent instructions, test event exclusion, and connect-site → tracker → report workflow.
- [ ] Inspect the actual portal entitlement implementation and map Pulse to it without inventing plan tiers or a `gateFor` API absent from code. Implement site CRUD, origin allowlists, timezone/identity mode controls, scoped credential rotation, retention settings, and first-event diagnostics. Disable rather than silently delete collected analytics on entitlement loss; enforce configured retention.
- [ ] Run focused tests and onboarding browser flow with two isolated organizations; commit only when cross-organization attempts are denied.

## Stage 3 — conversions, funnels, performance, and retention

### Task 7: Advanced reports with explicit semantics

**Files:** Create `src/lib/analytics/goals.ts`, `funnels.ts`, `performance.ts`, `retention.ts`, `src/components/pulse/funnel-editor.tsx`, `tests/analytics/funnels.test.ts`, `performance.test.ts`, `retention.test.ts`; extend report API/types and tracker/SDK.

**Interfaces:** `evaluateFunnel(events: StoredEvent[], steps: string[], windowMs: number): Array<{step: string; sessions: number; rate: number}>`; `percentile75(values: number[]): number|null`; `getRetention(tenantId: string, query: ReportQuery): Promise<{available: boolean; cohorts: Array<{start: string; size: number; retained: number[]}>}>`.

- [ ] Test out-of-order steps, repeat steps, completion window expiration, session/site isolation, zero denominators, p75 with zero/one/multiple samples, insufficient-data labeling, and retention denied in ephemeral mode. Run tests before implementation.
- [ ] Implement persisted goals and ordered session funnels; render readable funnel comparisons and their denominator. Add LCP/CLS through PerformanceObserver and INP using maintained web-vitals only after verifying its official API. Identify performance samples by page/navigation and deduplicate updates. Show sample counts and p75 labels. Compute retention only from opted-in site-scoped persistent identifiers and document cohort/timezone rules.
- [ ] Run fixture events and real browser performance collection, confirm displayed results against fixture calculations, and commit.

## Stage 4 — AXXES integration and release

### Task 8: Portal embed, widgets, search, and catalog

**Files:** Pulse: create `src/app/embed/[view]/page.tsx`, `src/lib/portal/messages.ts`, `src/app/api/portal/widgets/pulse/route.ts`, `src/app/api/portal/search/route.ts`, `tests/portal/messages.test.ts`, `tests/browser/embed.spec.ts`; update `next.config.ts`. Portal: create `src/app/(dashboard)/pulse/[[...path]]/page.tsx`, `src/components/pulse/pulse-embed.tsx`; update `src/lib/dam/app-links.ts` and the actual catalog registration source located during execution.

**Interfaces:** `parsePortalMessage(input: unknown, origin: string, sender: MessageEventSource|null, expectedSender: MessageEventSource): PortalMessage|null`; typed messages support navigation, title, notifications, app-open, resize, and theme. Widget/search routes obtain organization access from the authenticated session; caller-submitted tenant IDs never grant access.

- [ ] Test wrong origin/source/type/payload, unauthorized widget/search requests, revoked membership, theme changes, portal refresh/deep-links, and no unwanted new tabs. Run focused tests before implementation.
- [ ] Implement embed-specific layout with inherited portal tokens and customer branding, explicit CSP frame-ancestors allowlist, bounded messages, site search, and useful traffic/conversion widgets. Locate the deployed activity/notification contract and write additive metadata-only events; if absent, implement that portal-owned dependency and its isolation test before declaring activity integrated.
- [ ] Verify standalone and portal reports display identical scoped results, including WebKit after Task 9, and commit both repositories.

### Task 9: Handshake cross-domain session adoption

**Files:** Handshake: create `src/lib/session-adoption.ts`, `src/app/api/session/adoption-code/route.ts`, `src/app/session/adopt/route.ts`, `tests/session-adoption.test.ts`; update `src/lib/auth.ts` and sign-in completion redirect. Portal-owned migration: `db/session-adoption.sql` and schema exports. Pulse: update `src/lib/auth.ts`, sign-in redirect flow, and environment example.

**Interfaces:** `issueAdoptionCode(sessionId: string, destination: 'axxes.app'|'axxes.club'): Promise<string>`; `consumeAdoptionCode(code: string, destination: 'axxes.app'|'axxes.club'): Promise<{sessionId: string}|null>`. Codes are cryptographically random, stored hashed, single-use, expire after 60 seconds, and are consumed atomically. Cookie issuance uses Better Auth's verified installed signing contract, never fabricated session tokens.

- [ ] Test replay, expiry, wrong destination, concurrent consumption, untrusted hosts and redirects, revoked sessions, and failure not setting cookies. Run the isolated tests and confirm missing implementation failures.
- [ ] Implement a validated top-level adoption bounce between allowed Handshake hosts, setting Secure/HttpOnly cookies with approved parent domains. Strip codes from the destination URL after adoption, use no-referrer responses, and prevent external return URLs. Scope changes to Handshake and Pulse; integrate additional app hosts only as verified in Task 10.
- [ ] Verify same-session sign-in and embedding on both domains in Chromium and WebKit with TLS fixture hosts, then production hosts at release. Commit only after atomic consumption and cookie compatibility tests pass.

### Task 10: Native app instrumentation and conversion adapters

**Files:** Create `src/lib/analytics/integrations.ts`, `server-events.ts`, `src/app/api/pulse/server-events/route.ts`, `sdk/src/server.ts`, `tests/analytics/server-events.test.ts`, `docs/integration-matrix.md` in Pulse. Portal: `src/components/pulse/pulse-tracker.tsx`. In each verified app create `src/lib/pulse.ts` and modify its successful-write action, webhook, or root layout as appropriate. Repository inventory: `payments.axxes.club`, `manifest.axxes.club`, `vibez.axxes.club`, `relay.axxes.club`, `lanes.axxes.club`, `dam.axxes.club`, `quill.axxes.club`, and the portal; verify current product mappings rather than relying on historical hostnames.

**Interfaces:** `sendPulseServerEvent({eventId: string; name: string; tenantId: string; occurredAt: string; properties: Record<string,string|number|boolean>}): Promise<void>`; server endpoint validates hashed scoped credentials against tenant/site and uses idempotent event IDs. Revenue properties require integer `amountMinor` and valid `currency`.

- [ ] Test forged browser revenue, credential scope/revocation, duplicate webhook delivery, mixed currencies, and integration status remaining unconnected until a verified persisted event arrives. Run failures before implementing server-event authentication.
- [ ] Wire page tracking in deployed app layouts and semantic events only after successful source operations: captured payment, completed checkout, event participation, campaign send, completed task, uploaded file, and saved document. Locate exact source files per app during the implementation task and record them in the matrix. Use existing outbox if available; otherwise add an additive transaction-compatible outbox so analytics failures do not lose business events or interrupt the operation.
- [ ] Run each adapter against isolated fixtures, record event IDs and expected counts, verify no content/payment secrets are collected, and commit each app independently. Mark every matrix row with tested, pending configuration, or unavailable status; do not report total integration while rows remain incomplete.

### Task 11: Production verification and deployment

**Files:** Create `docs/release/pulse-analytics-2026-10-03.md`, `scripts/check-pulse-release.mjs`, `mercelle.config.json` where required; update README, environment examples, and deployment configuration as needed.

**Interfaces:** Release checker verifies landing/demo/docs, authenticated redirect, script delivery, collection rejection paths, production report access isolation, embed CSP, and canonical host behavior without printing credentials.

- [ ] Run the full relevant unit/browser suite and production builds for changed repositories. Read mercelle skill and verify Linux behavior. Capture tracker compressed bytes, ingest/report latency distributions from a declared fixture load, and accessibility/mobile findings; publish measured claims only if supported.
- [ ] Provision required analytics database and environment configuration using available authorized access; apply additive portal-owned migrations; configure retention/aggregate schedules with protected job endpoints. Confirm rate limiting, partition provisioning, and bounded exports under fixture load. Never use destructive schema push commands.
- [ ] Verify account/domain access, then configure `pulse.axxes.app` DNS/TLS with the existing hosting provider and preserve old routes. Deploy compatible Handshake/portal schema changes before Pulse and dependent adapters. Run real-host smoke tests in Chromium/WebKit, including first-event onboarding and portal embedding.
- [ ] Record deployment URLs, migration results, live integration matrix, smoke-test evidence, and rollback procedure. Missing external configuration remains an explicit blocker to deployment, not a reason to claim success. Rollback preserves analytics data and can disable incompatible ingestion safely.
- [ ] Request final code review, fix verified findings, and use verification-before-completion and finishing-a-development-branch for the chosen integration method. Hand off the working site link and clear remaining limitations only after checking actual deployed behavior.

## Self-review

All design sections map to tasks: landing/visuals 1–2; collection/privacy/storage 3–4; reporting/retention 5–7; AXXES contracts 8–10; deployment/verification 11. The five review conditions have explicit tests in their owning tasks. Shared interfaces use one ReportQuery/ReportData/EventInput contract. Exact environment values and external credentials are supplied from existing authorized configuration, never embedded in this document. This plan requires user review and an execution-method choice before product implementation.
