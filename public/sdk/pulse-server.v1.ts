/** Use only in server code. Keep the scoped credential in your secret environment. */
export type PulseServerEvent={id:string;name:string;timestamp:string;sessionId?:string;visitorId?:string;properties?:Record<string,string|number|boolean>};
export async function sendPulseEvents(config:{siteId:string;credential:string;environment:'production'|'development';endpoint?:string},events:PulseServerEvent[]){
 if(events.length<1||events.length>50)throw new Error('Send 1–50 events');
 const response=await fetch(new URL('/api/pulse/server-events',config.endpoint||'https://pulse.axxes.app'),{method:'POST',headers:{Authorization:`Bearer ${config.credential}`,'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:1,siteId:config.siteId,environment:config.environment,events}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new Error(`Pulse collection failed (${response.status})`);
 return response.json() as Promise<{accepted:number;duplicates:number}>;
}
/** Derive IDs from committed writes, so retries remain idempotent. Never capture payment details. */
export function purchaseEvent(payment:{id:string;amountMinor:number;currency:string;occurredAt:Date}):PulseServerEvent{if(!Number.isSafeInteger(payment.amountMinor)||payment.amountMinor<0||!/^[A-Z]{3}$/.test(payment.currency))throw new Error('Invalid payment amount or currency');return {id:`purchase_${payment.id}`,name:'purchase',timestamp:payment.occurredAt.toISOString(),properties:{amountMinor:payment.amountMinor,currency:payment.currency}}}
