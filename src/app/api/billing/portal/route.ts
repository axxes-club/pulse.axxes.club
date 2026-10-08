import { errorResponse } from "@/lib/analytics/http";
import { AnalyticsError } from "@/lib/analytics/access";
import { createPortalSession, PaymentsError } from "@/lib/axxes-payments";
import { requireBillingAdmin, pulseOrigin } from "@/lib/billing/routes";
import { billingRow } from "@/lib/billing/store";

/** Opens the AXXES Payments billing portal (card, invoices, cancel) for the organization's own subscription. */
export async function POST(request: Request) {
  try {
    const ctx = await requireBillingAdmin(request);
    const row = await billingRow(ctx.tenant.id);
    if (!row.subscriptionId) throw new AnalyticsError("This organization has no subscription to manage", 404);
    const portal = await createPortalSession(row.subscriptionId, `${pulseOrigin(request)}/dashboard/billing`);
    return Response.json({ url: portal.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PaymentsError) {
      console.error("pulse_portal_failed", e.status);
      return Response.json({ error: "Billing management is unavailable right now." }, { status: 502 });
    }
    return errorResponse(e);
  }
}
