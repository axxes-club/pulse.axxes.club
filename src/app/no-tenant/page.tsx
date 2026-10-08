import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PulseBrand } from '@/components/pulse/brand';
import { requestAuth } from '@/lib/auth';
import { listMemberships } from '@/lib/context';
import { safePulseReturn,pulseSignInPath } from "@/lib/auth-return";
import { WorkspaceForm } from './workspace-form';
export default async function NoTenantPage({searchParams}:{searchParams:Promise<{returnTo?:string}>}){
  const returnTo=safePulseReturn((await searchParams).returnTo);
  const session=await (await requestAuth()).api.getSession({headers:await headers()});
  if(!session?.user) redirect(pulseSignInPath(returnTo));
  if((await listMemberships(session.user.id)).length) redirect(returnTo);
  return <main className="grid min-h-dvh place-items-center px-4"><div className="w-full max-w-sm">
    <PulseBrand/>
    <h1 className="mt-10 text-2xl font-semibold tracking-tight">Create your Pulse workspace</h1>
    <p className="mt-2 text-sm text-muted">Give your workspace a name, then connect your first app and start measuring traffic.</p>
    <WorkspaceForm returnTo={returnTo}/>
  </div></main>;
}
