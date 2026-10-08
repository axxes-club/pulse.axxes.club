import { z } from "zod";
import { readJson, errorResponse } from "@/lib/analytics/http";
import { AnalyticsError } from "@/lib/analytics/access";
import { requireBillingAdmin } from "@/lib/billing/routes";
import { isPlatformOwner, setOwnerGrant } from "@/lib/billing/store";

const body = z.object({ granted: z.boolean() }).strict();

/** The AXXES owner turns free owner access on or off for an organization they administer. */
export async function POST(request: Request) {
  try {
    const ctx = await requireBillingAdmin(request);
    if (!(await isPlatformOwner(ctx.userId))) throw new AnalyticsError("Owner access is not available for this account", 403);
    const { granted } = body.parse(await readJson(request));
    await setOwnerGrant(ctx.tenant.id, ctx.userId, granted);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
