'use client';
import { createContext,useContext,useEffect,useState,type ReactNode } from 'react';
import { loadPulse,type PulseClient,type PulseOptions } from './pulse-sdk.v1.js';
const PulseContext=createContext<PulseClient|null>(null);
/** Download alongside pulse-sdk.v1.js and pulse-sdk.v1.d.ts into your app. */
export function PulseProvider({children,...options}:PulseOptions&{children:ReactNode}){
 const [loaded,setLoaded]=useState<{key:string;client:PulseClient|null}|null>(null);
 const {siteId,endpoint,environment,performance,consentRequired,identity}=options;
 const key=JSON.stringify({siteId,endpoint,environment,performance,consentRequired,identity});
 useEffect(()=>{let mounted=true;loadPulse({siteId,endpoint,environment,performance,consentRequired,identity}).then(value=>{if(mounted)setLoaded({key,client:value})}).catch(error=>{if(mounted){setLoaded({key,client:null});console.warn(error.message)}});return ()=>{mounted=false}},[key,siteId,endpoint,environment,performance,consentRequired,identity]);
 return <PulseContext.Provider value={loaded?.key===key?loaded.client:null}>{children}</PulseContext.Provider>;
}
export function usePulse(){return useContext(PulseContext)}
