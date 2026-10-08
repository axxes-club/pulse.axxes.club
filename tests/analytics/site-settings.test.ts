vi.mock('@/lib/security/admission',()=>({admitWrite:vi.fn().mockResolvedValue(undefined)}));
import { beforeEach, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({context:{tenant:{id:'tenant-a'},role:'admin'},query:vi.fn(),site:{id:'site-a',tenantId:'tenant-a',publicId:'public-a',collection:'browser',environment:'production',enabled:true,identityMode:'ephemeral'}}));
vi.mock('@/lib/context',()=>({getContext:async()=>fixture.context}));
vi.mock('@/lib/analytics/postgres',()=>({metadataPool:()=>({query:fixture.query})}));
import { updateSite } from '@/lib/analytics/sites';
const settings={name:'App',timezone:'America/Puerto_Rico',enabled:true,allowedOrigins:['https://example.com']};
beforeEach(()=>{fixture.context={tenant:{id:'tenant-a'},role:'admin'};fixture.query.mockReset().mockResolvedValue({rows:[fixture.site]});});
it('allows an administrator to explicitly enable retention identity on an existing app',async()=>{
 await expect(updateSite('public-a',{...settings,identityMode:'persistent'})).resolves.toEqual({ok:true});
 const write=fixture.query.mock.calls.find(([sql])=>sql.startsWith('update'))!;
 expect(write[0]).toContain('identity_mode=');expect(write[1]).toContain('persistent');expect(write[1]).toContain('site-a');expect(write[1]).toContain('tenant-a');
});
it('preserves existing identity when old clients save other settings',async()=>{
 await updateSite('public-a',settings);
 expect(fixture.query.mock.calls.find(([sql])=>sql.startsWith('update'))![1]).toContain('ephemeral');
});
it('rejects unauthorized changes, foreign apps, and invalid identity modes',async()=>{
 fixture.context.role='viewer';await expect(updateSite('public-a',{...settings,identityMode:'persistent'})).rejects.toThrow();
 fixture.context={tenant:{id:'foreign'},role:'admin'};await expect(updateSite('public-a',{...settings,identityMode:'persistent'})).rejects.toThrow();
 fixture.context.tenant.id='tenant-a';await expect(updateSite('public-a',{...settings,identityMode:'global'})).rejects.toThrow();
 expect(fixture.query.mock.calls.some(([sql])=>sql.startsWith('update'))).toBe(false);
});
