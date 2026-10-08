'use server';
import { cookies,headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requestAuth } from '@/lib/auth';
import { ORG_COOKIE } from '@/lib/context';
import { ensurePulseWorkspace } from '@/lib/workspace';
export async function createPulseWorkspace(_previous:{error:string},form:FormData):Promise<{error:string}> {
  const requestHeaders=await headers();
  const session=await (await requestAuth()).api.getSession({headers:requestHeaders});
  if (!session?.user) return {error:'Please sign in again to create your workspace.'};
  const name=form.get('name');
  if(typeof name!=='string'||!name.trim()||name.trim().length>100||/[\u0000-\u001f\u007f]/.test(name)) return {error:'Enter a workspace name between 1 and 100 characters.'};
  let workspace;
  try {
    workspace=await ensurePulseWorkspace(session.user,name);
  } catch {
    return {error:'Your workspace could not be created. Please try again.'};
  }
  (await cookies()).set(ORG_COOKIE,workspace.id,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'||requestHeaders.get('x-forwarded-proto')==='https',path:'/',maxAge:60*60*24*365});
  redirect('/dashboard');
}
