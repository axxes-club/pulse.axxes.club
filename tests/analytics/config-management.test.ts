import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const mocks=vi.hoisted(()=>({context:null as any,pool:null as any}));
vi.mock('@/lib/context',()=>({getContext:async()=>mocks.context}));
vi.mock('@/lib/analytics/postgres',()=>({metadataPool:()=>mocks.pool}));
import * as goals from '@/app/api/pulse/sites/[siteId]/goals/route';
import * as funnels from '@/app/api/pulse/sites/[siteId]/funnels/route';
import { getReportConfig } from '@/lib/analytics/config';

const tenantA='11111111-1111-4111-8111-111111111111';
const tenantB='22222222-2222-4222-8222-222222222222';
const siteA='33333333-3333-4333-8333-333333333333';
const siteB='44444444-4444-4444-8444-444444444444';
const funnelA='55555555-5555-4555-8555-555555555555';
const funnelB='66666666-6666-4666-8666-666666666666';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec('create table tenants(id uuid primary key);create table session(id text primary key)');
 await db.exec(readFileSync('db/pulse-metadata.sql','utf8'));
 mocks.pool={query:(sql:string,args?:unknown[])=>db.query(sql,args)};
 await db.query('insert into tenants values($1),($2)',[tenantA,tenantB]);
 await db.query("insert into pulse_sites(id,tenant_id,public_id,name,platform,collection,environment) values($1,$2,'app_a','First','html','browser','production'),($3,$4,'app_b','Second','html','browser','production')",[siteA,tenantA,siteB,tenantB]);
},60000);
beforeEach(async()=>{
 mocks.context={tenant:{id:tenantA},role:'owner'};
 await db.exec('delete from pulse_goals;delete from pulse_funnels');
 await db.query("insert into pulse_goals(site_id,event_name) values($1,'signup'),($2,'signup')",[siteA,siteB]);
 await db.query("insert into pulse_funnels(id,site_id,name,steps) values($1,$2,'First funnel','[\"pageview\",\"signup\"]'),($3,$4,'Second funnel','[\"pageview\",\"signup\"]')",[funnelA,siteA,funnelB,siteB]);
});
afterAll(async()=>{await db?.close()});
const request=(body:unknown,origin='https://pulse.axxes.app')=>new Request('https://pulse.axxes.app/api/pulse/sites/app_a/goals',{method:'DELETE',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
const params=(siteId='app_a')=>({params:Promise.resolve({siteId})});
it('removes only the authorized app definitions and preserves underlying tracking configuration',async()=>{
 expect(typeof goals.DELETE).toBe('function');expect(typeof funnels.DELETE).toBe('function');
 expect((await goals.DELETE(request({eventName:'signup'}),params())).status).toBe(200);
 expect((await getReportConfig('app_a')).funnels.map(f=>f.id)).toEqual([funnelA]);
 expect((await funnels.DELETE(request({funnelId:funnelA}),params())).status).toBe(200);
 expect(await getReportConfig('app_a')).toEqual({goals:[],funnels:[]});
 expect((await db.query('select site_id,event_name from pulse_goals')).rows).toEqual([{site_id:siteB,event_name:'signup'}]);
 expect((await db.query('select id from pulse_funnels')).rows).toEqual([{id:funnelB}]);
 expect((await db.query('select count(*)::int as count from pulse_sites')).rows).toEqual([{count:2}]);
});
it('refuses signed-out users, non-admin members, foreign sites, and cross-origin requests without deletion',async()=>{
 expect(typeof goals.DELETE).toBe('function');expect(typeof funnels.DELETE).toBe('function');
 mocks.context=null;expect((await goals.DELETE(request({eventName:'signup'}),params())).status).toBe(401);
 mocks.context={tenant:{id:tenantA},role:'member'};expect((await funnels.DELETE(request({funnelId:funnelA}),params())).status).toBe(403);
 mocks.context={tenant:{id:tenantA},role:'owner'};
 expect((await goals.DELETE(request({eventName:'signup'}),params('app_b'))).status).toBe(404);
 expect((await funnels.DELETE(request({funnelId:funnelB}),params())).status).toBe(404);
 expect((await goals.DELETE(request({eventName:'signup'},'https://evil.example'),params())).status).toBe(403);
 expect((await db.query('select count(*)::int as count from pulse_goals')).rows).toEqual([{count:2}]);
 expect((await db.query('select count(*)::int as count from pulse_funnels')).rows).toEqual([{count:2}]);
});
it('rejects invalid identifiers and reports missing definitions honestly',async()=>{
 expect(typeof goals.DELETE).toBe('function');expect(typeof funnels.DELETE).toBe('function');
 expect((await funnels.DELETE(request({funnelId:'not-a-uuid'}),params())).status).toBe(400);
 expect((await goals.DELETE(request({eventName:'unknown'}),params())).status).toBe(404);
});
