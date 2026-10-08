import {
  errorResponse,
  readJson,
  requireSameOrigin,
} from "@/lib/analytics/http";
import { getReportConfig, createGoal, deleteGoal } from "@/lib/analytics/config";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    return Response.json(await getReportConfig((await params).siteId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    requireSameOrigin(request);
    return Response.json(
      await createGoal((await params).siteId, await readJson(request)),
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    requireSameOrigin(request);
    return Response.json(await deleteGoal((await params).siteId, await readJson(request)));
  } catch (e) {
    return errorResponse(e);
  }
}
