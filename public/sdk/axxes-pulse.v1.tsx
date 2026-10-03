import Script from 'next/script';
/** Call in an authenticated app layout using its validated organization context. */
export function AXXESPulse({appKey,tenantId}:{appKey:string;tenantId:string}){return <Script key={`${appKey}:${tenantId}`} id={`pulse-${appKey}-${tenantId}`} src='https://pulse.axxes.app/axxes.v1.js' data-app={appKey} data-tenant={tenantId} strategy='afterInteractive'/>}
