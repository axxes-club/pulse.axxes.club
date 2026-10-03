import { readJson, errorResponse } from "@/lib/analytics/http";
import { validateBatch } from "@/lib/analytics/validation";
import { verifyCredential } from "@/lib/analytics/sites";
import { persistBatch } from "@/lib/analytics/storage";
import { AnalyticsError } from "@/lib/analytics/access";
export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token)
      throw new AnalyticsError("Scoped server credentials are required", 401);
    const batch = validateBatch(await readJson(request));
    if (batch.schemaVersion !== 1)
      throw new AnalyticsError("Use schemaVersion 1");
    const site = await verifyCredential(token, batch.siteId);
    if (!site) throw new AnalyticsError("Invalid or revoked credential", 401);
    return Response.json(
      await persistBatch(
        site,
        batch,
        { ip: "server", userAgent: "trusted-server" },
        true,
      ),
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
