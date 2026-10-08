import 'server-only';
import {Pool} from 'pg';
import {consume,clientIp,AdmissionError} from './admission-core.mjs';
export {clientIp};
const shared=globalThis as unknown as {pulseSecurityPool?:Pool};
function pool(){const url=process.env.DATABASE_URL;if(!url)throw Error('Security admission unavailable');const active=shared.pulseSecurityPool??=new Pool({connectionString:url,max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});if(!active.listenerCount('error'))active.on('error',()=>console.error('Security admission database interrupted'));return active;}
export async function consumeAdmission(identity:string,limit=120,seconds=60,cost=1){try{await consume((sql,args)=>pool().query(sql,args),identity,limit,seconds,cost)}catch(error){if(error instanceof AdmissionError)throw error;throw new AdmissionError('Admission unavailable',503)}}
export async function admitWrite(ctx:{tenant:{id:string};userId:string},scope='write'){await consumeAdmission('global:'+scope,1000);await consumeAdmission('tenant:'+ctx.tenant.id+':'+scope,240);await consumeAdmission('user:'+ctx.userId+':'+scope,120);}

export async function admitRequest(request:Request,scope='auth'){const method=request.method==='GET'?'read':'write';await consumeAdmission('request-global:'+scope+':'+method,method==='read'?3000:300);await consumeAdmission('request-client:'+scope+':'+method+':'+clientIp(request.headers),method==='read'?120:20);}
export function rateLimited(handler:(request:Request)=>Promise<Response>,scope='auth'){return async(request:Request)=>{try{await admitRequest(request,scope);return await handler(request)}catch(error){const status=(error as {status?:number}).status;return Response.json({error:status===429?'Request limit exceeded':'Admission unavailable'},{status:status===429?429:503,headers:{'cache-control':'no-store'}})}}}
