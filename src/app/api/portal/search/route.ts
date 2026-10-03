import { listSites } from '@/lib/analytics/sites';
import { errorResponse } from '@/lib/analytics/http';
export async function GET(request:Request){try{const q=(new URL(request.url).searchParams.get('q')||'').trim().toLowerCase().slice(0,100);const sites=await listSites();return Response.json({results:q?sites.filter(s=>s.name.toLowerCase().includes(q)).slice(0,10).map(s=>({id:s.publicId,title:s.name,subtitle:s.environment,type:'analytics_app',url:'https://pulse.axxes.app/dashboard?site='+s.publicId})):[]},{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e)}}
