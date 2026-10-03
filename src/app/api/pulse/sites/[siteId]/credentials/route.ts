import { errorResponse, requireSameOrigin } from "@/lib/analytics/http";
import { issueServerCredential } from "@/lib/analytics/sites";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    requireSameOrigin(request);
    return Response.json(
      { credential: await issueServerCredential((await params).siteId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
