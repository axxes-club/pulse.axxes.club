import Link from "next/link";
import { entitlementFor, monthUsage } from "@/lib/billing/store";
import { daysLeft } from "@/lib/billing/entitlement";
import { formatEvents } from "@/lib/billing/plans";

/**
 * One line above reports when billing needs attention: a trial about to end, a paused plan,
 * a failed payment, or usage close to the plan. Silent otherwise, and silent if billing
 * cannot be read, so a billing outage never blocks reports.
 */
export async function BillingNotice({ tenantId }: { tenantId: string }) {
  let text = "";
  let tone: "warn" | "" = "";
  try {
    const entitlement = await entitlementFor(tenantId);
    if (entitlement.status === "owner") return null;
    if (!entitlement.collecting) {
      text = "Collection is paused. Your reports and history are safe. Choose a plan to start recording again.";
      tone = "warn";
    } else if (entitlement.status === "past_due") {
      text = "Your last payment failed. Update your card to keep collecting.";
      tone = "warn";
    } else if (entitlement.status === "trial" && daysLeft(entitlement.trialEndsAt) <= 7) {
      const left = daysLeft(entitlement.trialEndsAt);
      text = `Your free trial ends in ${left} ${left === 1 ? "day" : "days"}. Choose a plan to keep collecting without a gap.`;
    } else if (entitlement.included) {
      const usage = await monthUsage(tenantId);
      const share = usage.billable / entitlement.included;
      if (share >= 1) {
        text = `You've used ${formatEvents(usage.billable)} of ${formatEvents(entitlement.included)} events this month. Collection continues for now. Move to a larger plan to stay covered.`;
        tone = "warn";
      } else if (share >= 0.8)
        text = `You've used ${Math.floor(share * 100)}% of this month's ${formatEvents(entitlement.included)} events.`;
    }
  } catch {
    return null;
  }
  if (!text) return null;
  return (
    <p className={`billing-notice ${tone}`} role="status">
      {text}{" "}
      <Link href="/dashboard/billing" target="_top">
        Plan & billing →
      </Link>
    </p>
  );
}
