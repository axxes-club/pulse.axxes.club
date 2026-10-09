import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
export class AdmissionError extends Error { constructor(message='Request limit exceeded',status=429){super(message);this.status=status;} }
// Google HTTPS LB appends [actual client, LB IP]. Only the known tail is trusted.
// Direct Cloud Run ingress MUST be disabled before trusting this chain.
export function clientIp(headers,trusted=(process.env.SECURITY_TRUSTED_LB_IPS||'').split(',').map(x=>x.trim()).filter(Boolean)){
 const chain=(headers.get('x-forwarded-for')||'').split(',').map(x=>x.trim());
 const tail=chain.at(-1),client=chain.at(-2);
 return chain.length>=2&&trusted.includes(tail)&&isIP(client||'')?client:'untrusted';
}
export async function consume(query,identity,limit=120,seconds=60,cost=1,table='pulse_security_rate_limits'){
 if(!Number.isSafeInteger(limit)||limit<1||limit>2147483647||!Number.isSafeInteger(seconds)||seconds<1||seconds>2147483647||!Number.isSafeInteger(cost)||cost<1||cost>2147483647||!/^[a-z]+_security_rate_limits$/.test(table))throw new AdmissionError('Invalid admission policy',503);
 if(cost>limit)throw new AdmissionError();
 const key=createHash('sha256').update(identity).digest('hex');
 const result=await query(`WITH cleanup AS (DELETE FROM ${table} WHERE expires_at < statement_timestamp()-interval '1 hour' AND key<>$1 AND key IN (SELECT key FROM ${table} WHERE expires_at < statement_timestamp()-interval '1 hour' AND key<>$1 ORDER BY expires_at LIMIT 20 FOR UPDATE SKIP LOCKED)) INSERT INTO ${table}(key,hits,window_started_at,expires_at) VALUES($1,$2,statement_timestamp(),statement_timestamp()+($3::int*interval '1 second')) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN ${table}.window_started_at<=statement_timestamp()-($3::int*interval '1 second') THEN $2 ELSE LEAST(${table}.hits::bigint+$2::bigint,$4::bigint)::integer END,window_started_at=CASE WHEN ${table}.window_started_at<=statement_timestamp()-($3::int*interval '1 second') THEN statement_timestamp() ELSE ${table}.window_started_at END,expires_at=statement_timestamp()+($3::int*interval '1 second') WHERE $2<=$4 AND (${table}.window_started_at<=statement_timestamp()-($3::int*interval '1 second') OR (${table}.hits>=0 AND ${table}.hits<=$4-$2)) RETURNING hits`,[key,cost,seconds,limit]);
 if(result.rows.length!==1)throw new AdmissionError();
}
