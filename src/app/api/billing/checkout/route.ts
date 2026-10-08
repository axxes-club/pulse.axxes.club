import { randomUUID } from "node:crypto";
import { reservedCheckout } from "@/lib/billing/checkout-reservation";
import { z } from "zod";
import { readJson, errorResponse } from "@/lib/analytics/http";
import { AnalyticsError } from "@/lib/analytics/access";
import { createCheckout, getCheckout, getSubscription, expireCheckout, PaymentsError } from "@/lib/axxes-payments";
import { requireBillingAdmin, pulseOrigin } from "@/lib/billing/routes";
import { audit, withCheckoutLock } from "@/lib/billing/store";
import { resolveEntitlement, daysLeft } from "@/lib/billing/entitlement";
import { lookupKey, planByKey } from "@/lib/billing/plans";

const body = z.object({ plan: z.string().max(20), interval: z.enum(["monthly", "annual"]) }).strict();

/** An owner or admin starts a Pulse plan for the active organization on AXXES Payments. */
export async function POST(request: Request) {
  try {
    const ctx = await requireBillingAdmin(request);
    const input = body.parse(await readJson(request));
    const plan = planByKey(input.plan);
    if (!plan) throw new AnalyticsError("Choose a Pulse plan");
    const checkout = await withCheckoutLock(ctx.tenant.id, async reservation => {
      const entitlement = resolveEntitlement(await reservation.row());
      if (entitlement.status === "owner") throw new AnalyticsError("This organization already has free owner access", 409);
      if (entitlement.status === "active" || entitlement.status === "past_due")
        throw new AnalyticsError("This organization already has a plan. Change it from Plan & billing.", 409);
      const key = lookupKey(plan, input.interval);
      // Whatever is left of the free trial carries over, so choosing early never costs a day.
      const trialDays = Math.min(30, daysLeft(entitlement.status === "trial" ? entitlement.trialEndsAt : null));
      return reservedCheckout({
        product: "pulse",
        purchase: "subscription",
        lookupKey: key,
        reference: ctx.tenant.id,
        idempotencyKey: `pulse-${randomUUID()}`,
        returnUrl: `${pulseOrigin(request)}/api/axxes-payments/return`,
        email: ctx.user.email || undefined,
        ...(trialDays > 0 ? { trialDays } : {}),
      }, { ...reservation, create: createCheckout, get: getCheckout, expire: expireCheckout,
        reconcile: async id => { await reservation.apply(await getSubscription(id), ctx.userId); } });
    });
    await audit(ctx.tenant.id, "checkout_started", ctx.userId, { lookupKey: lookupKey(plan,input.interval) });
    return Response.json({ url: checkout.checkout_url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PaymentsError) {
      console.error("pulse_checkout_failed", e.status);
      return Response.json({ error: "Checkout is unavailable right now. Try again shortly." }, { status: 502 });
    }
    return errorResponse(e);
  }
}
