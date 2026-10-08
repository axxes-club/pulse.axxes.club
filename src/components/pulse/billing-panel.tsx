"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlanPicker } from "./plan-picker";
import { Icon } from "./icon";
import { OVERAGE_GRACE, formatEvents, formatPrice, planByKey, planFor, type BillingInterval } from "@/lib/billing/plans";
import type { EntitlementStatus } from "@/lib/billing/entitlement";

type State = {
  status: EntitlementStatus;
  collecting: boolean;
  plan: string | null;
  interval: BillingInterval | null;
  included: number | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasSubscription: boolean;
  usage: { billable: number; stored: number; refused: number } | null;
  platformOwner: boolean;
} | null;

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
const daysUntil = (iso: string | null, now: string) =>
  iso ? Math.max(0, Math.ceil((Date.parse(iso) - Date.parse(now)) / 86_400_000)) : 0;

const RETURN_NOTICES: Record<string, string> = {
  success: "Payment confirmed. Your plan is active and collection continues without interruption.",
  processing: "Your payment is processing. Your plan turns on as soon as it clears, usually within a minute.",
  incomplete: "Checkout was not completed, so you have not been charged.",
};

export function BillingPanel({
  state,
  organization,
  canManage,
  checkout,
  now,
}: {
  state: State;
  organization: string;
  canManage: boolean;
  checkout: string | null;
  now: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function post(path: string, body?: unknown, tag = path) {
    setPending(tag);
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Something went wrong. Try again.");
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setConfirming(null);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setPending(null);
    }
  }

  if (!state)
    return (
      <div className="empty-report">
        <Icon name="help" size={35} />
        <h2>Billing is not available right now.</h2>
        <p>Your plan and data are safe. Try again in a moment.</p>
      </div>
    );

  const now_ = new Date(now);
  const monthStart = Date.UTC(now_.getUTCFullYear(), now_.getUTCMonth(), 1);
  const monthEnd = Date.UTC(now_.getUTCFullYear(), now_.getUTCMonth() + 1, 1);
  const elapsed = Math.max((now_.getTime() - monthStart) / (monthEnd - monthStart), 1 / 31);
  const billable = state.usage?.billable ?? 0;
  const projected = Math.round(billable / elapsed);
  const recommended = planFor(Math.max(projected, 1))?.key ?? null;
  const included = state.included;
  const percent = included ? Math.min(100, (billable / included) * 100) : 0;
  const paidPlan = planByKey(state.plan);
  const live = state.status === "active" || state.status === "past_due";

  const action = (plan: string, interval: BillingInterval, isCurrent: boolean) => {
    if (!canManage || state.status === "owner") return null;
    if (isCurrent) return <span className="button secondary small plan-action" aria-disabled="true">Your plan</span>;
    const key = `${plan}:${interval}`;
    if (live) {
      if (confirming === key)
        return (
          <div className="plan-confirm">
            <button className="button primary small" disabled={!!pending} onClick={() => post("/api/billing/change", { plan, interval }, key)}>
              {pending === key ? "Switching…" : "Confirm switch"}
            </button>
            <button className="text-button" onClick={() => setConfirming(null)}>Cancel</button>
            <small>
              {(planByKey(plan)?.events ?? 0) < billable
                ? `You've already used ${formatEvents(billable)} this month, more than this plan includes.`
                : "Prorated on your next invoice. Same subscription."}
            </small>
          </div>
        );
      return (
        <button className="button secondary small plan-action" disabled={!!pending} onClick={() => setConfirming(key)}>
          Switch
        </button>
      );
    }
    return (
      <button
        className={`button ${plan === recommended ? "primary" : "secondary"} small plan-action`}
        disabled={!!pending}
        onClick={() => post("/api/billing/checkout", { plan, interval }, key)}
      >
        {pending === key ? "Opening checkout…" : state.status === "trial" ? "Choose" : "Subscribe"}
      </button>
    );
  };

  return (
    <div className="billing">
      <div className="workspace-title">
        <div>
          <h1>Plan & billing</h1>
          <p>
            {organization} · Every feature on every plan. You only choose how many events a month you need.
          </p>
        </div>
        {canManage && state.hasSubscription && state.status !== "owner" && (
          <button className="button secondary small" disabled={!!pending} onClick={() => post("/api/billing/portal")}>
            Manage billing <Icon name="external" size={13} />
          </button>
        )}
      </div>

      {checkout && RETURN_NOTICES[checkout] && (
        <p className={`billing-notice ${checkout === "success" ? "good" : ""}`} role="status">
          {RETURN_NOTICES[checkout]}
        </p>
      )}

      <div className="billing-summary">
        <section className="billing-card">
          <span className="tiny-label">PLAN</span>
          {state.status === "owner" ? (
            <>
              <h2>Owner · Free access</h2>
              <p>Unlimited events in this organization. Usage is still recorded below.</p>
            </>
          ) : state.status === "trial" ? (
            <>
              <h2>
                Free trial <span className="status-pill">{daysUntil(state.trialEndsAt, now)} days left</span>
              </h2>
              <p>
                Everything included, up to {formatEvents(included ?? 0)} events this month. No card needed until{" "}
                {day(state.trialEndsAt)}. Choose a plan now and the rest of your trial still stays free.
              </p>
            </>
          ) : live && paidPlan ? (
            <>
              <h2>
                {formatEvents(paidPlan.events)} events / month{" "}
                {state.status === "past_due" ? (
                  <span className="status-pill warn">Payment failed</span>
                ) : state.cancelAtPeriodEnd ? (
                  <span className="status-pill warn">Ends {day(state.periodEnd)}</span>
                ) : (
                  <span className="status-pill good">Active</span>
                )}
              </h2>
              <p>
                {formatPrice(state.interval === "annual" ? paidPlan.annual : paidPlan.monthly)}{" "}
                {state.interval === "annual" ? "per year" : "per month"}
                {state.status === "past_due"
                  ? ". Update your card in Manage billing to keep collecting. Stripe retries the payment automatically."
                  : state.cancelAtPeriodEnd
                    ? `. Collection stops on ${day(state.periodEnd)}. Resume from Manage billing.`
                    : state.periodEnd
                      ? `. Renews ${day(state.periodEnd)}.`
                      : "."}
              </p>
            </>
          ) : (
            <>
              <h2>
                Collection paused <span className="status-pill warn">{state.status === "canceled" ? "Plan ended" : "Trial ended"}</span>
              </h2>
              <p>
                New events are not being recorded. Your reports, history and exports are still here. Choose a plan to resume
                collection right away.
              </p>
            </>
          )}
        </section>

        <section className="billing-card">
          <span className="tiny-label">THIS MONTH</span>
          {state.usage ? (
            <>
              <h2>
                {billable.toLocaleString("en-US")}
                <small> {included === null ? "events" : `of ${formatEvents(included)} events`}</small>
              </h2>
              {included !== null && included > 0 && (
                <div
                  className={`usage-bar ${percent >= 100 ? "over" : percent >= 80 ? "near" : ""}`}
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percent)}
                  aria-label="Share of monthly events used"
                >
                  <i style={{ width: `${percent}%` }} />
                </div>
              )}
              <p>
                On pace for about {formatEvents(projected)} this month. Resets{" "}
                {new Date(monthEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })} (UTC).
                {included !== null && included > 0 && billable >= included &&
                  ` You're over your plan. Collection continues up to ${formatEvents(Math.floor(included * OVERAGE_GRACE))} with no extra charge.`}
                {state.usage.refused > 0 &&
                  ` ${state.usage.refused.toLocaleString("en-US")} events were not recorded because the limit was reached.`}
              </p>
            </>
          ) : (
            <p>Usage is temporarily unavailable.</p>
          )}
        </section>
      </div>

      {message && (
        <p className="billing-notice warn" role="alert">
          {message}
        </p>
      )}

      {state.status !== "owner" && (
        <>
          <h2 className="billing-heading">{live ? "Change plan" : "Choose a plan"}</h2>
          {!canManage && <p className="muted billing-sub">Only an organization owner or admin can change the plan.</p>}
          <PlanPicker
            current={{ plan: state.plan, interval: state.interval }}
            recommended={recommended}
            action={action}
            busy={!!pending}
            confirming={confirming}
          />
        </>
      )}

      {state.platformOwner && canManage && (
        <section className="billing-card owner-card">
          <span className="tiny-label">AXXES OWNER</span>
          <p>
            {state.status === "owner"
              ? "This organization uses Pulse free under your owner account."
              : "Your account can use Pulse free. Turn it on for this organization only."}
          </p>
          <button
            className="button secondary small"
            disabled={!!pending}
            onClick={() => post("/api/billing/owner", { granted: state.status !== "owner" })}
          >
            {state.status === "owner" ? "Remove owner access" : "Use owner access here"}
          </button>
        </section>
      )}
    </div>
  );
}
