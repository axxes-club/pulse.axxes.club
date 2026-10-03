"use client";
import { useEffect } from 'react';
/** Optional same-domain bootstrap; built-in apps use validated server-rendered public IDs. */
export function AXXESPulse({appKey,tenantId}:{appKey:string;tenantId:string}){
 useEffect(()=>{
  const script=document.createElement('script');script.async=true;script.src='https://pulse.axxes.app/axxes.v1.js';script.dataset.app=appKey;script.dataset.tenant=tenantId;document.head.appendChild(script);
  return ()=>{script.remove();const target=window as any;target.__axxesPulseGeneration=(target.__axxesPulseGeneration||0)+1;delete target.__axxesPulseSetup;if(target.pulse){target.pulse.flush();target.pulse.destroy()}};
 },[appKey,tenantId]);return null;
}
