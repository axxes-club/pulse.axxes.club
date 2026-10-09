// Pure rules deciding what an organization's Pulse billing state allows. No I/O, so they are unit-tested.
import {
  OVERAGE_GRACE,
  STORED_CAP,
  TRIAL_EVENTS,
  planByKey,
  type BillingInterval,
  type Plan,
} from "./plans";

export type BillingRow = {
  tenantId: string;
  trialEndsAt: Date | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  plan: string | null;
  interval: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  ownerGrantAt: Date | null;
};

export type EntitlementStatus =
  | "owner"
  | "active"
  | "past_due"
  | "trial"
  | "trial_ended"
  | "canceled";

export type Entitlement = {
  status: EntitlementStatus;
  /** False when new events are refused. Reports and exports stay available either way. */
  collecting: boolean;
  plan: Plan | null;
  interval: BillingInterval | null;
  /** Included monthly events; null means unlimited. */
  included: number | null;
  trialEndsAt: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasSubscription: boolean;
};

/** Stripe statuses that keep paid access open. `past_due` keeps access while Stripe retries the card. */
const PAID = ["trialing", "active", "past_due"];
/** A renewal event can arrive a little after the period ends; never close access in that gap. */
const RENEWAL_LEEWAY_MS = 2 * 86_400_000;

export function subscriptionIsLive(row: Pick<BillingRow, "subscriptionStatus" | "currentPeriodEnd">, now: Date) {
  return (
    !!row.subscriptionStatus &&
    PAID.includes(row.subscriptionStatus) &&
    (!row.currentPeriodEnd || row.currentPeriodEnd.getTime() + RENEWAL_LEEWAY_MS >= now.getTime())
  );
}

export function resolveEntitlement(row: BillingRow, now = new Date()): Entitlement {
  const base = {
    trialEndsAt: row.trialEndsAt,
    periodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    hasSubscription: !!row.subscriptionId,
  };
  const inTrial = !!row.trialEndsAt && row.trialEndsAt.getTime() > now.getTime();
  if (row.ownerGrantAt)
    return { ...base, status: "owner", collecting: true, plan: null, interval: null, included: null };
  const plan = planByKey(row.plan);
  if (plan && subscriptionIsLive(row, now)) {
    const interval = row.interval === "annual" ? "annual" : "monthly";
    return {
      ...base,
      status: row.subscriptionStatus === "past_due" ? "past_due" : "active",
      collecting: true,
      plan,
      interval,
      // Choosing a plan during the trial never shrinks what the trial already allows.
      included: inTrial ? Math.max(plan.events, TRIAL_EVENTS) : plan.events,
    };
  }
  if (inTrial)
    return { ...base, status: "trial", collecting: true, plan: null, interval: null, included: TRIAL_EVENTS };
  return {
    ...base,
    status: row.subscriptionId ? "canceled" : "trial_ended",
    collecting: false,
    plan: null,
    interval: null,
    included: 0,
  };
}

export type Usage = { billable: number; stored: number };
export type Allowance = { billable: number | null; stored: number | null };

/** The hard ceilings collection enforces this month; null means unlimited. */
export function allowanceFor(entitlement: Entitlement): Allowance {
  if (!entitlement.collecting) return { billable: 0, stored: 0 };
  if (entitlement.included === null) return { billable: null, stored: null };
  return {
    billable: Math.floor(entitlement.included * OVERAGE_GRACE),
    stored: entitlement.included * STORED_CAP,
  };
}

export type Admission = "accept" | "accept_billable_only" | "refuse";

/**
 * Decides a batch before it is written. Past the billed ceiling, nothing new is stored.
 * Past the stored ceiling, only billed events (pageviews and custom events) are kept and
 * performance samples are dropped, so a noisy page cannot run up storage.
 */
export function admit(usage: Usage, allowance: Allowance): Admission {
  if (allowance.billable !== null && usage.billable >= allowance.billable) return "refuse";
  if (allowance.stored !== null && usage.stored >= allowance.stored) return "accept_billable_only";
  return "accept";
}

/** Events that count toward the plan. Performance samples and install checks are free. */
// Passive measurements (performance, scroll reach, engaged time) are stored within the storage
// allowance but not charged as events, so turning them on never multiplies a customer's bill.
const MEASUREMENTS = new Set(["web_vital", "pulse.verify", "scroll_depth", "engagement"]);
export const isBillable = (name: string) => !MEASUREMENTS.has(name);

export const usageMonth = (now = new Date()) =>
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

export const daysLeft = (until: Date | null, now = new Date()) =>
  until ? Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 86_400_000)) : 0;
