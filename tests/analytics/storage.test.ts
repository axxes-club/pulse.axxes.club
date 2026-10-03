import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { persistBatch } from "../../src/lib/analytics/storage";
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
