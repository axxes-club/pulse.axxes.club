# Pulse integration inventory

Connections are opt-in per organization and app. Creating a connection enables delivery; its UI stays waiting until an event is durably stored. Native outcomes have no invented browser session. The source transaction records a bounded metadata outbox entry; the scheduled Pulse worker retries until the analytics database commits it.

| Product | Browser source | Committed outcomes | Verification status |
| --- | --- | --- | --- |
| Members / Suite | Portal authenticated layout | contacts, membership creation, published events, checked-in attendees, sent newsletter campaigns, captured orders | Deployed; real Chromium/WebKit browser collection and scoped fixtures passed |
| Relay | authenticated AppLayout | `messages.status=sent` → message_sent | Deployed; real Chromium/WebKit browser collection and scoped fixtures passed |
| Lanes | authenticated AppLayout | projects created; project_cards.completed_at null→timestamp → task_completed | Deployed; real Chromium/WebKit browser collection and scoped fixtures passed |
| Office | quill repository, axxes.work authenticated AppLayout | office_documents.version writes → document_saved | Deployed; real Chromium/WebKit browser collection and scoped fixtures passed |
| Vibez | authenticated AppLayout | vibez_events committed insert → event_created | Deployed; real Chromium/WebKit browser collection and scoped fixtures passed |
| Folders / DAM | authenticated FoldersApp tenant selection | assets committed insert → file_uploaded | Deployed; real Chromium/WebKit browser collection and outbox fixtures passed |
| Tollbooth | authenticated app layout | tollbooth_payments.status=succeeded → purchase, existing integer minor amount/currency | Deployed; real Chromium/WebKit browser collection and outbox fixtures passed |
| Manifest | authenticated inventory app layout | manifest_stock_moves insert → inventory_moved; manifest_receipts posted → inventory_received | Deployed; real Chromium/WebKit browser collection and transaction fixtures passed |
| Any external website | hosted script or typed loader/provider | pageview, SPA navigation, measured web vitals, bounded custom events | Live production snippet, automatic verification, SPA navigation, measured performance, and organization isolation verified |
| External backend / mobile | versioned HTTPS API + scoped backend credential | authoritative bounded events and purchases | real credential scope, version, environment, revocation, minor units verified; Swift/Kotlin examples explicitly illustrative |

Native SQL is portal-owned in `db/pulse-native-adapters.sql`. Source write locations: Relay `src/lib/actions/messaging.ts` and message routes; Lanes project/card actions; Office document actions; Members events/newsletter/contact/order workflows; DAM asset registration; Vibez event actions; Tollbooth payment webhook writes; Manifest stock move and posted receipt workflows. The actual shared database table/field guards above are the adapter contract, independent of the caller path.

Raw event retention is 90 days. Operational daily aggregates are retained for 365 days. Report/export requests cap raw events at 100,000; this v1 is not a full warehouse replacement for Google Analytics. Framework snippets are hosted source artifacts, not published npm/mobile packages.

The eight native products above provide no-code browser connections and transaction-backed outcomes. Other live/beta AXXES catalog products appear in the integration center and support the manual tracker/API recipes; they are not claimed as automatically instrumented. Office uses its existing axxes.work authentication. The Pulse adoption checks cover axxes.club ↔ axxes.app, not an additional Office authentication bridge.
