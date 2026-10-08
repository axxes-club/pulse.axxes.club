import { it, expect } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { persistBatch } from '../../src/lib/analytics/storage';

// Opt-in integration check: only a disposable schema is mutated. Configuration never appears in output.
it.skipIf(!process.env.PULSE_QUOTA_PG_CONFIG)('serializes different visitors at one tenant monthly ceiling on PostgreSQL', async () => {
  const config=JSON.parse(readFileSync(process.env.PULSE_QUOTA_PG_CONFIG!,'utf8'));
  const url=new URL(config.ANALYTICS_DATABASE_URL);
  url.hostname='127.0.0.1';url.port=process.env.PULSE_QUOTA_PG_PORT || '15438';
  url.searchParams.delete('host');url.searchParams.delete('sslmode');
  const schema='pulse_quota_test_'+randomUUID().replaceAll('-','');
  const admin=new pg.Pool({connectionString:url.toString(),max:1});
  let pool: pg.Pool|undefined;
  try {
    await admin.query(`create schema ${schema}`);
    pool=new pg.Pool({connectionString:url.toString(),options:`-c search_path=${schema}`,max:10});
    await pool.query(readFileSync('db/pulse-analytics.sql','utf8').replaceAll('public.',`${schema}.`));
    process.env.PULSE_HASH_SECRET='quota-test-secret-at-least-32-characters';
    const site={id:randomUUID(),tenantId:randomUUID(),environment:'production',collection:'server',identityMode:'ephemeral'} as any;
    const now=new Date();
    await pool.query("insert into pulse_usage(tenant_id,month,billable,stored) values($1,date_trunc('month',$2::timestamptz at time zone 'UTC'),90,90)",[site.tenantId,now]);
    const results=await Promise.allSettled(Array.from({length:10},(_,i)=>persistBatch(site,{
      siteId:'fixture',environment:'production',events:Array.from({length:2},(_,j)=>({id:`event_${i}_${j}`,name:'pageview',timestamp:now.toISOString()}))
    },{ip:`visitor-${i}`,userAgent:'test'},true,pool, {billable:100,stored:400})));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(5);
    for(const result of results) if(result.status==='rejected') expect(result.reason).toMatchObject({status:402});
    const usage=(await pool.query('select billable::int,stored::int,refused::int from pulse_usage')).rows[0];
    expect(usage).toEqual({billable:100,stored:100,refused:10});
    expect((await pool.query('select count(*)::int as n from pulse_events')).rows[0].n).toBe(10);
  } finally {await pool?.end();await admin.query(`drop schema if exists ${schema} cascade`);await admin.end();}
},60000);


it.skipIf(!process.env.PULSE_QUOTA_PG_CONFIG)('uses held clients for two simultaneous checkout callbacks in a pool of two', async () => {
  const {withCheckoutLock} = await import('../../src/lib/billing/store');
  const config=JSON.parse(readFileSync(process.env.PULSE_QUOTA_PG_CONFIG!,'utf8'));
  const url=new URL(config.DATABASE_URL);url.hostname='127.0.0.1';url.port=process.env.PULSE_QUOTA_PG_PORT || '15438';
  url.searchParams.delete('host');url.searchParams.delete('sslmode');
  const schema='pulse_checkout_lock_test_'+randomUUID().replaceAll('-','');
  const admin=new pg.Pool({connectionString:url.toString(),max:1});
  let pool: pg.Pool|undefined;
  const globals=globalThis as any;
  const previous=globals.pulseMetadataPool;
  try {
    await admin.query(`create schema ${schema}`);
    pool=new pg.Pool({connectionString:url.toString(),options:`-c search_path=${schema}`,max:2,connectionTimeoutMillis:1000});
    globals.pulseMetadataPool=pool;process.env.DATABASE_URL=url.toString();
    await pool.query('create table tenants(id uuid primary key)');
    await pool.query(readFileSync('db/pulse-billing.sql','utf8'));
    const tenants=[randomUUID(),randomUUID()];
    for(const tenant of tenants) {await pool.query('insert into tenants values($1)',[tenant]);await pool.query('insert into pulse_billing(tenant_id) values($1)',[tenant]);}
    let entered=0;let proceed!:()=>void;const barrier=new Promise<void>(resolve=>{proceed=resolve;});
    const results=await Promise.all(tenants.map((tenant,i)=>withCheckoutLock(tenant,async reservation=>{
      if(++entered===2)proceed();await barrier;
      const row=await reservation.row();expect(row.tenantId).toBe(tenant);
      await reservation.apply({id:`sub_fixture_${i}`,product:'pulse',reference:tenant,status:'active',lookup_key:'pulse_e25k_monthly',current_period_end:Math.floor(Date.now()/1000)+86400,cancel_at_period_end:false} as any,'fixture');
      return row.tenantId;
    })));
    expect(results).toEqual(tenants);
  } finally {globals.pulseMetadataPool=previous;await pool?.end();await admin.query(`drop schema if exists ${schema} cascade`);await admin.end();}
},60000);
