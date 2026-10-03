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
      <ReportShell view={view} organization={ctx.tenant.name}>
        <Suspense>
          <ReportView view={view} organizationKey={ctx.tenant.id} />
        </Suspense>
      </ReportShell>
    );
  let error = "";
  let sites: Awaited<ReturnType<typeof listSites>> = [];
  try {
    sites = await listSites();
  } catch {
    error =
      "Analytics setup is not available yet. Your organization data is safe; try again once Pulse storage has been configured.";
  }
  const selected = sites.find((s) => s.publicId === search.site) || sites[0];
  if (search.site && !sites.some((s) => s.publicId === search.site))
    error = "That app is not available in this organization.";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) if (v) params.set(k, v);
  if (!params.has("environment") && selected)
    params.set("environment", selected.environment);
  const query = parseReportQuery(params);
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
  if (selected && !error) {
    try {
      [events, config] = await Promise.all([
        getEvents(selected, query.range),
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
      organization={ctx.tenant.name}
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
            funnels={config.funnels}
            goalNames={config.goals}
            canManage={["owner", "admin"].includes(ctx.role)}
            events={view === "funnels" ? events : []}
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
