import { Link } from 'react-router-dom'
import { BarChart3, Building2, ClipboardCheck, PieChart, Shield, Sparkles, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { EGM_BASE } from '@/modules/enterprise-governance-model/egmPaths'

const KPI = [
  { key: 't', title: 'Governance Templates', value: '12', sub: 'Reusable operating models', tone: 'from-slate-50 to-sky-50/60' },
  { key: 'w', title: 'Workflow Policies', value: '8', sub: 'Delivery lifecycle standards', tone: 'from-indigo-50/80 to-violet-50/50' },
  { key: 's', title: 'SLA Policies', value: '5', sub: 'Operational response rules', tone: 'from-emerald-50/80 to-cyan-50/40' },
  { key: 'a', title: 'Approval Models', value: '6', sub: 'Decision and escalation matrices', tone: 'from-amber-50/80 to-orange-50/40' },
  { key: 'n', title: 'Naming Standards', value: '14', sub: 'Enterprise naming conventions', tone: 'from-slate-50 to-blue-50/50' },
  { key: 'c', title: 'Compliance Rules', value: '10', sub: 'Automated scoring rules', tone: 'from-sky-50/70 to-indigo-50/60' },
]

const MODEL_DIST = [
  { name: 'Enterprise Controlled', pct: 58, color: 'bg-blue-600' },
  { name: 'Agile Product', pct: 20, color: 'bg-emerald-500' },
  { name: 'Innovation Lab', pct: 22, color: 'bg-violet-500' },
  { name: 'Lightweight Team', pct: 12, color: 'bg-slate-400' },
]

const COVERAGE = [
  { label: 'Covered', value: 62, tone: 'text-emerald-700 dark:text-emerald-300' },
  { label: 'Partial', value: 24, tone: 'text-amber-700 dark:text-amber-300' },
  { label: 'Unconfigured', value: 14, tone: 'text-slate-600 dark:text-slate-300' },
]

const HEALTH = [
  { label: 'Published', v: 54 },
  { label: 'Draft', v: 18 },
  { label: 'Deprecated', v: 6 },
  { label: 'Missing owner', v: 4 },
]

const RECENT = [
  { title: 'Enterprise Baseline Governance', when: '2h ago', actor: 'GRC Ops', type: 'Template' },
  { title: 'Stage Gate v3', when: 'Yesterday', actor: 'PMO', type: 'Workflow' },
  { title: 'SLA Enterprise P2', when: 'May 12', actor: 'Platform Admin', type: 'SLA' },
]

const USAGE = [
  { ws: 'Portfolio Office', model: 'Enterprise Controlled', pct: 92 },
  { ws: 'Delivery Hub', model: 'Agile Product', pct: 78 },
  { ws: 'Innovation Lab', model: 'Innovation Lab', pct: 65 },
]

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon: typeof Shield
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/20 p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.06] text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function GovernanceOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {KPI.map((k) => (
          <div
            key={k.key}
            className={cn(
              'rounded-2xl border border-border/50 bg-gradient-to-br p-4 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]',
              k.tone
            )}
          >
            <p className="text-[11px] font-medium text-muted-foreground">{k.title}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{k.value}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Governance operating model overview" subtitle="Template distribution across the estate" icon={PieChart}>
          <div className="space-y-3">
            {MODEL_DIST.map((m) => (
              <div key={m.name}>
                <div className="flex justify-between text-[11px] font-medium">
                  <span>{m.name}</span>
                  <span className="tabular-nums text-muted-foreground">{m.pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full', m.color)} style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Link to={`${EGM_BASE}/templates`} className="text-xs font-semibold text-primary hover:underline">
              View templates
            </Link>
          </div>
        </Panel>

        <Panel title="Policy coverage" subtitle="Workspaces covered by governance templates" icon={ClipboardCheck}>
          <div className="flex flex-wrap gap-2">
            {COVERAGE.map((c) => (
              <div key={c.label} className="flex min-w-[100px] flex-1 flex-col rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</span>
                <span className={cn('mt-1 text-xl font-bold tabular-nums', c.tone)}>{c.value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Governance asset health" subtitle="Published vs draft vs deprecated posture" icon={BarChart3}>
          <div className="grid grid-cols-2 gap-2">
            {HEALTH.map((h) => (
              <div key={h.label} className="rounded-lg border border-border/50 bg-muted/20 px-2 py-2 text-center">
                <div className="text-[10px] text-muted-foreground">{h.label}</div>
                <div className="text-lg font-bold tabular-nums">{h.v}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Compliance rule readiness" subtitle="Active dimensions feeding workspace score" icon={Shield}>
          <div className="flex flex-wrap gap-1.5">
            {['APPROVAL', 'SLA', 'WORKFLOW', 'NAMING', 'EVIDENCE'].map((d) => (
              <Badge key={d} variant="outline" className="text-[10px] font-semibold">
                {d}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Compliance score is <strong className="text-foreground">read-only</strong> when applied to workspaces — calculated server-side from active rules.
          </p>
        </Panel>

        <Panel title="Recently updated governance assets" subtitle="Templates and policies with latest edits" icon={Sparkles}>
          <ul className="space-y-2">
            {RECENT.map((r) => (
              <li key={r.title} className="flex items-start justify-between gap-2 rounded-lg border border-border/50 bg-background/50 px-2 py-1.5 text-xs">
                <div>
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.type} · {r.actor}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{r.when}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Governance usage across workspaces" subtitle="Models in use by workspace type" icon={Building2}>
          <ul className="space-y-2">
            {USAGE.map((u) => (
              <li key={u.ws} className="rounded-lg border border-border/50 bg-background/50 px-2 py-2">
                <div className="flex justify-between gap-2 text-xs font-semibold text-foreground">
                  <span>{u.ws}</span>
                  <span className="tabular-nums text-primary">{u.pct}%</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{u.model}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            Consumed by Workspace Management · monitored in Execution Portfolio &amp; Delivery Governance
          </div>
        </Panel>
      </div>
    </div>
  )
}
