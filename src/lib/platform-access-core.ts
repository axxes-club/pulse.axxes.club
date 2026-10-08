export interface Sql {query(text:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>;}
export class PlatformIdentityError extends Error { readonly status=503; constructor(){super('Identity service unavailable');} }
async function query(db:Sql,text:string,values?:unknown[]){try{return await db.query(text,values)}catch{throw new PlatformIdentityError()}}
export type AccessDecision={allowed:boolean,reason:'allowed'|'account_suspended'|'organization_suspended'|'membership_missing'|'service_denied',version:string};
export async function evaluateAccess(db:Sql,userId:string,organizationId?:string,serviceId?:string):Promise<AccessDecision>{
 const u=(await query(db,`SELECT u.id,coalesce(p.state,'active') AS state,coalesce(p.revision,0)::text AS version FROM "user" u LEFT JOIN platform_subject_policy p ON p.subject_kind='user' AND p.subject_id=u.id WHERE u.id=$1`,[userId])).rows[0];
 if(!u||u.state!=='active')return {allowed:false,reason:'account_suspended',version:String(u?.version??'0')};
 const version=String(u.version);
 if(organizationId){
  const t=(await query(db,`SELECT status,deleted_at FROM tenants WHERE id=$1`,[organizationId])).rows[0];
  if(!t||t.deleted_at||['suspended','cancelled'].includes(String(t.status)))return {allowed:false,reason:'organization_suspended',version};
  const m=(await query(db,`SELECT id FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,[userId,organizationId])).rows[0];
  if(!m)return {allowed:false,reason:'membership_missing',version};
  if(serviceId){const organizationPolicy=(await query(db,`SELECT allowed FROM platform_organization_entitlements WHERE tenant_id=$1 AND service_id=$2`,[organizationId,serviceId])).rows[0];if(organizationPolicy?.allowed===false)return {allowed:false,reason:'service_denied',version};const e=(await query(db,`SELECT allowed FROM platform_entitlements WHERE user_id=$1 AND tenant_id=$2 AND service_id=$3`,[userId,organizationId,serviceId])).rows[0];if(e?.allowed===false)return {allowed:false,reason:'service_denied',version};}
 }
 return {allowed:true,reason:'allowed',version};
}

export function createPlatformAccess(db:Sql,serviceId?:string){return {allowed:async(userId:string,organizationId?:string)=>(await evaluateAccess(db,userId,organizationId,serviceId)).allowed,sessionAllowed:async(userId:string,sessionId?:string)=>{if(!sessionId||!(await evaluateAccess(db,userId)).allowed)return false;return !!(await query(db,`SELECT id FROM "session" WHERE id=$1 AND user_id=$2 AND expires_at>now()`,[sessionId,userId])).rows[0];}};}
export function wrapPlatformAuth<T extends object>(base:T,check:(userId:string,sessionId?:string)=>Promise<boolean>,beforeRequest?:(r:Request)=>Promise<boolean>):T{
 const sessionAllowed=async(value:unknown):Promise<boolean>=>{if(value instanceof Response)return sessionAllowed(await value.clone().json());if(!value||typeof value!=='object')return true;if('response' in value)return sessionAllowed((value as {response:unknown}).response);if(!('user' in value))return true;const data=value as {user?:{id?:unknown};session?:{id?:unknown}};return typeof data.user?.id==='string'?check(data.user.id,typeof data.session?.id==='string'?data.session.id:undefined):false;};
 return new Proxy(base as object,{get(target,key,receiver){
  const value:unknown=Reflect.get(target,key,receiver);
  if(key==='api'){if(!value||typeof value!=='object')throw new Error('Invalid authentication API');return new Proxy(value,{get(api,method){const fn:unknown=Reflect.get(api,method);if(method!=='getSession')return fn;if(typeof fn!=='function')throw new Error('Invalid session method');return async(...args:unknown[])=>{const session:unknown=await Reflect.apply(fn,api,args);if(await sessionAllowed(session))return session;if(session instanceof Response)return Response.json(null,{status:401,headers:{'cache-control':'no-store'}});if(session&&typeof session==='object'&&'response' in session)return {...session,response:null,headers:new Headers()};return null;};}});}
  if(key==='handler'){if(typeof value!=='function')throw new Error('Invalid authentication handler');return async(request:Request)=>{try{const path=new URL(request.url).pathname;if(!path.endsWith('/sign-out')){const api:unknown=Reflect.get(target,'api');if(!api||typeof api!=='object')throw new Error('Invalid authentication API');const getSession:unknown=Reflect.get(api,'getSession');if(typeof getSession!=='function')throw new Error('Invalid session method');const session:unknown=await Reflect.apply(getSession,api,[{headers:request.headers}]);if(!await sessionAllowed(session)||beforeRequest&&!await beforeRequest(request))return Response.json({code:'ACCOUNT_ACCESS_DENIED',message:'This account is not eligible for access.'},{status:401,headers:{'cache-control':'no-store'}});}return await Reflect.apply(value,target,[request]);}catch{return Response.json({code:'IDENTITY_UNAVAILABLE',message:'Sign-in service is temporarily unavailable.'},{status:503,headers:{'cache-control':'no-store'}});}};}
  return value;
 }}) as T;
}
