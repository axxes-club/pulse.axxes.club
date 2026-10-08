import { errorResponse } from "@/lib/analytics/http";
import { requireAnalyticsAccess } from "@/lib/analytics/sites";
import { getReport } from "@/lib/analytics/storage";
import { parseReportQuery } from "@/lib/analytics/query";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    const { site } = await requireAnalyticsAccess((await params).siteId);
    const report = await getReport(
      site,
      parseReportQuery(new URL(request.url).searchParams),
    );
    const csv = [
      "metric,value",
      `Visitors,${report.visitors}`,
      `Sessions,${report.sessions}`,
      `Pageviews,${report.pageviews}`,
      `Conversions,${report.conversions}`,
      `Conversion rate,${report.conversionRate.toFixed(2)}`,
      ...(report.sample ? [`Estimated from share of visitors,${report.sample.toFixed(4)}`] : []),
    ].join("\n");
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
