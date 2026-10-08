import type { CheckoutInput, CheckoutStatus } from '../axxes-payments';
import { AnalyticsError } from '../analytics/access';
export type CheckoutReservation = { input: CheckoutInput; createdAt: number; id?: string; url?: string };
type Dependencies = {
  load(): Promise<CheckoutReservation|null>;
  save(p: CheckoutReservation|null): Promise<void>;
  create(i: CheckoutInput): Promise<{id:string;checkout_url:string}>;
  get(id:string): Promise<CheckoutStatus>;
  expire(id:string): Promise<CheckoutStatus>;
  reconcile(id:string): Promise<void>;
};
/** The caller holds a tenant advisory lock for this entire workflow. Persist before every side effect. */
export async function reservedCheckout(input: CheckoutInput, deps: Dependencies) {
  let pending = await deps.load();
  const created = async (reservation: CheckoutReservation) => {
    // Stripe may discard idempotency records after 24h. An uncertain old request must be
    // recovered by an operator, never automatically retried with a potentially new charge.
    if (!reservation.id && Date.now()-reservation.createdAt >= 23*3600000)
      throw new AnalyticsError('A previous checkout needs recovery. Contact support before starting another.',409);
    const result = await deps.create(reservation.input);
    const saved = {...reservation,id:result.id,url:result.checkout_url};
    await deps.save(saved);
    return saved;
  };
  if (pending) {
    if (!pending.id) pending = await created(pending);
    let checkout = await deps.get(pending.id!);
    if (checkout.product!==input.product || checkout.reference!==input.reference)
      throw new AnalyticsError('Checkout reference does not match this organization',409);
    const samePlan = 'lookupKey' in pending.input && 'lookupKey' in input && pending.input.lookupKey===input.lookupKey;
    if (checkout.state==='open' && samePlan) return {id:pending.id!,checkout_url:pending.url!};
    if (checkout.state==='open') checkout=await deps.expire(pending.id!);
    if (checkout.state!=='expired') {
      if (checkout.subscription) {
        await deps.reconcile(checkout.subscription);
        await deps.save(null);
      }
      throw new AnalyticsError('Your previous checkout completed or is processing. Refresh Plan & billing before choosing again.',409);
    }
  }
  const reservation = {input,createdAt:Date.now()};
  await deps.save(reservation);
  const result=await created(reservation);
  return {id:result.id!,checkout_url:result.url!};
}
