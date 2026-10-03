import { Suspense } from "react";
import Link from "next/link";
import { requireContext } from "@/lib/context";
import { listSites } from "@/lib/analytics/sites";
import { getEvents } from "@/lib/analytics/storage";
import { parseReportQuery } from "@/lib/analytics/query";
import { summarizeEvents } from "@/lib/analytics/metrics";
import { ReportShell } from "./report-shell";
import { ReportView } from "./report-view";
import { getReportConfig } from "@/lib/analytics/config";
import { reportWindow } from "@/lib/analytics/timezone";
import { Icon } from "./icon";
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
  if(selected && search.environment && selected.environment !== search.environment) selected = sites.find(s=>s.name === selected!.name && s.environment === search.environment) || selected;
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
  let events: Awaited<ReturnType<typeof getEvents>> = [];
  if (selected && !error && view !== "settings") {
    try {
      [events, config] = await Promise.all([
        getEvents(selected, query.range,new Date(selectedWindow.previousStart)),
        getReportConfig(selected.publicId),
      ]);
    } catch {
      error =
        "Pulse could not load your analytics. Check storage configuration or try again.";
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
      {error ? (
        <div className="empty-report">
          <Icon name="help" size={35} />
          <h2>Let’s get Pulse connected.</h2>
          <p>{error}</p>
          <Link href="/dashboard" className="button secondary">
            Try again
          </Link>
        </div>
      ) : !selected ? (
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
            timezone={selected.timezone}
            funnels={config.funnels}
            goalNames={config.goals}
            canManage={["owner", "admin"].includes(ctx.role)}
            events={view === "funnels" ? events.filter(e=>{const w=selectedWindow;const t=Date.parse(e.time);return t>=w.start&&t<w.end&&e.environment===query.environment&&(!query.source||query.source===e.source)&&(!query.path||query.path===e.path)&&(!query.country||query.country===e.country)}) : []}
            data={summarizeEvents(events, query, new Date(), {
              identityMode: selected.identityMode,
              goalNames: config.goals,
            })}
          />
        </Suspense>
      )}
    </ReportShell>
  );
}
