import { Dashboard } from '@/components/pulse/dashboard'
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){return <Dashboard search={await searchParams}/>}
