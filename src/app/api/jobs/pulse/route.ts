import { timingSafeEqual } from 'node:crypto';
import { analyticsPool,metadataPool } from '@/lib/analytics/postgres';
import { drainNativeOutbox } from "@/lib/analytics/native-outbox";
import { maintenanceSql } from '@/lib/analytics/maintenance';
import { errorResponse } from '@/lib/analytics/http';
export async function POST(request:Request){const expected=process.env.PULSE_JOB_SECRET;const actual=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(!expected||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return new Response('Unauthorized',{status:401});try{const delivered=await drainNativeOutbox();const client=await analyticsPool().connect();try{await client.query(maintenanceSql)}finally{client.release()}await metadataPool().query("delete from pulse_verifications where expires_at<now(); delete from pulse_session_handoffs where expires_at<now()");return Response.json({ok:true,delivered,rawRetentionDays:90,aggregateRetentionDays:365},{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e)}}
