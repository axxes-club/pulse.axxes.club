import { expect, it, vi, beforeEach } from 'vitest';
import { AnalyticsError } from '@/lib/analytics/access';
const mocks=vi.hoisted(()=>({site:{id:'site',publicId:'app',timezone:'America/Puerto_Rico',environment:'development'},access:vi.fn(),report:vi.fn(),config:vi.fn(),load:vi.fn()}));
vi.mock('@/lib/analytics/sites',()=>({requireAnalyticsAccess:mocks.access}));
vi.mock('@/lib/analytics/storage',()=>({getReport:mocks.report,loadEvents:mocks.load}));
vi.mock('@/lib/analytics/config',()=>({getReportConfig:mocks.config}));
import { GET } from '@/app/api/pulse/sites/[siteId]/export/route';
import { reportCsv } from '@/lib/analytics/export';
import { summarizeEvents } from '@/lib/analytics/metrics';
import { reportWindow } from '@/lib/analytics/timezone';
const now=new Date('2026-10-08T12:00:00Z');
const query={range:7,source:'',metric:'visitors',environment:'development',compare:true} as const;
const report=()=>({...summarizeEvents([],query,now),pages:[{name:'/pricing',value:8}],sources:[{name:'=HYPERLINK("evil")',value:3}],campaigns:[{name:'Launch, fall',value:2}]});
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue({site:mocks.site});mocks.report.mockResolvedValue(report());mocks.config.mockResolvedValue({goals:['signup'],funnels:[]})});
const params={params:Promise.resolve({siteId:'app'})};
it('exports the requested report with the same site defaults and explicit filters',async()=>{
 const response=await GET(new Request('https://pulse.axxes.app/api/pulse/sites/app/export?view=pages&path=/pricing'),params);
 expect(response.status).toBe(200);
 expect(mocks.report.mock.calls[0][1]).toMatchObject({timezone:'America/Puerto_Rico',environment:'development',path:'/pricing'});
 expect(await response.text()).toContain('page,pageviews\n/pricing,8');
 await GET(new Request('https://pulse.axxes.app/api/pulse/sites/app/export?timezone=Asia/Tokyo&environment=production'),params);
 expect(mocks.report.mock.calls[1][1]).toMatchObject({timezone:'Asia/Tokyo',environment:'production'});
});
it('denies exports when organization access fails',async()=>{
 mocks.access.mockRejectedValue(new AnalyticsError('App not found',404));
 expect((await GET(new Request('https://pulse.axxes.app/api/pulse/sites/app/export?view=pages'),params)).status).toBe(404);
 expect(mocks.report).not.toHaveBeenCalled();
});
it('escapes CSV values and neutralizes spreadsheet formulas in collected names',()=>{
 const csv=reportCsv(report(),'acquisition');
 expect(csv).toContain("source,\"'=HYPERLINK(\"\"evil\"\")\",3");
 expect(csv).toContain('campaign,"Launch, fall",2');
});
it('exports the selected funnel using ordered sessions and retains sampling disclosure',()=>{
 const events=[{id:'1',name:'pageview',session:'a',time:'2026-10-07T12:00:00Z'},{id:'2',name:'signup',session:'a',time:'2026-10-07T12:01:00Z'},{id:'3',name:'pageview',session:'b',time:'2026-10-07T12:00:00Z'}] as any;
 const csv=reportCsv({...report(),sample:0.5},'funnels',{events,funnel:{steps:['pageview','signup'],windowMs:1800000}});
 expect(csv).toContain('step,sessions,completion_rate,sample_share\npageview,4,100,0.5\nsignup,2,50,0.5');
});
it('uses persisted measured samples rather than summary metrics for performance exports',()=>{
 const csv=reportCsv({...report(),performance:{LCP:{p75:2200,samples:5},INP:{p75:null,samples:0},CLS:{p75:0.1,samples:5}}},'performance');
 expect(csv).toContain('metric,p75,samples\nLCP,2200,5\nINP,,0');
});
it('exports a selected saved funnel with report filters and refuses foreign funnel identifiers',async()=>{
 const selected={id:'selected',name:'Feature journey',steps:['pageview','feature_used'],windowMs:1800000};
 mocks.config.mockResolvedValue({goals:[],funnels:[{id:'first',steps:['pageview','signup'],windowMs:1800000},selected]});
 const base={path:'/',source:'Google',country:'US',device:'Desktop',environment:'development',visitor:'v',session:'s'};
 // Use yesterday so this route's real report window includes the events.
 const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
 mocks.load.mockResolvedValue({sample:1,events:[{...base,id:'1',name:'pageview',time:yesterday+'T12:00:00Z'},{...base,id:'2',name:'feature_used',time:yesterday+'T12:01:00Z'},{...base,id:'3',name:'pageview',visitor:'other',session:'other',source:'Direct',time:yesterday+'T12:00:00Z'}]});
 const response=await GET(new Request('https://pulse.axxes.app/api/pulse/sites/app/export?view=funnels&funnel=selected&source=Google'),params);
 expect(await response.text()).toContain('pageview,1,100\nfeature_used,1,100');
 expect(mocks.load.mock.calls[0][2].getTime()).toBe(reportWindow(7,mocks.site.timezone).end);
 expect(mocks.load.mock.calls[0][5]).toBe('session');
 expect(mocks.report).not.toHaveBeenCalled();
 mocks.load.mockClear();
 expect((await GET(new Request('https://pulse.axxes.app/api/pulse/sites/app/export?view=funnels&funnel=foreign'),params)).status).toBe(404);
 expect(mocks.load).not.toHaveBeenCalled();
});
it('keeps export data limitations accurate and escapes control-prefixed formulas',()=>{
 const csv=reportCsv({...report(),sources:[{name:'\n=CMD()',value:1}]},'acquisition');
 expect(csv).toContain('"\'\n=CMD()"');
 expect(reportCsv({...report(),sample:0.5},'realtime')).not.toContain('sample_share');
 expect(reportCsv({...report(),historyAvailable:false},'overview')).toContain('metric,value,history_available\nVisitors,0,false');
});
it('discloses the separate session share for session metrics and funnels',()=>{
 const sampled={...report(),sample:0.25,sessionSample:0.5,sessions:2,conversions:2};
 const overview=reportCsv(sampled,'overview');
 expect(overview).toContain('Sessions,2,0.5');
 expect(overview).toContain('Pageviews,0,0.25');
 const events=[{id:'page',name:'pageview',session:'s',time:'2026-10-06T23:59:00Z'},{id:'goal',name:'signup',session:'s',time:'2026-10-07T00:01:00Z'}] as any;
 expect(reportCsv(sampled,'funnels',{events})).toContain('pageview,2,100,0.5\nsignup,2,100,0.5');
});
