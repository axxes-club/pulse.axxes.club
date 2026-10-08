// Pulse plans. Every plan has every feature, unlimited apps and unlimited teammates;
// plans differ only by monthly event volume. Prices are integer US cents.
//
// An "event" is a pageview or a custom event. Performance samples (web vitals) and
// installation checks are not billed, but they are bounded by the stored-event cap below.
export type BillingInterval = "monthly" | "annual";
export type Plan = {
  key: string;
  events: number;
  monthly: number;
  annual: number;
};

export const PLANS: readonly Plan[] = [
  { key: "e25k", events: 25_000, monthly: 500, annual: 5_000 },
  { key: "e100k", events: 100_000, monthly: 900, annual: 9_000 },
  { key: "e250k", events: 250_000, monthly: 1_400, annual: 14_000 },
  { key: "e1m", events: 1_000_000, monthly: 1_900, annual: 19_000 },
  { key: "e5m", events: 5_000_000, monthly: 4_900, annual: 49_000 },
  { key: "e10m", events: 10_000_000, monthly: 7_900, annual: 79_000 },
];

export const TRIAL_DAYS = 30;
/** A trial may collect up to this many events, so a real site can be measured before paying. */
export const TRIAL_EVENTS = 1_000_000;
/** Collection continues past the plan up to this multiple, so a traffic spike never cuts a month short. */
export const OVERAGE_GRACE = 1.5;
/** Every stored row costs storage, billed or not. Performance samples stop beyond this multiple. */
export const STORED_CAP = 4;

export const planByKey = (key: string | null | undefined) =>
  PLANS.find((p) => p.key === key) ?? null;

export const lookupKey = (plan: Plan, interval: BillingInterval) =>
  `pulse_${plan.key}_${interval}`;

/** `pulse_e1m_annual` → the plan and interval; anything else (another product's price) → null. */
export function parseLookupKey(key: string | null | undefined) {
  const match = /^pulse_([a-z0-9]+)_(monthly|annual)$/.exec(key ?? "");
  const plan = match && planByKey(match[1]);
  return plan ? { plan, interval: match![2] as BillingInterval } : null;
}

/** The smallest plan that covers a monthly volume, or null above the largest plan. */
export const planFor = (events: number) =>
  PLANS.find((p) => p.events >= events) ?? null;

export const formatEvents = (n: number) =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${+(n / 1_000).toFixed(1)}k`
      : String(n);

export const formatPrice = (cents: number) =>
  `$${cents % 100 ? (cents / 100).toFixed(2) : cents / 100}`;
