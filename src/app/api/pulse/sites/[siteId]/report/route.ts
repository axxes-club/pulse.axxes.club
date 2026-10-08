import { requireAnalyticsAccess } from '@/lib/analytics/sites';
import { getReport } from '@/lib/analytics/storage';
import { parseSiteReportQuery } from '@/lib/analytics/query';
import { errorResponse } from '@/lib/analytics/http';
export async function GET(request:Request,{params}:{params:Promise<{siteId:string}>}){try{const {site}=await requireAnalyticsAccess((await params).siteId);return Response.json(await getReport(site,parseSiteReportQuery(new URL(request.url).searchParams,site)),{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e)}}
