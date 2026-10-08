import { expect, it } from 'vitest';
import { buildReport } from '@/lib/analytics/storage';
it('marks expired comparison history unavailable in the real report response',async()=>{
 const site={id:'history-fixture',tenantId:'tenant',environment:'production',identityMode:'ephemeral',timezone:'UTC'} as any;
 const pool={query:async(sql:string)=>({rows:sql.includes('sum(events)')?[{n:0}]:[]})} as any;
 const now=new Date('2026-10-08T12:00:00Z');
 const query={range:90,source:'',metric:'visitors',environment:'production',compare:true,timezone:'UTC'} as const;
 expect(await buildReport(site,query,[],now,pool)).toMatchObject({comparisonAvailable:false,historyAvailable:false,comparison:[]});
 expect(await buildReport(site,{...query,range:30},[],now,pool)).toMatchObject({comparisonAvailable:true,historyAvailable:true});
});
it('does not reuse ephemeral reports after persistent identity is enabled',async()=>{
 const site={id:'identity-cache-fixture',tenantId:'tenant',environment:'production',identityMode:'ephemeral',timezone:'UTC'} as any;
 const events=[{id:'marked',name:'pageview',time:'2026-10-07T12:00:00Z',visitor:'consented',session:'s',path:'/',source:'Direct',country:'US',device:'Desktop',environment:'production',properties:{__pulse_identity:'persistent'}}];
 const pool={query:async(sql:string)=>({rows:sql.includes('sum(events)')?[{n:1}]:sql.startsWith('select event_id as id')?events:[]})} as any;
 const query={range:7,source:'',metric:'visitors',environment:'production',compare:true,timezone:'UTC'} as const;
 const now=new Date('2026-10-08T12:00:00Z');
 expect((await buildReport(site,query,[],now,pool)).cohorts).toEqual([]);
 const persistent=await buildReport({...site,identityMode:'persistent'},query,[],now,pool);
 expect(persistent.identityMode).toBe('persistent');expect(persistent.cohorts).toHaveLength(1);
});
it('performs a second bounded session read only when the visitor report is sampled',async()=>{
 const site={id:'session-cache-fixture',tenantId:'tenant',environment:'production',identityMode:'ephemeral',timezone:'UTC'} as any;
 const base={path:'/',source:'Direct',country:'US',device:'Desktop',environment:'production',properties:{pulse_collection:'browser'},session:'session'};
 const before={...base,id:'before',name:'pageview',visitor:'daily-before',time:'2026-10-06T23:59:00Z'};
 const goal={...base,id:'goal',name:'signup',visitor:'daily-after',time:'2026-10-07T00:01:00Z'};
 let estimate=180000;const reads:Array<{sql:string;args:unknown[]}>=[];
 const pool={query:async(sql:string,args:unknown[])=>{
  if(sql.includes('sum(events)'))return {rows:[{n:estimate}]};
  if(sql.startsWith('select event_id as id')){reads.push({sql,args});return {rows:sql.includes('substr(session_key')?[before,goal]:[before]}}
  return {rows:[]};
 }} as any;
 const query={range:7,source:'',metric:'conversions',environment:'production',compare:true,timezone:'UTC'} as const;
 const now=new Date('2026-10-08T12:00:00Z');
 const sampled=await buildReport(site,query,['signup'],now,pool);
 expect(sampled).toMatchObject({sample:0.5,sessionSample:0.5,sessions:2,conversions:2});
 expect(reads).toHaveLength(2);expect(reads.every(read=>Number(read.args[5])<=112501)).toBe(true);
 reads.length=0;estimate=1;
 await buildReport({...site,id:'exact-session-cache-fixture'},query,['signup'],now,pool);
 expect(reads).toHaveLength(1);
});
