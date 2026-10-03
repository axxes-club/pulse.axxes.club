import {
  readJson,
  errorResponse,
  requireSameOrigin,
} from "@/lib/analytics/http";
import { listSites, createSite } from "@/lib/analytics/sites";
export async function GET() {
  try {
    return Response.json(
      { sites: await listSites() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    return Response.json(await createSite(await readJson(request)), {
      status: 201,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
