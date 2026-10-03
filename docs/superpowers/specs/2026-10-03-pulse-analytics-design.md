# AXXES Pulse — analytics product design

Date: 2026-10-03
Status: Ready for user review; implementation has not started.

## Intent and success

Build a branded analytics product at `pulse.axxes.app` for external websites and the AXXES app family, with a public landing page and a polished, usable analytics workspace. The user requested a competitor to Google Analytics, Cloudflare Analytics, and Vercel Analytics, with full AXXES integration and exceptional UX/UI. They accepted supporting external sites and native AXXES apps.

Success means a user can sign in with AXXES, select their organization, register a website, install tracking, see real incoming traffic, investigate acquisition and conversions, and use the same reports inside the AXXES portal. Existing Pulse business metrics and white-label support remain available. Competitive positioning is a direction, not a claim of feature parity or measured superiority.

## Current implementation and constraints

The existing `pulse.axxes.club` repository is a Next.js 16 / React 19 application with Better Auth, Drizzle, and the shared AXXES PostgreSQL database. It currently reports revenue, contacts, campaigns, events, inventory, and projects. It does not collect website events.

Reuse its organization membership checks, organization switcher, account system, and customer branding. New tables are migrated through the portal repository, as required by Pulse's README. Do not replace shared identity or clone organizations. Use the existing AXXES deployment flow rather than registering a separate Sites project.

The v2 brand book defines the product look and portal embedding contract. Some contracts are documented proposals; verify each against deployed code before relying on it. The `.axxes.app` session must be demonstrated in a browser before claiming seamless cross-domain sign-in.

## Recommended approach and alternatives

Recommended: evolve Pulse with a bounded first production release and modular ingestion, reporting, and integration layers. Keep identity and business data shared, while separating high-volume analytics storage from account tables through an analytics database connection. Start with PostgreSQL event partitions and aggregate tables; keep storage behind a repository interface so later scale work does not change the SDK or reports.

Alternative: embed an existing analytics engine. This accelerates collection but introduces another permission model and limits native AXXES workflows and branding.

Alternative: create an independent analytics service and UI from scratch. This permits a clean architecture but duplicates Pulse's working account, tenant, and branding integrations. Avoid that duplication for the initial release.

## Product experience

### Public website

`/` becomes the public landing page. Lead with a concrete value proposition: understand website traffic and AXXES business outcomes in one workspace. Use an actual interactive report component with clearly labeled sample data for the preview. Include product capabilities, installation, AXXES integration, privacy controls, documentation, and sign-in/start actions. Do not publish invented customer endorsements, speed claims, or unapproved prices. Pricing explains that access follows AXXES organization entitlements; numerical tiers require an actual billing configuration.

`/demo` provides a sample workspace with a persistent demo badge and functioning filters. `/docs` explains installation, event definitions, and integration. Sample data never appears as real customer traffic.

### Analytics workspace

`/dashboard` is authenticated. Organization and site selection, date range, comparison, timezone, active filters, and data freshness stay visible. Default to the last seven days and the site's configured reporting timezone. Preserve filters in URLs so refresh, navigation, and sharing reproduce the report.

The overview shows visitors, sessions, pageviews, conversion rate, a comparable-period traffic chart, live activity, top pages, sources, campaigns, countries, and devices. Each row can filter or open the underlying report. Mobile keeps essential controls and charts visible, with deliberate table overflow and a usable navigation drawer.

Dedicated views cover realtime, pages, acquisition, events and conversions, ordered funnels, performance, and site settings. Business vitals remain in a separate workspace view. CSV exports honor current filters and organization permissions.

Onboarding: add site → validate canonical origin and allowed domains → copy script or SDK integration → verify the first accepted event → open the report. Show installation status and a safe test event without inflating production metrics.

Empty reports explain how to connect a site. Failed queries show a retry action; failed collection shows setup diagnostics. Missing permissions, deleted sites, and unavailable integrations have explicit states. Never fill missing production data with samples.

### Visual system

Use existing AXXES wordmark assets, Geist and Geist Mono, near-black surfaces, restrained App blue accents, fine borders, and tabular numbers. Provide first-class light mode. Emphasize generous layout, legible type, precise chart labels, informative hover/focus details, and consistent spacing over decoration. Respect reduced motion.

Embedded views use the portal's warm neutrals, Inter, square corners, and current theme, hiding standalone navigation. Existing customer white-label overrides continue to apply. Keyboard navigation, visible focus, accessible menus, chart summaries, and color-independent comparison labels are required.

## Collection and SDK contract

Serve an asynchronous, versioned tracker and provide a typed JavaScript SDK with `page`, `track`, and performance reporting. Handle SPA navigation without duplicate pageviews. Flush bounded batches on lifecycle transitions using `sendBeacon` with fetch fallback; tracking failures must not break the host website.

Public ingestion receives a public site identifier, event identifier, event name, occurrence time, sanitized page path/referrer, allowlisted campaign fields, and bounded event properties. The server resolves the site and organization; clients cannot select an organization by submitting its identifier. Reject disabled sites, disallowed origins, oversized payloads, invalid timestamps, unsupported property types, and excess rates. Origin checks reduce abuse but do not authenticate public browser events; the public identifier is not a secret. Deduplicate event identifiers and distinguish rejected, accepted, and persisted status.

