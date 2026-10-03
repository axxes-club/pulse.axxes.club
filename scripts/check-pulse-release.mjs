/** Public release checks; no credentials, customer data, or query tokens are logged. */
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const origin=new URL(process.env.PULSE_CHECK_ORIGIN||'https://pulse.axxes.app');
if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw Error('HTTPS required');
const checks=[];
async function check(path,accept,options={}){const response=await fetch(new URL(path,origin),{redirect:'manual',signal:AbortSignal.timeout(15000),...options});if(!accept(response))throw Error(`Release check failed: ${path} HTTP ${response.status}`);checks.push({path,status:response.status});return response}
for(const path of ['/','/demo','/docs','/pulse.v1.js','/sdk/pulse-sdk.v1.js'])await check(path,r=>r.status===200);
await check('/dashboard',r=>[302,303,307,308].includes(r.status)&&!!r.headers.get('location'));
await check('/embed/overview',r=>r.status===200&&r.headers.get('content-security-policy')?.includes('frame-ancestors https://members.axxes.club'));
await check('/api/pulse/server-events',r=>r.status===401,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
await check('/api/jobs/pulse',r=>r.status===401,{method:'POST'});
await check('/api/pulse/collect',r=>[400,403,404].includes(r.status),{method:'POST',headers:{'content-type':'application/json',origin:'https://unknown.invalid'},body:'{}'});
await check('/api/auth/bridge/consume',r=>r.status===400);
const tracker=readFileSync(new URL('../public/pulse.v1.js',import.meta.url));const compressedBytes=gzipSync(tracker).length;if(compressedBytes>4096)throw Error('Tracker exceeds 4KiB gzip budget');console.log(JSON.stringify({origin:origin.origin,passed:checks,trackerGzipBytes:compressedBytes},null,2));
