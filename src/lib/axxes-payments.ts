import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * AXXES Payments client (payments.axxes.app). Same file in every selling product.
 *
 * Payments takes the money on AXXES's Stripe account; this product keeps its own
 * entitlement records and only grants access after reading a status back from
 * Payments on the server (a return redirect or a signed event), never from a URL.
 *
 * Env: AXXES_PAYMENTS_KEY (this product's key), AXXES_PAYMENTS_EVENT_SECRET,
 * optional AXXES_PAYMENTS_MODE=test for sandbox, AXXES_PAYMENTS_URL for staging.
 */

export type PaymentsMode = "live" | "test"
export const paymentsMode = (): PaymentsMode => (process.env.AXXES_PAYMENTS_MODE === "test" ? "test" : "live")
export const paymentsConfigured = () => (process.env.AXXES_PAYMENTS_KEY?.length ?? 0) >= 32
const base = () => process.env.AXXES_PAYMENTS_URL ?? "https://payments.axxes.app"

export type SubscriptionSnapshot = {
  id: string
  status: "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused"
  product: string
  reference: string
  price: string | null
  lookup_key: string | null
  interval: "day" | "week" | "month" | "year" | null
  interval_count: number | null
  current_period_end: number | null
  cancel_at_period_end: boolean
  trial_end: number | null
  canceled_at: number | null
  ended_at: number | null
}
export type CheckoutStatus = {
  id: string
  mode: PaymentsMode
  state: "open" | "processing" | "paid" | "no_payment_due" | "expired"
  product: string
  reference: string
  amount_total: number | null
  currency: string | null
  subscription: string | null
}
export type PaymentsEvent = {
  id: string
  type: "checkout.updated" | "subscription.updated"
  trigger: string
  mode: PaymentsMode
  created: number
  product: string
  reference: string
  checkout?: Omit<CheckoutStatus, "mode" | "product" | "reference"> & { payment_status: string }
  subscription?: SubscriptionSnapshot
}

export class PaymentsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.AXXES_PAYMENTS_KEY
  if (!key || key.length < 32) throw new PaymentsError(503, "AXXES Payments is not configured")
  const response = await fetch(base() + path, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { ...init.headers, authorization: `Bearer ${key}`, "content-type": "application/json" },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new PaymentsError(response.status, body?.error ?? "AXXES Payments request failed")
  return body as T
}

export type CheckoutInput = {
  product: string
  /** Your own immutable order or account reference; comes back on every status and event. */
  reference: string
  /** Same key for retries of the exact same purchase. 12–100 letters, digits, _ or -. */
  idempotencyKey: string
  returnUrl: string
  email?: string
  quantity?: number
} & (
  | { purchase: "subscription"; lookupKey: string; trialDays?: number }
  | { purchase?: "payment"; lookupKey: string }
  | { purchase?: "payment"; amount: number; currency?: "usd"; description: string }
)

export function createCheckout(input: CheckoutInput) {
  const { idempotencyKey, ...quote } = input
  return call<{ id: string; mode: PaymentsMode; checkout_url: string }>("/api/v1/checkouts", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({ mode: paymentsMode(), ...quote }),
  })
}

export function getCheckout(id: string) {
  if (!/^cs_(test|live)_[A-Za-z0-9]{20,250}$/.test(id)) throw new PaymentsError(400, "Invalid checkout")
  return call<CheckoutStatus>(`/api/v1/checkouts/${id}`)
}

export function getSubscription(id: string) {
  if (!/^sub_[A-Za-z0-9]{8,250}$/.test(id)) throw new PaymentsError(400, "Invalid subscription")
  return call<SubscriptionSnapshot & { mode: PaymentsMode }>(`/api/v1/subscriptions/${id}?mode=${paymentsMode()}`)
}

/** This product's subscriptions for one of its references, newest first (Stripe search; may lag ~1 minute). */
export async function listSubscriptions(reference: string) {
  const query = new URLSearchParams({ reference, mode: paymentsMode() })
  return (await call<{ data: SubscriptionSnapshot[] }>(`/api/v1/subscriptions?${query}`)).data
}

/** Billing portal link (update card, cancel). Check the signed-in user owns the subscription first. */
export function createPortalSession(subscription: string, returnUrl: string) {
  return call<{ url: string }>("/api/v1/portal-sessions", {
    method: "POST",
    body: JSON.stringify({ mode: paymentsMode(), subscription, returnUrl }),
  })
}

/** Verifies `AXXES-Payments-Signature: t=<unix>,v1=<hex HMAC-SHA256("<t>.<body>")>`. */
export function verifyPaymentsEvent(body: string, header: string | null, now = Math.floor(Date.now() / 1000)): PaymentsEvent | null {
  const secret = process.env.AXXES_PAYMENTS_EVENT_SECRET
  if (!secret || secret.length < 32 || !header) return null
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]))
  const t = Number(parts.t)
  if (!Number.isInteger(t) || !parts.v1 || Math.abs(now - t) > 300) return null
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")
  if (parts.v1.length !== expected.length || !timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected))) return null
  try {
    return JSON.parse(body) as PaymentsEvent
  } catch {
    return null
  }
}

/** Statuses that keep paid access open. `past_due` keeps access while Stripe retries the card. */
export const ACCESS_STATUSES: SubscriptionSnapshot["status"][] = ["trialing", "active", "past_due"]

/**
 * Moves a subscription to another of this product's prices in place, prorated by Stripe, so an
 * upgrade never means a second subscription. Check the signed-in user owns the subscription first.
 */
export function changeSubscription(id: string, lookupKey: string) {
  if (!/^sub_[A-Za-z0-9]{8,250}$/.test(id)) throw new PaymentsError(400, "Invalid subscription")
  return call<SubscriptionSnapshot & { mode: PaymentsMode }>(`/api/v1/subscriptions/${id}`, {
    method: "POST",
    body: JSON.stringify({ mode: paymentsMode(), lookupKey }),
  })
}
