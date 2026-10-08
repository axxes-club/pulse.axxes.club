"use client";
import { useState } from "react";
import { PLANS, formatEvents, formatPrice, type BillingInterval } from "@/lib/billing/plans";
import { Icon } from "./icon";

export const INCLUDED = [
  "Unlimited apps and environments",
  "Unlimited teammates",
  "Live view, audience, sources and campaigns",
  "Goals, funnels and retention",
  "Core Web Vitals performance",
  "Server events and revenue",
  "AXXES app integrations",
  "Embeddable reports and CSV export",
  "Consent controls, no raw IPs stored",
];

export function PlanPicker({
  current,
  recommended,
  action,
  busy,
  confirming,
}: {
  current?: { plan: string | null; interval: BillingInterval | null };
  recommended?: string | null;
  /** Renders the call to action for a plan; marketing pages link, the workspace buys. */
  action: (plan: string, interval: BillingInterval, isCurrent: boolean) => React.ReactNode;
  busy?: boolean;
  confirming?: string | null;
}) {
  const [interval, setInterval] = useState<BillingInterval>(current?.interval ?? "monthly");
  return (
    <div className="plan-picker" aria-busy={busy || undefined}>
      <div className="interval-toggle" role="radiogroup" aria-label="Billing period">
        {(["monthly", "annual"] as const).map((value) => (
          <button
            key={value}
            role="radio"
            aria-checked={interval === value}
            className={interval === value ? "active" : ""}
            onClick={() => setInterval(value)}
          >
            {value === "monthly" ? "Monthly" : "Annual"}
            {value === "annual" && <span className="save-pill">2 months free</span>}
          </button>
        ))}
      </div>
      <div className="plan-grid">
        {PLANS.map((plan) => {
          const isCurrent = current?.plan === plan.key && current.interval === interval;
          const perMonth = interval === "annual" ? plan.annual / 12 : plan.monthly;
          return (
            <article
              key={plan.key}
              className={`plan-card ${isCurrent ? "current" : ""} ${recommended === plan.key ? "recommended" : ""} ${confirming === `${plan.key}:${interval}` ? "confirming" : ""}`}
            >
              {recommended === plan.key && !isCurrent && <span className="plan-flag">Fits your traffic</span>}
              {isCurrent && <span className="plan-flag current">Current plan</span>}
              <span className="plan-volume">{formatEvents(plan.events)}</span>
              <span className="plan-unit">events / month</span>
              <strong className="plan-price">
                {formatPrice(Math.round(perMonth))}
                <small>/mo</small>
              </strong>
              <span className="plan-billed">
                {interval === "annual" ? `${formatPrice(plan.annual)} billed yearly` : "Billed monthly"}
              </span>
              {action(plan.key, interval, isCurrent)}
            </article>
          );
        })}
      </div>
      <p className="plan-footnote">Prices in USD. Change plans or cancel any time.</p>
      <div className="plan-included">
        <span className="tiny-label">EVERY PLAN INCLUDES</span>
        <ul>
          {INCLUDED.map((item) => (
            <li key={item}>
              <Icon name="check" size={14} /> {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
