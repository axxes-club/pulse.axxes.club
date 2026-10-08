import { z } from "zod";
import { readJson, errorResponse } from "@/lib/analytics/http";
import { AnalyticsError } from "@/lib/analytics/access";
import { changeSubscription, PaymentsError } from "@/lib/axxes-payments";
import { requireBillingAdmin } from "@/lib/billing/routes";
import { applySubscription, billingRow } from "@/lib/billing/store";
import { resolveEntitlement } from "@/lib/billing/entitlement";
import { lookupKey, planByKey } from "@/lib/billing/plans";

const body = z.object({ plan: z.string().max(20), interval: z.enum(["monthly", "annual"]) }).strict();

/** Moves the organization's own subscription to another plan in place; Stripe prorates the difference. */
export async function POST(request: Request) {
  try {
    const ctx = await requireBillingAdmin(request);
    const input = body.parse(await readJson(request));
    const plan = planByKey(input.plan);
    if (!plan) throw new AnalyticsError("Choose a Pulse plan");
    const row = await billingRow(ctx.tenant.id);
    const entitlement = resolveEntitlement(row);
    if (!row.subscriptionId || !["active", "past_due"].includes(entitlement.status))
      throw new AnalyticsError("This organization has no plan to change. Choose a plan instead.", 409);
    if (entitlement.plan?.key === plan.key && entitlement.interval === input.interval)
      throw new AnalyticsError("This organization is already on that plan", 409);
    // The subscription comes from this organization's own row, so nobody can move another's.
    const snapshot = await changeSubscription(row.subscriptionId, lookupKey(plan, input.interval));
    await applySubscription(snapshot, ctx.userId);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PaymentsError) {
      console.error("pulse_plan_change_failed", e.status);
      return Response.json(
        { error: "The plan could not be changed right now. Your current plan is unchanged." },
        { status: 502 },
      );
    }
    return errorResponse(e);
  }
}
