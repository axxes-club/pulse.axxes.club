import { describe, expect, it, vi } from 'vitest';
import { ensurePulseWorkspace } from '../../src/lib/workspace';

function fixture(existing: unknown[] = [], failMembership = false) {
  const calls: Array<{sql:string;values?:unknown[]}> = [];
  const release = vi.fn();
  const query = vi.fn(async (sql:string, values?:unknown[]) => {
    calls.push({sql,values});
    if (sql.startsWith('select t.id')) return {rows: existing};
    if (sql.startsWith('insert into tenants')) return {rows:[{id:'new-workspace',name:values![0]}]};
    if (sql.startsWith('insert into tenant_memberships') && failMembership) throw Error('membership write failed');
    return {rows:[]};
  });
  const connect = vi.fn(async () => ({query,release}));
  return {pool:{connect} as any,calls,release,connect};
}
describe('Pulse workspace creation', () => {
  it('rejects missing authentication and invalid names before database access', async () => {
    const f=fixture();
    await expect(ensurePulseWorkspace(null,'Workspace',f.pool)).rejects.toThrow('Sign in');
    for (const name of ['', ' ', 'a'.repeat(101), 'bad\u0000name']) await expect(ensurePulseWorkspace({id:'user-a'},name,f.pool)).rejects.toThrow('workspace name');
    expect(f.connect).not.toHaveBeenCalled();
  });
  it('reuses an existing eligible membership under a per-user transaction lock', async () => {
    const f=fixture([{id:'existing',name:'Existing'}]);
    expect(await ensurePulseWorkspace({id:'user-a'},'Ignored name',f.pool)).toEqual({id:'existing',name:'Existing'});
    expect(f.calls[0].sql).toBe('begin');
    expect(f.calls[1]).toMatchObject({values:['pulse-workspace:user-a']});
    expect(f.calls.find(c=>c.sql.startsWith('select t.id'))).toMatchObject({values:['user-a']});
    expect(f.calls.some(c=>c.sql.startsWith('insert'))).toBe(false);
    expect(f.calls.at(-1)?.sql).toBe('commit');
    expect(f.release).toHaveBeenCalledOnce();
  });
  it('creates an active central tenant and owner membership atomically for the authenticated user', async () => {
    const f=fixture();
    expect(await ensurePulseWorkspace({id:'user-a'},'  My analytics  ',f.pool)).toEqual({id:'new-workspace',name:'My analytics'});
    expect(f.calls.find(c=>c.sql.startsWith('insert into tenants'))?.values).toEqual(['My analytics',expect.stringMatching(/^my-analytics-[a-f0-9]{32}$/),'user-a']);
    expect(f.calls.find(c=>c.sql.startsWith('insert into tenant_memberships'))?.values).toEqual(['new-workspace','user-a']);
    expect(f.calls.at(-1)?.sql).toBe('commit');
  });
  it('rolls back the tenant if the owner membership fails and releases the connection', async () => {
    const f=fixture([],true);
    await expect(ensurePulseWorkspace({id:'user-a'},'Workspace',f.pool)).rejects.toThrow('membership write failed');
    expect(f.calls.at(-1)?.sql).toBe('rollback');
    expect(f.calls.some(c=>c.sql==='commit')).toBe(false);
    expect(f.release).toHaveBeenCalledOnce();
  });
});

it('persists one shared workspace on retry and rolls back an actual failed membership write',async()=>{
  const {PGlite}=await import('@electric-sql/pglite');
  const database=new PGlite();
  await database.exec(`create table tenants(id uuid primary key default gen_random_uuid(),name text not null,slug text unique,type text,status text,owner_id text,deleted_at timestamptz);
    create table tenant_memberships(tenant_id uuid references tenants(id),user_id text,role text,is_primary boolean,deleted_at timestamptz,check(user_id <> 'broken-user'));`);
  // PGlite has no advisory locks; lock invocation and scope are asserted above.
  const pool={connect:async()=>({query:async(sql:string,values?:unknown[])=>sql.includes('pg_advisory_xact_lock')?{rows:[]}:database.query(sql,values),release(){}})} as any;
  try{
    const first=await ensurePulseWorkspace({id:'user-a'},'First',pool);
    expect(await ensurePulseWorkspace({id:'user-a'},'Retry',pool)).toEqual(first);
    expect((await database.query<{n:number}>('select count(*)::int as n from tenants')).rows[0].n).toBe(1);
    await expect(ensurePulseWorkspace({id:'broken-user'},'Rollback',pool)).rejects.toThrow();
    expect((await database.query<{n:number}>('select count(*)::int as n from tenants')).rows[0].n).toBe(1);
    await database.exec(`update tenants set status='suspended'`);
    const replacement=await ensurePulseWorkspace({id:'user-a'},'Eligible',pool);
    expect(replacement.id).not.toBe(first.id);
  }finally{await database.close();}
},60000);
