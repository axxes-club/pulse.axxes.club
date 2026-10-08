'use client';
import { useActionState } from 'react';
import { createPulseWorkspace } from '@/lib/actions/workspace';
export function WorkspaceForm({returnTo="/dashboard"}:{returnTo?:string}){
  const [state,action,pending]=useActionState(createPulseWorkspace,{error:''});
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="returnTo" value={returnTo}/><label className="block text-sm">Workspace name<input name="name" required maxLength={100} autoComplete="organization" placeholder="Your team or business" className="input mt-2 w-full" disabled={pending}/></label>
    {state.error&&<p role="alert" className="text-sm text-muted">{state.error}</p>}
    <button className="btn-primary" disabled={pending}>{pending?'Creating workspace…':'Create workspace'}</button>
  </form>;
}
