import { notFound } from 'next/navigation'
import { Dashboard } from '@/components/pulse/dashboard'
export default async function Page({params,searchParams}:{params:Promise<{view:string}>;searchParams:Promise<Record<string,string|undefined>>}){const {view}=await params;if(!['realtime','audience','acquisition','events','integrations','funnels','performance','retention','pages','settings'].includes(view))notFound();return <Dashboard view={view} search={await searchParams}/>}
