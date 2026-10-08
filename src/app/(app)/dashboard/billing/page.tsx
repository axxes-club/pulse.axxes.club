import { requireContext } from "@/lib/context";
import { ReportShell } from "@/components/pulse/report-shell";
import { BillingPanel } from "@/components/pulse/billing-panel";
import { billingRow, isPlatformOwner, monthUsage } from "@/lib/billing/store";
import { resolveEntitlement } from "@/lib/billing/entitlement";

export const metadata = { title: "Plan & billing · Pulse" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireContext();
  const search = await searchParams;
  let state: Parameters<typeof BillingPanel>[0]["state"] = null;
  try {
    const [row, owner] = await Promise.all([billingRow(ctx.tenant.id), isPlatformOwner(ctx.userId)]);
    const usage = await monthUsage(ctx.tenant.id).catch(() => null);
    const entitlement = resolveEntitlement(row);
    state = {
      status: entitlement.status,
      collecting: entitlement.collecting,
      plan: entitlement.plan?.key ?? null,
      interval: entitlement.interval,
      included: entitlement.included,
      trialEndsAt: entitlement.trialEndsAt?.toISOString() ?? null,
      periodEnd: entitlement.periodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
      hasSubscription: entitlement.hasSubscription,
      usage,
      platformOwner: owner,
    };
  } catch {
    state = null;
  }
  return (
    <ReportShell view="billing" organization={ctx.tenant.name} context={ctx}>
      <BillingPanel
        state={state}
        organization={ctx.tenant.name}
        canManage={["owner", "admin"].includes(ctx.role)}
        checkout={search.checkout ?? null}
        now={new Date().toISOString()}
      />
    </ReportShell>
  );
}
