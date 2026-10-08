import { it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { persistBatch } from "../../src/lib/analytics/storage";
import {validateBatch} from '../../src/lib/analytics/validation';
it('scoped server anonymous hashes distinguish daily visitors without enabling persistent identity',async()=>{const db=new PGlite();await db.exec(readFileSync('db/pulse-analytics.sql','utf8'));process.env.PULSE_HASH_SECRET='test-only-secret-at-least-32-characters-long';const database={connect:async()=>({query:async(text:string,args?:unknown[])=>{const r=await db.query(text,args);return {rows:r.rows,rowCount:r.affectedRows??null}},release:()=>{}})};const site={id:'11111111-1111-4111-8111-111111111111',tenantId:'22222222-2222-4222-8222-222222222222',environment:'production',collection:'server',identityMode:'ephemeral'} as any;const batch=validateBatch({siteId:'app_fixture',environment:'production',events:['a','a','b'].map((hash,i)=>({id:'event'+i,name:'pageview',timestamp:new Date().toISOString(),url:'https://example.com/',anonymousVisitorId:hash.repeat(32)}))});try{await persistBatch(site,batch,{ip:'server',userAgent:'trusted-server'},true,database);const rows=(await db.query('SELECT visitor_key,session_key FROM pulse_events')).rows as any[];expect(new Set(rows.map(r=>r.visitor_key)).size).toBe(2);expect(rows[0].session_key).toBe(rows[1].session_key);expect(JSON.stringify(rows)).not.toContain('a'.repeat(32));await expect(persistBatch({...site,collection:'browser'},batch,{ip:'server',userAgent:'trusted-server'},false,database)).rejects.toThrow('scoped server');await expect(persistBatch({...site,identityMode:'persistent'},batch,{ip:'server',userAgent:'trusted-server'},true,database)).rejects.toThrow('ephemeral');for(const extra of [{sessionId:'stable-session'},{visitorId:'persistent-person'}])await expect(persistBatch(site,{...batch,events:[{...batch.events[0],...extra}]},{ip:'server',userAgent:'trusted-server'},true,database)).rejects.toThrow('without explicit');}finally{await db.close()}},20000);
it("acknowledges durable PostgreSQL writes, deduplicates retries, and never stores raw IP", async () => {
  const db = new PGlite();
  await db.exec(readFileSync("db/pulse-analytics.sql", "utf8"));
  const connection = {
    query: async (text: string, args?: unknown[]) => {
      const r = await db.query(text, args);
      return { rows: r.rows, rowCount: r.affectedRows ?? null };
    },
    release: () => {},
  };
  const database = { connect: async () => connection };
  process.env.PULSE_HASH_SECRET =
    "test-only-secret-at-least-32-characters-long";
  const site = {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    environment: "production",
    collection: "browser",
    allowedOrigins: ["https://example.com"],
    enabled: true,
  } as any;
  const batch = {
    siteId: "app_test",
    environment: "production",
    events: [
      {
        id: "e1",
        name: "pageview",
        timestamp: new Date().toISOString(),
        url: "https://example.com/pricing?password=secret",
        sessionId: "s1",
      },
    ],
  } as any;
  const first = await persistBatch(
    site,
    batch,
    { ip: "192.0.2.1", userAgent: "Test Browser" },
    false,
    database,
  );
  const second = await persistBatch(
    site,
    batch,
    { ip: "192.0.2.1", userAgent: "Test Browser" },
    false,
    database,
  );
  expect(first).toEqual({ accepted: 1, duplicates: 0 });
  expect(second).toEqual({ accepted: 0, duplicates: 1 });
  const result = await db.query("select * from pulse_events");
  expect(result.rows).toHaveLength(1);
  expect(JSON.stringify(result.rows)).not.toContain("192.0.2.1");
  expect(JSON.stringify(result.rows)).not.toContain("password");
  await db.close();
}, 20000);
it('rolls back the entire batch and rate allocation when storage fails before commit',async()=>{
 const db=new PGlite();await db.exec(readFileSync('db/pulse-analytics.sql','utf8'));let inserts=0;
 const connection={query:async(text:string,args?:unknown[])=>{if(text.startsWith('insert into pulse_events')&&++inserts===2)throw new Error('Simulated storage failure');const r=await db.query(text,args);return {rows:r.rows,rowCount:r.affectedRows??null}},release:()=>{}};
 process.env.PULSE_HASH_SECRET='test-only-secret-at-least-32-characters-long';
 try{await expect(persistBatch({id:'11111111-1111-4111-8111-111111111111',tenantId:'22222222-2222-4222-8222-222222222222',environment:'production',collection:'browser',identityMode:'ephemeral'} as any,{siteId:'fixture',environment:'production',events:['a','b'].map(id=>({id,name:'pageview',timestamp:new Date().toISOString(),url:'https://example.com/'}))},{ip:'192.0.2.1',userAgent:'Owned fixture'},false,{connect:async()=>connection})).rejects.toThrow('Simulated storage failure');expect((await db.query('select * from pulse_events')).rows).toHaveLength(0);expect((await db.query('select * from pulse_rate_limits')).rows).toHaveLength(0)}finally{await db.close()}
},20000);
it('owns the identity marker and ignores client claims about durable identity',async()=>{
 const properties:any[]=[];
 const database={connect:async()=>({query:async(sql:string,args?:unknown[])=>{if(sql.startsWith('insert into pulse_events')){properties.push(JSON.parse(args![12] as string));return {rows:[{inserted:true}],rowCount:1}}return {rows:[{count:1}],rowCount:1}},release:()=>{}})};
 const site={id:'site',tenantId:'tenant',environment:'production',collection:'browser',identityMode:'persistent'} as any;
 process.env.PULSE_HASH_SECRET='test-only-secret-at-least-32-characters-long';
 for(const [id,visitorId,claim] of [['identified','visitor','ephemeral'],['anonymous',undefined,'persistent']] as const){
 await persistBatch(site,{siteId:'app',environment:'production',events:[{id,name:'pageview',timestamp:new Date().toISOString(),visitorId,properties:{__pulse_identity:claim}}]},{ip:'192.0.2.1',userAgent:'test'},false,database);
 }
 expect(properties.map(p=>p.__pulse_identity)).toEqual(['persistent','ephemeral']);
});

it('keeps explicit session keys stable across UTC midnight',async()=>{
 const parameters:unknown[][]=[];
 const database={connect:async()=>({query:async(sql:string,args?:unknown[])=>{if(sql.startsWith('insert into pulse_events')){parameters.push(args!);return {rows:[{inserted:true}],rowCount:1}}return {rows:[{count:1}],rowCount:1}},release:()=>{}})};
 const site={id:'site',tenantId:'tenant',environment:'production',collection:'browser',identityMode:'ephemeral'} as any;
 process.env.PULSE_HASH_SECRET='test-only-secret-at-least-32-characters-long';
 vi.useFakeTimers();try{
 for(const [id,time] of [['before','2026-10-07T23:59:00Z'],['after','2026-10-08T00:01:00Z']]){
 vi.setSystemTime(new Date(time));await persistBatch(site,{siteId:'app',environment:'production',events:[{id,name:'pageview',timestamp:time,sessionId:'one_session'}]},{ip:'192.0.2.1',userAgent:'test'},false,database);
 }
 expect(parameters[0][7]).toBe(parameters[1][7]);expect(parameters[0][6]).not.toBe(parameters[1][6]);
 }finally{vi.useRealTimers()}
});
it('counts repeated web vital updates within one transaction as one stored event',async()=>{
 const db=new PGlite();await db.exec(readFileSync('db/pulse-analytics.sql','utf8'));
 const database={connect:async()=>({query:async(sql:string,args?:unknown[])=>{const r=await db.query(sql,args);return {rows:r.rows,rowCount:r.affectedRows??null}},release:()=>{}})};
 process.env.PULSE_HASH_SECRET='test-only-secret-at-least-32-characters-long';
 const site={id:'11111111-1111-4111-8111-111111111111',tenantId:'22222222-2222-4222-8222-222222222222',environment:'production',collection:'browser',identityMode:'ephemeral'} as any;
 const timestamp=new Date().toISOString();
 try{await persistBatch(site,{siteId:'app',environment:'production',events:[1,2].map(value=>({id:'vital_one',name:'web_vital',timestamp,properties:{metric:'LCP',value}}))},{ip:'192.0.2.1',userAgent:'test'},false,database,{billable:100,stored:400});
 expect((await db.query('select stored::int,billable::int from pulse_usage')).rows).toEqual([{stored:1,billable:0}]);
 expect((await db.query('select properties from pulse_events')).rows).toEqual([{properties:{metric:'LCP',value:2,pulse_collection:'browser',__pulse_identity:'ephemeral'}}]);
 }finally{await db.close()}
},20000);
