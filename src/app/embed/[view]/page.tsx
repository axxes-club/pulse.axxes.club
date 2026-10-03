import { getContext } from '@/lib/context';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Dashboard } from '@/components/pulse/dashboard';
import { EmbedFrame } from '@/components/pulse/embed-frame';
export default async function Page({params,searchParams}:{params:Promise<{view:string}>;searchParams:Promise<Record<string,string|undefined>>}){const {view}=await params;if(!await getContext())return <main style={{padding:32}}><h1>Open Pulse with your AXXES account</h1><p>Sign in once, then refresh this report.</p><a href='/sign-in' target='_blank' rel='noopener noreferrer'>Sign in to Pulse ↗</a></main>;if(!['overview','realtime','audience','acquisition','events','funnels','performance','retention','pages'].includes(view))notFound();return <Suspense><EmbedFrame><Dashboard view={view} search={await searchParams}/></EmbedFrame></Suspense>}
