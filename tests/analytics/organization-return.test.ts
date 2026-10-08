import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({switch:vi.fn()}));
vi.mock('@/lib/actions/org',()=>({switchOrganization:mock.switch}));
import {GET} from '@/app/api/organization/open/route';
const tenant='11111111-1111-4111-8111-111111111111';const site='app_'+'a'.repeat(32);
beforeEach(()=>mock.switch.mockResolvedValue({error:'Please sign in again to switch organization.'}));
it('preserves source report and site through tenant launch authentication',async()=>{
 const path='/dashboard/pages?source=search';const response=await GET(new Request(`https://pulse.axxes.app/api/organization/open?tenant=${tenant}&site=${site}&returnTo=${encodeURIComponent(path)}`,{headers:{host:'pulse.axxes.app'}}));
 const next=new URL(response.headers.get('location')!);expect(next.pathname).toBe('/api/auth/bridge/start');expect(next.searchParams.get('tenant')).toBe(tenant);expect(next.searchParams.get('returnTo')).toBe(path+'&site='+site);
});
it('preserves an embedded source report and its filters for the sign-in surface',async()=>{
 const path='/embed/acquisition?source=search';const response=await GET(new Request(`https://pulse.axxes.app/api/organization/open?tenant=${tenant}&embed=1&returnTo=${encodeURIComponent(path)}`,{headers:{host:'pulse.axxes.app'}}));
 expect(response.headers.get('location')).toBe('https://pulse.axxes.app'+path);
});
it('revalidates membership and never sends a signed-in tenant launch outside Pulse',async()=>{
 mock.switch.mockResolvedValue({});const response=await GET(new Request(`https://pulse.axxes.app/api/organization/open?tenant=${tenant}&returnTo=${encodeURIComponent('https://evil.com')}`,{headers:{host:'pulse.axxes.app'}}));expect(response.headers.get('location')).toBe('https://pulse.axxes.app/dashboard');
 mock.switch.mockResolvedValue({error:'You no longer have access to this organization.'});expect((await GET(new Request(`https://pulse.axxes.app/api/organization/open?tenant=${tenant}`,{headers:{host:'pulse.axxes.app'}}))).status).toBe(403);
});
