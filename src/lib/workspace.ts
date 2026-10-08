import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { metadataPool } from './analytics/postgres';

/** Uses existing portal-owned tenancy tables; never creates a separate Pulse identity. */
export async function ensurePulseWorkspace(
  user: {id:string} | null,
  input: unknown,
  pool?: Pick<Pool,'connect'>,
): Promise<{id:string;name:string}> {
  if (!user?.id) throw Error('Sign in to create your workspace.');
  if (typeof input !== 'string' || !input.trim() || input.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(input)) {
    throw Error('Enter a workspace name between 1 and 100 characters.');
  }
  const name=input.trim();
  const client=await (pool ?? metadataPool()).connect();
  try {
    await client.query('begin');
    // Serialize retries/double submits across processes before checking membership.
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['pulse-workspace:'+user.id]);
    const existing=await client.query<{id:string;name:string}>(
      `select t.id,t.name from tenant_memberships m join tenants t on t.id=m.tenant_id
       where m.user_id=$1 and m.deleted_at is null and t.deleted_at is null
       and t.status='active'
       order by m.is_primary desc nulls last,t.name,t.id limit 1`,[user.id],
    );
    let workspace=existing.rows[0];
    if (!workspace) {
      const prefix=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50) || 'workspace';
      const created=await client.query<{id:string;name:string}>(
        `insert into tenants(name,slug,type,status,owner_id) values($1,$2,'business','active',$3) returning id,name`,
        [name,prefix+'-'+randomUUID().replaceAll('-',''),user.id],
      );
      workspace=created.rows[0];
      await client.query(`insert into tenant_memberships(tenant_id,user_id,role,is_primary) values($1,$2,'owner',true)`,[workspace.id,user.id]);
    }
    await client.query('commit');
    return workspace;
  } catch(error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
