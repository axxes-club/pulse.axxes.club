'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
type Settings = {
  site: {name:string;timezone:string;enabled:boolean;allowedOrigins:string[];environment:string;collection:string;identityMode:'ephemeral'|'persistent'};
  credentials:Array<{id:string;createdAt:string;revokedAt:string|null}>;
};
export function SiteSettings({siteId,canManage,demo}:{siteId?:string;canManage:boolean;demo:boolean}) {
  const router=useRouter();
  const [data,setData]=useState<Settings|null>(null);
  const [status,setStatus]=useState('');
  const [loadError,setLoadError]=useState('');
  const [retry,setRetry]=useState(0);
  const [pending,setPending]=useState(false);
  const [secret,setSecret]=useState('');
  useEffect(()=>{
    setData(null);setSecret('');setStatus('');setLoadError('');
    if(!siteId||!canManage||demo)return;
    const controller=new AbortController();
    fetch(`/api/pulse/sites/${siteId}/settings`,{signal:controller.signal})
      .then(async response=>{
        const body=await response.json();
        if(!response.ok)throw Error(body.error||'Settings unavailable');
        if(!controller.signal.aborted)setData(body);
      }).catch(error=>{if(!controller.signal.aborted)setLoadError(error instanceof Error?error.message:'Settings unavailable');});
    return ()=>controller.abort();
  },[siteId,canManage,demo,retry]);
  async function request(method:string,body?:unknown,path='settings') {
    setPending(true);setStatus('');
    try {
      const response=await fetch(`/api/pulse/sites/${siteId}/${path}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Could not save changes');
      if(result.credential)setSecret(result.credential);
      setStatus('Changes saved.');router.refresh();
      const settings=await fetch(`/api/pulse/sites/${siteId}/settings`);
      if(settings.ok)setData(await settings.json());
    } catch(error) {setStatus(error instanceof Error?error.message:'Could not save changes');}
    finally {setPending(false);}
  }
  async function copySecret() {
    try {await navigator.clipboard.writeText(secret);setStatus('Credential copied.');}
    catch {setStatus('Select and copy the credential below.');}
  }
  return <>
    <div className="workspace-title"><div><h1>App settings</h1><p>Control collection, reporting, and scoped server access.</p></div></div>
    {demo||!canManage ? <div className="empty-report"><h2>{demo?'Your app, your settings.':'Administrator access required'}</h2><p>{demo?'Sign in to manage a real app.':'Ask an organization owner or administrator to change collection settings.'}</p></div> : !siteId ? <p>Select an app to manage its settings.</p> : loadError ? <div className="empty-report"><p role="alert">{loadError}</p><button className="button secondary" onClick={()=>setRetry(value=>value+1)}>Retry settings</button></div> : data ? <>
      <div className="integration-form">
        <label>App name<input value={data.site.name} onChange={event=>setData({...data,site:{...data.site,name:event.target.value}})}/></label>
        <label>Reporting timezone<input value={data.site.timezone} onChange={event=>setData({...data,site:{...data.site,timezone:event.target.value}})}/></label>
        <label>Collection<select value={String(data.site.enabled)} onChange={event=>setData({...data,site:{...data.site,enabled:event.target.value==='true'}})}><option value="true">Enabled</option><option value="false">Paused</option></select></label>
        <label>Visitor identity<select value={data.site.identityMode} onChange={event=>setData({...data,site:{...data.site,identityMode:event.target.value as Settings['site']['identityMode']}})}><option value="ephemeral">Ephemeral · default traffic analytics</option><option value="persistent">Persistent · opt-in retention</option></select></label>
        <p className="muted">Enable persistent identity only with the visitor consent your app requires. After changing identity mode, update your tracker or SDK installation in Integrations. Retention starts with new opted-in visits; earlier traffic remains anonymous.</p>
        {data.site.collection==='browser'&&<label>Allowed origins · one per line<textarea value={data.site.allowedOrigins.join('\n')} onChange={event=>setData({...data,site:{...data.site,allowedOrigins:event.target.value.split('\n').filter(Boolean)}})}/></label>}
      </div>
      <button className="button primary" disabled={pending} onClick={()=>request('PATCH',{name:data.site.name,timezone:data.site.timezone,enabled:data.site.enabled,allowedOrigins:data.site.allowedOrigins,identityMode:data.site.identityMode})}>{pending?'Saving…':'Save settings'}</button>
      <section className="connection-list"><h2>Server credentials</h2><p className="muted">Scoped to this app and environment. Secrets are shown once and belong only in server code.</p>
        {data.credentials.map(key=><div className="connection-row" key={key.id}><div>Created {new Date(key.createdAt).toLocaleDateString()}<p className="muted">{key.revokedAt?'Revoked':'Active'}</p></div>{!key.revokedAt&&<button className="button secondary small" disabled={pending} onClick={()=>request('DELETE',{credentialId:key.id})}>Revoke</button>}</div>)}
        <button className="button secondary small" disabled={pending||!data.site.enabled} onClick={()=>request('POST',undefined,'credentials')}>Create server credential</button>
        {secret&&<div className="installation-code"><pre><code>{secret}</code></pre><div style={{padding:16}}><button className="button secondary small" onClick={copySecret}>Copy credential</button><p>Copy now. Pulse cannot show this secret again.</p></div></div>}
      </section>
    </> : <p>Loading app settings…</p>}
    {status&&<p className="demo-notice" role="status">{status}</p>}
  </>;
}
