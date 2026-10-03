import { getContext } from '@/lib/context';
import { metadataPool } from '@/lib/analytics/postgres';
import { errorResponse } from '@/lib/analytics/http';
import { AnalyticsError } from '@/lib/analytics/access';
export async function GET(){try{const ctx=await getContext();if(!ctx)throw new AnalyticsError('Sign in with AXXES',401);const result=await metadataPool().query('select a.id,a.kind,a.created_at as "createdAt",s.name as "appName",s.public_id as "appId" from pulse_activity a left join pulse_sites s on s.id=a.site_id where a.tenant_id=$1 order by a.created_at desc limit 20',[ctx.tenant.id]);return Response.json({activity:result.rows},{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e)}}
