vi.mock('@/lib/security/admission',()=>({admitWrite:vi.fn().mockResolvedValue(undefined)}));
import {afterEach,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({load:vi.fn(async()=>({events:[],sample:null as number|null})),site:{id:'site',tenantId:'tenant',publicId:'app_test',name:'Site',environment:'production',timezone:'UTC',identityMode:'ephemeral'}}));
vi.mock('@/lib/context',()=>({requireContext:async()=>({tenant:{id:'tenant',name:'Tenant'},memberships:[],role:'owner'})}));
vi.mock('@/lib/analytics/sites',()=>({listSites:async()=>[fixture.site]}));
vi.mock('@/lib/analytics/storage',()=>({loadEvents:fixture.load,buildReport:vi.fn(async()=>({sample:0.25,visitors:10}))}));
vi.mock('@/lib/analytics/config',()=>({getReportConfig:async()=>({goals:[],funnels:[]})}));
vi.mock('@/components/pulse/billing-notice',()=>({BillingNotice:()=>null}));
vi.mock('@/components/pulse/report-shell',()=>({ReportShell:()=>null}));
vi.mock('@/components/pulse/report-view',()=>({ReportView:()=>null,ReportRetry:()=>null}));
import {Dashboard} from '@/components/pulse/dashboard';
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
it('keeps a historical funnel load bounded to its selected complete days as newer traffic arrives',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
 const search={site:'app_test',from:'2026-09-01',to:'2026-09-07',timezone:'UTC'};
 await Dashboard({view:'funnels',search});
 expect(fixture.load).toHaveBeenLastCalledWith(fixture.site,new Date('2026-08-25T00:00:00Z'),new Date('2026-09-08T00:00:00Z'),undefined,undefined,'session');
 vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
 await Dashboard({view:'funnels',search});
 expect(fixture.load).toHaveBeenLastCalledWith(fixture.site,new Date('2026-08-25T00:00:00Z'),new Date('2026-09-08T00:00:00Z'),undefined,undefined,'session');
});

it('uses separate complete-session and visitor samples only for sampled funnel windows',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
 fixture.load.mockResolvedValueOnce({events:[],sample:0.5}).mockResolvedValueOnce({events:[],sample:0.25});
 await Dashboard({view:'funnels',search:{site:'app_test',from:'2026-09-01',to:'2026-09-07',timezone:'UTC'}});
 expect(fixture.load).toHaveBeenNthCalledWith(1,fixture.site,new Date('2026-08-25T00:00:00Z'),new Date('2026-09-08T00:00:00Z'),undefined,undefined,'session');
 expect(fixture.load).toHaveBeenNthCalledWith(2,fixture.site,new Date('2026-08-25T00:00:00Z'),new Date('2026-09-08T00:00:00Z'));
 expect(fixture.load).toHaveBeenCalledTimes(2);
});
