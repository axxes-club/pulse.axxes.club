import { expect,it } from 'vitest';
import { reservedCheckout, type CheckoutReservation } from '../../src/lib/billing/checkout-reservation';
const input = { product:'pulse',purchase:'subscription',lookupKey:'pulse_e25k_monthly', reference:'tenant',returnUrl:'https://pulse.axxes.app/api/axxes-payments/return',idempotencyKey:'pulse-stable-key' } as const;
function fixture() {
 let pending: CheckoutReservation|null=null;
 let calls=0, expires=0, reconciled=0, fail=false;
 const sessions = new Map<string,any>();
 const deps={ load:async()=>pending, save:async(p:CheckoutReservation|null)=>{pending=p;},
 create:async(i:any)=>{calls++; expect(pending?.input).toEqual(i); const id='cs_test_'+i.idempotencyKey; sessions.set(id,{id,state:'open',subscription:null,product:'pulse',reference:'tenant'}); if(fail){fail=false;throw new Error('response lost');}return {id,checkout_url:'https://payments.axxes.app/checkout/'+id};},
 get:async(id:string)=>sessions.get(id),expire:async(id:string)=>{expires++;const s=sessions.get(id);if(s.state==='open')s.state='expired';return s;}, reconcile:async()=>{reconciled++;} };
 return {deps,sessions,counts:()=>({calls,expires,reconciled}), fail:()=>{fail=true;},pending:()=>pending};
}
it('reuses one open checkout and persists its input before contacting Payments',async()=>{
 const f=fixture();const first=await reservedCheckout(input,f.deps);
 expect(await reservedCheckout({...input,idempotencyKey:'different'},f.deps)).toEqual(first);
 expect(f.counts().calls).toBe(1);
});
it('recovers a lost creation response with the persisted idempotency key and original trial payload',async()=>{
 const f=fixture();f.fail();await expect(reservedCheckout(input,f.deps)).rejects.toThrow('response lost');
 await reservedCheckout({...input,idempotencyKey:'different',trialDays:1},f.deps);
 expect(f.pending()?.input.idempotencyKey).toBe(input.idempotencyKey);
 expect(f.counts().calls).toBe(2);
});
it('expires the old checkout before replacing it for another plan',async()=>{
 const f=fixture();const first=await reservedCheckout(input,f.deps);
 const second=await reservedCheckout({...input,lookupKey:'pulse_e1m_monthly',idempotencyKey:'replacement'},f.deps);
 expect(second.id).not.toBe(first.id);expect(f.sessions.get(first.id).state).toBe('expired');expect(f.counts().expires).toBe(1);
});
it('reconciles completion winning expiration and creates no replacement',async()=>{
 const f=fixture();await reservedCheckout(input,f.deps);
 f.deps.expire=async(id:string)=>({...f.sessions.get(id),state:'paid',subscription:'sub_completed'});
 await expect(reservedCheckout({...input,lookupKey:'pulse_e1m_monthly'},f.deps)).rejects.toMatchObject({status:409});
 expect(f.counts()).toMatchObject({calls:1,reconciled:1});expect(f.pending()).toBeNull();
});
