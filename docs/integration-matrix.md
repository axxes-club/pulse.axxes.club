# Pulse integration inventory

Connections are opt-in per organization and app. Creating a connection enables delivery; its UI stays waiting until an event is durably stored. Native outcomes have no invented browser session. The source transaction records a bounded metadata outbox entry; the scheduled Pulse worker retries until the analytics database commits it.

| Product | Browser source | Committed outcomes | Verification status |
| --- | --- | --- | --- |
| Members / Suite | Portal authenticated layout | contacts, membership creation, published events, checked-in attendees, sent newsletter campaigns, captured orders | Linux build and scoped fixtures passed; production deployment pending |
| Relay | authenticated AppLayout | `messages.status=sent` → message_sent | Linux build and scoped fixtures passed; production deployment pending |
| Lanes | authenticated AppLayout | projects created; project_cards.completed_at null→timestamp → task_completed | Linux build and scoped fixtures passed; production deployment pending |
| Office | quill repository, axxes.work authenticated AppLayout | office_documents.version writes → document_saved | Linux build and scoped fixtures passed; production deployment pending |
| Vibez | authenticated AppLayout | vibez_events committed insert → event_created | Linux build and scoped fixtures passed; production deployment pending |
| Folders / DAM | shared portal assets workflow | assets committed insert → file_uploaded | Outbox fixture tested; native Folders legacy host page adapter unavailable |
| Tollbooth | server payment source | tollbooth_payments.status=succeeded → purchase, existing integer minor amount/currency | Outbox fixture tested; native browser layout adapter unavailable |
| Pay / Store / Manifest historical repositories | no separate current deployment confirmed | live commerce is Suite orders + Tollbooth payments | historical standalone integrations unavailable; no fabricated connection claim |
| Any external website | hosted script or typed loader/provider | pageview, SPA navigation, measured web vitals, bounded custom events | real browser collector + organization isolation verified |
| External backend / mobile | versioned HTTPS API + scoped backend credential | authoritative bounded events and purchases | real credential scope, version, environment, revocation, minor units verified; Swift/Kotlin examples explicitly illustrative |

Native SQL is portal-owned in `db/pulse-native-adapters.sql`. Source write locations: Relay `src/lib/actions/messaging.ts` and message routes; Lanes project/card actions; Office document actions; Members events/newsletter/contact/order workflows; DAM asset registration; Vibez event actions; Tollbooth payment webhook writes. The actual shared database table/field guards above are the adapter contract, independent of the caller path.

Raw event retention is 90 days. Operational daily aggregates are retained for 365 days. Report/export requests cap raw events at 100,000; this v1 is not a full warehouse replacement for Google Analytics. Framework snippets are hosted source artifacts, not published npm/mobile packages.
