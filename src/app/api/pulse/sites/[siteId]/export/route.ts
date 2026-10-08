import { errorResponse } from "@/lib/analytics/http";
import { requireAnalyticsAccess } from "@/lib/analytics/sites";
import { getReport, loadEvents } from "@/lib/analytics/storage";
import { parseSiteReportQuery } from "@/lib/analytics/query";
import { reportCsv } from "@/lib/analytics/export";
import { getReportConfig } from "@/lib/analytics/config";
import { filteredEvents, summarizeEvents } from "@/lib/analytics/metrics";
import { reportWindow } from "@/lib/analytics/timezone";
import { AnalyticsError } from "@/lib/analytics/access";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    const { site } = await requireAnalyticsAccess((await params).siteId);
    const search = new URL(request.url).searchParams;
    const now = new Date();
    const query = parseSiteReportQuery(search, site, now);
    const view = search.get("view") || "overview";
    let report;
    let csv: string;
    if (view === "funnels") {
      const config = await getReportConfig(site.publicId);
      const requestedFunnel = search.get("funnel");
      const funnel = requestedFunnel ? config.funnels.find(item => item.id === requestedFunnel) : config.funnels[0];
      if (requestedFunnel && !funnel) throw new AnalyticsError("Funnel not found", 404);
      const window = reportWindow(query.range, query.timezone || site.timezone, now, query.from, query.to);
      const from = new Date(window.previousStart), to = new Date(window.end);
      const loaded = await loadEvents(site, from, to, undefined, undefined, "session");
      const visitors = loaded.sample < 1 ? await loadEvents(site, from, to) : loaded;
      report = summarizeEvents(visitors.events, query, now, { identityMode: site.identityMode, goalNames: config.goals, sample: visitors.sample, rawRetentionDays: 90, sessionEvents: loaded.events, sessionSample: loaded.sample });
      const events = filteredEvents(loaded.events, query).filter(event => Date.parse(event.time) >= window.start && Date.parse(event.time) < window.end);
      csv = reportCsv(report, view, { events, funnel });
    } else {
      report = await getReport(site, query);
      const config = view === "events" ? await getReportConfig(site.publicId) : undefined;
      csv = reportCsv(report, view, { goalNames: config?.goals });
    }
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": 'attachment;filename="pulse-report.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
