import { errorResponse } from "@/lib/analytics/http";
import { requireAnalyticsAccess } from "@/lib/analytics/sites";
import { connectionStatus } from "@/lib/analytics/storage";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    const { site } = await requireAnalyticsAccess((await params).siteId);
    return Response.json(await connectionStatus(site), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
