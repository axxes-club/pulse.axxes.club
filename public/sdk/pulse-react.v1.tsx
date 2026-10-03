'use client';
import { createContext,useContext,useEffect,useState,type ReactNode } from 'react';
import { loadPulse,type PulseClient,type PulseOptions } from './pulse-sdk.v1.js';
const PulseContext=createContext<PulseClient|null>(null);
/** Download alongside pulse-sdk.v1.js and pulse-sdk.v1.d.ts into your app. */
export function PulseProvider({children,...options}:PulseOptions&{children:ReactNode}){
 const [client,setClient]=useState<PulseClient|null>(null);
 const {siteId,endpoint,environment,performance,consentRequired,identity}=options;
 useEffect(()=>{let mounted=true;loadPulse({siteId,endpoint,environment,performance,consentRequired,identity}).then(value=>{if(mounted)setClient(value)}).catch(()=>{});return ()=>{mounted=false}},[siteId,endpoint,environment,performance,consentRequired,identity]);
 return <PulseContext.Provider value={client}>{children}</PulseContext.Provider>;
}
export function usePulse(){return useContext(PulseContext)}
