import { safePulseReturn,pulseSignInPath } from '@/lib/auth-return';
import { getCustomerBrand } from '@/lib/white-label';
import { BrandScope } from '@/components/brand';
import { getContext } from '@/lib/context';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Dashboard } from '@/components/pulse/dashboard';
import { EmbedFrame } from '@/components/pulse/embed-frame';
export default async function Page({params,searchParams}:{params:Promise<{view:string}>;searchParams:Promise<Record<string,string|undefined>>}){const {view}=await params;const search=await searchParams;const reportSearch=new URLSearchParams(Object.entries(search).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));const returnTo=safePulseReturn(`/embed/${view}?${reportSearch}`);const ctx=await getContext();if(!ctx)return <main style={{padding:32}}><h1>Sign in to Pulse</h1><p>Continue to this report in Pulse.</p><a href={pulseSignInPath(returnTo)} target='_blank' rel='noopener noreferrer'>Sign in to Pulse ↗</a></main>;if(!['overview','realtime','audience','acquisition','events','funnels','performance','retention','pages'].includes(view))notFound();return <BrandScope brand={await getCustomerBrand(ctx.tenant.id)}><Suspense><EmbedFrame><Dashboard view={view} search={search}/></EmbedFrame></Suspense></BrandScope>}
