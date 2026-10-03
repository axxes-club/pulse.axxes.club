import { Suspense } from 'react'
import { ReportShell } from '@/components/pulse/report-shell'
import { ReportView } from '@/components/pulse/report-view'
import { demoEvents } from '@/lib/analytics/demo'
import { summarizeEvents } from '@/lib/analytics/metrics'
import { reportWindow } from '@/lib/analytics/timezone'
import { parseReportQuery } from '@/lib/analytics/query'
export default async function Demo({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const search=await searchParams;const allowed=['overview','realtime','audience','acquisition','events','integrations','funnels','performance','retention','pages'];const view=allowed.includes(search.view||'')?search.view!:'overview';const params=new URLSearchParams();for(const [key,value] of Object.entries(search))if(value)params.set(key,value);const now=new Date(),events=demoEvents(now),query=parseReportQuery(params),data=summarizeEvents(events,query,now,{identityMode:"persistent"});const window=reportWindow(query.range,query.timezone||'UTC',now,query.from,query.to);const funnelEvents=view==='funnels'?events.filter(e=>Date.parse(e.time)>=window.start && Date.parse(e.time)<window.end&&e.environment===query.environment&&(!query.source||e.source===query.source)):[];return <ReportShell demo view={view}><Suspense fallback={<p>Loading sample analytics…</p>}><ReportView demo view={view} data={data} events={funnelEvents}/></Suspense></ReportShell>}