Default traffic analytics uses no persistent cross-site identifier, no raw IP storage, and no arbitrary form capture. Use short-lived site-scoped pseudonymous counting keys with rotating server secrets and disclose that counts are estimates. Redact URL query strings and fragments, except explicit campaign allowlists. Respect applicable consent configuration and Global Privacy Control. Retention and funnel reports requiring a durable identifier use a separate opt-in site mode and clearly document consent obligations and metric changes.

Trusted AXXES business events are server-side, authenticated with scoped credentials, idempotent, and derived from successful writes. Public browser events cannot assert authoritative revenue. Store money as integer minor units with currency; never sum different currencies as one amount. Do not capture payment details, document contents, message bodies, or passwords.

## Data and report semantics

Analytics metadata associates sites, allowed origins, timezone, collection mode, goals, retention settings, and integration state with a shared AXXES organization. Analytics storage contains validated events, session/counting keys, performance samples, and derived hourly/daily aggregates. Tenant identity is verified through membership before every read, mutation, and export. Public ingestion and public demo are separate from authenticated reporting.

Pageviews count accepted page events. Sessions use a documented 30-minute inactivity window within site scope. Visitors are estimated distinct counting keys within the reported period; do not add daily distinct counts to estimate a multi-day total. Conversion rate states its denominator and deduplicates goal completions per session. Attribution starts with session entry source and explicit UTM fields; label direct/unknown traffic honestly.

Realtime means accepted persisted events in a rolling five-minute window, refreshed every ten seconds while visible. Funnel steps are ordered events within one session with explicit completion windows, not unrelated event totals. Retention is only available in opted-in durable identity mode. Performance shows p75 LCP, INP, and CLS with sample sizes and sufficient-data states. Comparisons use equivalent complete periods in the selected timezone. Boundary tests cover daylight saving and incomplete current buckets.

Ingestion must acknowledge only durable writes or durable queue acceptance. Initial low-volume storage can persist directly; introduce a queue before volume makes that unreliable. Aggregate processing is idempotent and watermark-based, exposes lag, and retries safely. Retention jobs delete eligible raw events and update retained aggregates according to the configured policy. Define tested capacity from measurements; do not promise unlimited volume.

## AXXES integration

Use shared Handshake sign-in and live memberships, existing organization roles, and the portal's entitlement resolver. Verify the resolver and supported roles before implementation. Report viewing is available to entitled members; site administration and credentials require existing administrative permissions.

Expose `/embed/*`, organization-scoped `/api/portal/widgets/*`, and `/api/portal/search?q=` contracts. Validate postMessage sender, origin, message type, and payload before navigation or theme updates. Restrict frame embedding to known portal origins and provisioned tenant domains. Register Pulse in the catalog without changing its stable `pulse` key.

Integration inventory includes the portal, Handshake, Pay, Store, Vibez/Rooms, Relay, Lanes, Folders, and Office. Each gets an explicit installation and verification status. Browser traffic collection can cover every deployed app; semantic conversion/revenue adapters require application-specific successful-write hooks. Implement and verify each adapter before marking it connected. Portal widgets, search, and shared activity must use existing supported tables or additive portal-owned migrations.

Dual-domain sign-in must use validated host-aware cookies and Handshake's one-time session adoption if supported. Never place credentials in iframe URLs. If adoption is absent, implement that dependency in Handshake before enabling `.axxes.app` embeds. Preserve `.axxes.club` compatibility.

## Delivery boundaries

Deliver in coherent stages: (1) landing page, demo, design system and report navigation; (2) real site onboarding, tracker, ingestion and reporting; (3) conversions, funnels and performance; (4) verified AXXES adapters, portal surfaces, dual-domain sign-in and deployment. Retention follows durable identity support. Each stage extends the same product and has explicit acceptance checks. The complete requested product includes real collection and integrations, not just the visual first stage.

Session replay, advertising attribution, predictive AI, heatmaps, and a new billing system are outside this initial scope. Preserve extension points without implying those features exist.

## Verification and release

Read installed Next.js documentation before changing its APIs. Use meaningful tests for organization isolation, role enforcement, input validation, deduplication, attribution, metric denominators, currency handling, and funnel ordering. Verify the real workflow: create site, install tracker on a fixture website, produce traffic and a goal, see correct reports, filter/export, and confirm another tenant cannot access them.

Browser checks cover desktop/mobile, light/dark, keyboard, reduced motion, demo labeling, installation failure, and empty/loading/error states. Verify sign-in and embedded navigation in Chromium and WebKit. Test SPA pageviews and actual performance events. Measure tracker transfer size and collection/report latency and record results.

Run the production build and appropriate Linux verification with mercelle for repositories changed. Apply reviewed additive migrations before deploying dependent code. Verify `pulse.axxes.app` DNS, TLS, canonical routing, Handshake redirects, and embed policy. Deployment requires working environment configuration; report any missing dependency rather than claiming it is live. Record migration, deployment, smoke-test, and rollback evidence. Rollback must preserve collected data and disable incompatible collectors safely.

## Review checklist

This document distinguishes existing functionality from planned work; keeps the stable product key; defines production and demo data boundaries; includes external sites and AXXES integration; specifies measurable report semantics; respects portal-owned migrations; and avoids unverified pricing, parity, scale, and privacy claims. No implementation is authorized by this document until the user reviews it under the brainstorming workflow.
