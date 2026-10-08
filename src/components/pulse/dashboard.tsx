import { Suspense } from "react";
import Link from "next/link";
import { requireContext } from "@/lib/context";
import { listSites } from "@/lib/analytics/sites";
import { buildReport, loadEvents } from "@/lib/analytics/storage";
import { parseReportQuery } from "@/lib/analytics/query";
import { summarizeEvents, filteredEvents } from "@/lib/analytics/metrics";
import type { AnalyticsEvent, AnalyticsReport } from "@/lib/analytics/types";
import { ReportShell } from "./report-shell";
import { ReportView, ReportRetry } from "./report-view";
import { getReportConfig } from "@/lib/analytics/config";
import { reportWindow } from "@/lib/analytics/timezone";
import { Icon } from "./icon";
import { BillingNotice } from "./billing-notice";
export async function Dashboard({
  view = "overview",
  search,
}: {
  view?: string;
  search: Record<string, string | undefined>;
}) {
  const ctx = await requireContext();
  if (view === "integrations")
    return (
      <ReportShell view={view} organization={ctx.tenant.name} context={ctx}>
        <BillingNotice tenantId={ctx.tenant.id} />
        <Suspense>
          <ReportView view={view} organizationKey={ctx.tenant.id} />
        </Suspense>
      </ReportShell>
    );
  let error = "";
  let sites: Awaited<ReturnType<typeof listSites>> = [];
  try {
    sites = await listSites(view === "settings");
  } catch {
    error =
      "Analytics setup is not available yet. Your organization data is safe; try again once Pulse storage has been configured.";
  }
  let selected = sites.find((s) => s.publicId === search.site) || sites[0];
  if (selected && search.environment && selected.environment !== search.environment) error = "This app uses the " + selected.environment + " environment. Choose the app for the environment you want in the app selector.";
  if (search.site && !sites.some((s) => s.publicId === search.site))
    error = "That app is not available in this organization.";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) if (v) params.set(k, v);
  if (!params.has("environment") && selected)
    params.set("environment", selected.environment);
  if(!params.has("timezone") && selected) params.set("timezone",selected.timezone);
  const query = parseReportQuery(params);
  const selectedWindow = reportWindow(query.range,query.timezone || "UTC",new Date(),query.from,query.to);
  let config: {
    goals: string[];
    funnels: Array<{
      id: string;
      name: string;
      steps: string[];
      windowMs: number;
    }>;
  } = { goals: [], funnels: [] };
  let events: AnalyticsEvent[] = [];
  let report: AnalyticsReport | null = view === "settings" ? summarizeEvents([], query, new Date()) : null;
  if (selected && !error && view !== "settings") {
    try {
      config = await getReportConfig(selected.publicId);
      if (view === "funnels") {
        // Funnel sampling keeps complete sessions, including sessions crossing midnight.
        const loaded = await loadEvents(selected, new Date(selectedWindow.previousStart), new Date(selectedWindow.end), undefined, undefined, "session");
        events = loaded.events;
        const visitorLoaded = loaded.sample && loaded.sample < 1
          ? await loadEvents(selected, new Date(selectedWindow.previousStart), new Date(selectedWindow.end))
          : loaded;
        report = summarizeEvents(visitorLoaded.events, query, new Date(), {
          identityMode: selected.identityMode,
          goalNames: config.goals,
          sample: visitorLoaded.sample,
          sessionEvents: loaded.events,
          sessionSample: loaded.sample,
          rawRetentionDays:90,
        });
      } else report = await buildReport(selected, query, config.goals);
    } catch (e) {
      error =
        e instanceof Error && "status" in e && e.status === 422
          ? e.message
          : "Pulse could not load your analytics. Check storage configuration or try again.";
    }
  }
  return (
    <ReportShell
      view={view}
      organization={ctx.tenant.name} context={ctx}
      sites={sites.map((s) => ({
        id: s.publicId,
        name: s.name,
        environment: s.environment,
      }))}
      selectedSiteId={selected?.publicId}
    >
      <BillingNotice tenantId={ctx.tenant.id} />
      {error ? (
        <div className="empty-report">
          <Icon name="help" size={35} />
          <h2>Let’s get Pulse connected.</h2>
          <p>{error}</p>
          <ReportRetry/>
        </div>
      ) : !selected || !report ? (
        <div className="empty-report">
          <Icon name="pulse" size={35} />
          <h2>Your app’s next chapter starts here.</h2>
          <p>
            Connect your first app to see its traffic, sources, and conversions.
            Pulse walks you through every step.
          </p>
          <Link href="/dashboard/integrations" className="button primary">
            Connect your app <Icon name="arrow" />
          </Link>
          <Link
            href="/demo"
            className="button secondary"
            style={{ marginLeft: 10 }}
          >
            Explore demo
          </Link>
        </div>
      ) : (
        <Suspense>
          <ReportView
            view={view}
            siteId={selected.publicId}
            organizationKey={ctx.tenant.id}
            timezone={selected.timezone}
            environment={selected.environment}
            funnels={config.funnels}
            goalNames={config.goals}
            canManage={["owner", "admin"].includes(ctx.role)}
            events={view === "funnels" ? filteredEvents(events,query).filter(e=>{const t=Date.parse(e.time);return t>=selectedWindow.start&&t<selectedWindow.end}) : []}
            data={report!}
          />
        </Suspense>
      )}
    </ReportShell>
  );
}
