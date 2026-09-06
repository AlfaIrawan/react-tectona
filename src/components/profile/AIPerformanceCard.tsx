import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, RefreshCw } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getSession } from '@/auth/authService'
import { tectonaAgentRuntimeApiBase } from '@/lib/api/gatewayBase'
import { fetchModelCatalog, type ModelCatalog } from '@/lib/api/modelCatalogApi'
import { P95_HELP, performancePeriods, responseComparison, summarizePerformance, type PerformanceEvent } from '@/lib/aiPerformance'
import { cn } from '@/lib/utils'

type Data = { events: PerformanceEvent[]; updatedAt: string; days: number }
const missing = 'Not enough data yet'
const seconds = (value: number | null) => value === null ? '—' : `${(value/1000).toFixed(1)}s`
const percent = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`
function Section({title, description, children}: {title:string;description?:string;children:ReactNode}) {
  return <section className="rounded-lg border border-border/60 p-3"><h3 className="text-sm font-semibold">{title}</h3>{description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}{children}</section>
}
function Health({value}: {value: string | null}) {
  return value ? <span title="Success rate: Healthy ≥99%, Degraded ≥97%, Critical <97%." className={cn('rounded-full px-2 py-0.5 text-[10px]',value==='Healthy'?'bg-emerald-50 text-emerald-700':value==='Degraded'?'bg-amber-50 text-amber-700':'bg-red-50 text-red-700')}>{value}</span> : <span title={missing}>—</span>
}
export function AIPerformanceCard() {
  const [days,setDays] = useState<7|30|90>(30)
  const [revision,setRevision] = useState(0)
  const [data,setData] = useState<Data|null>(null)
  const [catalog,setCatalog] = useState<ModelCatalog|null>(null)
  const [catalogError,setCatalogError] = useState(false)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(false)
  const subject = getSession()?.user.id
  useEffect(() => {
    const controller=new AbortController()
    let active=true
    const timeout=window.setTimeout(()=>controller.abort(),20000)
    setLoading(true); setError(false); setData(null); setCatalog(null); setCatalogError(false)
    const token=getSession()?.token
    const load=async () => {
      try {
        if (!token) throw new Error('Missing session')
        const response=await fetch(`${tectonaAgentRuntimeApiBase()}/v1/agent/ai-performance?days=${days}`, {
          signal:controller.signal,cache:'no-store',headers:{Authorization:`Bearer ${token}`},
        })
        if (!response.ok) throw new Error('Performance unavailable')
        const result=await response.json() as Data
        if (!Array.isArray(result.events) || !Number.isFinite(Date.parse(result.updatedAt))) throw new Error('Invalid response')
        if(active) setData(result)
      } catch { if(active) setError(true) }
      finally { if(active) setLoading(false) }
    }
    const loadCatalog=fetchModelCatalog(controller.signal,token).then(result=>{if(active)setCatalog(result)}).catch(()=>{if(active)setCatalogError(true)})
    void Promise.all([load(),loadCatalog]).finally(()=>window.clearTimeout(timeout))
    return ()=>{active=false;window.clearTimeout(timeout);controller.abort()}
  },[days,revision,subject])
  const refresh=()=>setRevision(value=>value+1)
  const now=data ? Date.parse(data.updatedAt) : Date.now()
  const {current,previous}=performancePeriods(data?.events??[],days,now)
  const stats=summarizePerformance(current)
  const prior=summarizePerformance(previous)
  const trend=Array.from({length:days},(_,index)=> {
    const end=now-(days-1-index)*86400000
    const summary=summarizePerformance(current.filter(event=>Date.parse(event.occurred_at)>end-86400000 && Date.parse(event.occurred_at)<=end))
    return {date:new Date(end).toLocaleDateString('en-US',{month:'short',day:'numeric'}),average:summary.average===null?null:summary.average/1000,p95:summary.p95===null?null:summary.p95/1000}
  })
  const models=new Map<string,{key:string;label:string;model:string;provider:string;providerId?:string}>()
  for(const model of catalog?.models??[]) {
    // Protocol is used consistently with recorded invocations, never model-family matching.
    const provider=catalog?.providers.find(p=>p.id===model.providerId)?.protocol??''
    const key=`${model.providerId}|${model.modelId}`
    models.set(key,{key,label:model.name,model:model.modelId,provider,providerId:model.providerId})
  }
  for(const event of current) {
    const key=`${event.provider_id??event.provider}|${event.model}`
    if(!models.has(key))models.set(key,{key,label:event.model,model:event.model,provider:event.provider,providerId:event.provider_id})
  }
  const interactions=[...new Set(current.map(event=>event.interaction))]
  const reliability=[['Successful',stats.success],['Failed',stats.error],['Timeout',stats.timeout],['Rate limited',stats.rateLimited],['Retried',stats.retried],['Cancelled',stats.cancelled]] as const
  return <section className="rounded-xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-5 py-4">
      <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Activity className="h-4 w-4" /></div><div><h2 className="text-base font-semibold">AI Performance</h2><p className="mt-0.5 text-sm text-muted-foreground">Monitor the responsiveness and reliability of your AI interactions across TECTONA.</p></div></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><div className="flex rounded-md border border-border/60 p-0.5">{([7,30,90] as const).map(value=><button key={value} type="button" aria-pressed={days===value} onClick={()=>setDays(value)} className={cn('rounded px-2 py-1',days===value&&'bg-muted font-medium text-foreground')}>{value}D</button>)}</div><span>{loading?'Loading…':error?'Update failed':data?`Updated ${new Date(data.updatedAt).toLocaleTimeString('en-US')}`:'Not updated'}</span><button aria-label="Refresh AI performance" disabled={loading} onClick={refresh} className="rounded-md p-1.5 hover:bg-muted disabled:opacity-50"><RefreshCw className={cn('h-3.5 w-3.5',loading&&'animate-spin')} /></button></div>
    </header>
    <div className="space-y-4 px-5 py-4" aria-busy={loading}>
      {loading ? <div aria-label="Loading AI performance" className="space-y-4"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0,1,2,3].map(i=><div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div><div className="h-44 animate-pulse rounded-lg bg-muted" /><div className="grid gap-4 lg:grid-cols-2">{[0,1].map(i=><div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}</div></div> : error ? <div role="alert" className="rounded-lg border border-border/60 p-5"><h3 className="text-sm font-semibold">Unable to load AI performance</h3><p className="mt-1 text-xs text-muted-foreground">Performance information is temporarily unavailable.</p><button onClick={refresh} className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs">Retry</button></div> : !current.length ? <div className="rounded-lg border border-dashed border-border/70 px-5 py-8 text-center"><h3 className="text-sm font-semibold">No AI performance data in this period</h3><p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Metrics appear after authenticated AI interactions are recorded. Older token-only activity cannot reconstruct response times or outcomes.</p><Link to="/projects" className="mt-4 inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Explore AI Features</Link></div> : <>
        <p className="text-xs text-muted-foreground">Personal model invocations, including retry wait time. Fallback models are measured separately; cancelled invocations are excluded from success rate.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
          ['Average response',seconds(stats.average),responseComparison(stats.average,prior.average)],
          ['P95 response',seconds(stats.p95),P95_HELP],
          ['Success rate',percent(stats.success),stats.health??missing],
          ['Failed requests',percent(stats.failed),`${stats.failedCount} failed invocations (including timeout and rate limiting)`],
        ].map(([label,value,detail])=><div key={label} className="rounded-lg border border-border/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p title={value==='—'?missing:undefined} className="mt-1 text-xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>)}</div>
        <Section title="Response Time Trend" description="Average and P95 response time. Each point summarizes a 24-hour interval.">
          {stats.average===null ? <p className="mt-3 text-xs text-muted-foreground">No response-time measurements in this period.</p> : <div className="mt-3 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / .55)" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize:10}} minTickGap={24} /><YAxis unit="s" tickLine={false} axisLine={false} tick={{fontSize:10}} /><Tooltip formatter={value=>typeof value==='number'?`${value.toFixed(2)}s`:'—'} /><Legend verticalAlign="bottom" wrapperStyle={{fontSize:11}} /><Line dataKey="average" name="Average response" stroke="#2563eb" strokeWidth={2} dot={{r:2}} connectNulls={false} /><Line dataKey="p95" name="P95 response" stroke="#7c3aed" strokeWidth={2} dot={{r:2}} connectNulls={false} /></LineChart></ResponsiveContainer></div>}
        </Section>
        <div className="grid gap-4 lg:grid-cols-2"><Section title="AI Reliability" description="Runtime outcomes of your AI interactions."><div className="mt-3 space-y-3">{reliability.map(([label,value])=><div key={label}><div className="flex justify-between gap-2 text-xs"><span title={label==='Retried'?'Share of invocations automatically retried after an unsuccessful attempt.':label==='Rate limited'?'Requests temporarily limited by an AI service or model.':undefined}>{label}</span><span title={value===null?missing:undefined}>{percent(value)}</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{width:`${Math.min(100,value??0)}%`}} /></div></div>)}</div></Section>
          <Section title="Performance by Interaction Type" description="Compare responsiveness across TECTONA AI capabilities."><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr>{['Interaction','Avg response','Success','Status'].map(label=><th key={label} className="pb-2 font-medium">{label}</th>)}</tr></thead><tbody>{interactions.map(label=>{const row=summarizePerformance(current.filter(event=>event.interaction===label));return <tr key={label} className="border-t border-border/40"><td className="py-3 pr-2">{label}</td><td>{seconds(row.average)}</td><td>{percent(row.success)}</td><td><Health value={row.health} /></td></tr>})}</tbody></table></div></Section></div>
        <Section title="Model Performance" description="Exact model versions from current configuration and your recorded interactions.">{catalogError&&<p className="mt-2 text-xs text-amber-700">Model catalog unavailable. Showing models present in your recorded performance data.</p>}<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-muted-foreground"><tr>{['Model','Avg response','P95','Success rate','Timeout','Status'].map(label=><th key={label} className="pb-2 font-medium" title={label==='P95'?P95_HELP:undefined}>{label}</th>)}</tr></thead><tbody>{[...models.values()].map(model=>{const row=summarizePerformance(current.filter(event=>event.model===model.model&&(model.providerId ? event.provider_id===model.providerId : event.provider===model.provider)));return <tr key={model.key} className="border-t border-border/40"><td className="py-3 pr-3 font-medium">{model.label}<p className="text-[10px] font-normal text-muted-foreground">{model.provider}</p></td><td title={missing}>{seconds(row.average)}</td><td title={P95_HELP}>{seconds(row.p95)}</td><td>{percent(row.success)}</td><td>{percent(row.timeout)}</td><td><Health value={row.health} /></td></tr>})}</tbody></table></div></Section>
      </>}
    </div>
  </section>
}
