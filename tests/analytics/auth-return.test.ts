vi.mock('@/lib/security/admission',()=>({rateLimited:(handler:any)=>handler}));
import { expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const database=vi.hoisted(()=>({query:vi.fn(async()=>({rows:[{token:'fixture-session',expires_at:new Date(Date.now()+3600000)}]}))}));
vi.mock('@/lib/analytics/postgres',()=>({metadataPool:()=>database}));
import { safePulseReturn } from '@/lib/auth-return';
import { GET as start } from '@/app/api/auth/bridge/start/route';
import { GET as consume } from '@/app/api/auth/bridge/consume/route';
import { proxy } from '@/proxy';
it('keeps deep dashboard paths and filters but never leaves Pulse',()=>{
 expect(safePulseReturn('/dashboard/pages?site=app_a&source=search')).toBe('/dashboard/pages?site=app_a&source=search');
 for(const value of ['https://axxes.club','//evil.com','/dashboard/../../sign-out','/dashboard\\evil','/api/organization/open','/dashboard\u0000','/dashboard%2f..%2f..%2fother',null])expect(safePulseReturn(value)).toBe('/dashboard');
});
it('records the real requested page and overwrites a forged origin header',()=>{
 const response=proxy(new NextRequest('https://pulse.axxes.app/dashboard/funnels?site=app_a',{headers:{'x-pulse-return-to':'//evil.com'}}));
 expect(response.headers.get('x-middleware-request-x-pulse-return-to')).toBe('/dashboard/funnels?site=app_a');
});
it('retains intended page through Handshake and the cross-domain bridge',async()=>{
 const path='/dashboard/pages?site=app_a&source=search';
 const response=await start(new Request('https://pulse.axxes.app/api/auth/bridge/start?returnTo='+encodeURIComponent(path),{headers:{host:'pulse.axxes.app'}}));
 expect(response.headers.get('set-cookie')).toContain('__Host-pulse_return=');
 expect(new URL(new URL(response.headers.get('location')!).searchParams.get('redirect')!).searchParams.get('returnTo')).toBe(path);
 vi.stubEnv('BETTER_AUTH_SECRET','fixture-secret');
 try {
 const done=await consume(new NextRequest('https://pulse.axxes.app/api/auth/bridge/consume?code='+'a'.repeat(43),{headers:{host:'pulse.axxes.app',cookie:'__Host-pulse_bridge='+'b'.repeat(43)+'; __Host-pulse_return='+encodeURIComponent(path)}}));
 expect(done.headers.get('location')).toBe('https://pulse.axxes.app'+path);
 expect(done.headers.get('set-cookie')).toContain('__Host-pulse_return=;');
 }finally{vi.unstubAllEnvs();}
});
it('opens embedded source reports as equivalent standalone Pulse reports',()=>{expect(safePulseReturn('/embed/acquisition?site=app_a&source=search')).toBe('/dashboard/acquisition?site=app_a&source=search');expect(safePulseReturn('/embed/unknown')).toBe('/dashboard');});
it('provides a safe Pulse restart after bridge expiry while retaining intent',async()=>{
 const path='/dashboard/pages?source=search';
 const response=await consume(new NextRequest('https://pulse.axxes.app/api/auth/bridge/consume?code='+'a'.repeat(43),{headers:{host:'pulse.axxes.app',cookie:'__Host-pulse_return='+encodeURIComponent(path)}}));
 expect(response.status).toBe(400);expect(response.headers.get('content-type')).toContain('text/html');expect(await response.text()).toContain('/sign-in?returnTo='+encodeURIComponent(path));
});
