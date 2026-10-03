import { requireAnalyticsAccess } from '@/lib/analytics/sites';
import { getReport } from '@/lib/analytics/storage';
import { parseReportQuery } from '@/lib/analytics/query';
import { errorResponse } from '@/lib/analytics/http';
export async function GET(request:Request,{params}:{params:Promise<{siteId:string}>}){try{const {site}=await requireAnalyticsAccess((await params).siteId);const paramsQuery=new URL(request.url).searchParams;if(!paramsQuery.has('timezone'))paramsQuery.set('timezone',site.timezone);return Response.json(await getReport(site,parseReportQuery(paramsQuery)),{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e)}}
