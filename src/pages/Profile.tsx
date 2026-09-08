import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Edit3,
  Fingerprint,
  Globe,
  HeartHandshake,
  Laptop,
  LogOut,
  MessageSquare,
  Send,
  RefreshCw,
  Server,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getSession, logoutAsync, requireAuth, registerPasskey, type Session } from '@/auth/authService'
import { fetchTokenAudit, fetchUserInfo, requestPartnerPasswordReset, type OidcUserInfo } from '@/lib/api/identityApi'
import { listAuthzAssignments, type AuthzAssignmentDto } from '@/lib/api/authzApi'
import { passkeyErrorMessage } from '@/lib/api/webauthnApi'
import { buildLoginPathAfterSignOut } from '@/auth/loginRedirect'
import { authCardButtonClass } from '@/lib/authUiClasses'
import { enterpriseCyanGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { AIPerformanceCard } from '@/components/profile/AIPerformanceCard'
import { fetchModelCatalog, catalogPrice, type CatalogModel, type ModelCatalog } from '@/lib/api/modelCatalogApi'
import { maskToken, readTokenTelemetry, type TokenTelemetryEvent } from '@/lib/tokenTelemetry'
import { normalizeUserDisplayName } from '@/lib/userDisplayName'
import { applyCatalogPricing, usageCost } from '@/lib/usageCost'

type ProfilePreferences = {
  displayName?: string
  timezone: string
  avatar?: string
  notifications: Record<string, boolean>
}

const PROFILE_PREFS_PREFIX = 'tectona_profile_preferences:'
const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  timezone: 'Asia/Jakarta',
  notifications: {
    taskAssignment: true,
    mentions: true,
    approvals: true,
    reminders: false,
  },
}

function profilePreferencesKey(subjectId: string): string {
  return `${PROFILE_PREFS_PREFIX}${subjectId}`
}

function readProfilePreferences(subjectId: string): ProfilePreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(profilePreferencesKey(subjectId)) ?? '{}')
    return {
      ...DEFAULT_PROFILE_PREFERENCES,
      ...stored,
      notifications: { ...DEFAULT_PROFILE_PREFERENCES.notifications, ...(stored.notifications ?? {}) },
    }
  } catch {
    return DEFAULT_PROFILE_PREFERENCES
  }
}

function saveProfilePreferences(subjectId: string, preferences: ProfilePreferences): void {
  localStorage.setItem(profilePreferencesKey(subjectId), JSON.stringify(preferences))
}

function mergeTokenEvents(primary: TokenTelemetryEvent[], secondary: TokenTelemetryEvent[]): TokenTelemetryEvent[] {
  const merged = [...primary, ...secondary].filter((event) => event.category === 'llm')
  return merged
    .filter((event, index, all) => all.findIndex((candidate) => `${candidate.event}|${candidate.trigger ?? ''}|${candidate.occurredAt}` === `${event.event}|${event.trigger ?? ''}|${event.occurredAt}`) === index)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 120)
}

function profileInitials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || '?'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

function ProfileField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid gap-1 border-b border-border/40 py-3.5 last:border-0 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-sm font-medium text-foreground break-all', mono && 'font-mono text-xs')}>
        {value}
      </dd>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  description,
  headerAside,
  className,
  children,
}: {
  icon: typeof User
  title: string
  description: string
  headerAside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('rounded-xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm', className)}>
      <div className="border-b border-border/40 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
          </div>
          {headerAside}
        </div>
      </div>
      <div className="px-5 py-1">{children}</div>
    </section>
  )
}

function rbacRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    tectona_root: 'Root administrator',
    tectona_admin: 'Platform administrator',
    tectona_organization_admin: 'Organization administrator',
    tectona_portfolio_head: 'Portfolio head',
    tectona_portfolio_officer: 'Portfolio officer',
    tectona_planning_governance_head: 'Planning & governance head',
    tectona_business_partner_head: 'Business partner head',
    tectona_brm_head: 'BRM head',
    tectona_business_analyst: 'Business analyst',
    tectona_member: 'Member',
  }
  return labels[role] ?? role.replace(/^tectona[._-]?/i, '').replace(/[_-]/g, ' ')
}

function scopeTypeLabel(scopeTypeCode: string): string {
  if (scopeTypeCode === 'global') return 'Global'
  return scopeTypeCode.charAt(0).toUpperCase() + scopeTypeCode.slice(1).replace(/_/g, ' ')
}

function primaryRbacRole(roles: string[] | undefined, fallback: string): string {
  const priority = [
    'tectona_root',
    'tectona_admin',
    'tectona_organization_admin',
    'tectona_planning_governance_head',
    'tectona_portfolio_head',
    'tectona_business_partner_head',
    'tectona_brm_head',
    'tectona_business_analyst',
    'tectona_portfolio_officer',
    'tectona_member',
  ]
  const normalized = new Set((roles ?? []).map((role) => role.toLowerCase()))
  return priority.find((role) => normalized.has(role)) ?? fallback
}

function TokenActivityHeatmap({ events }: { events: TokenTelemetryEvent[] }) {
  const dashboard = useMemo(() => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date(end)
    start.setDate(start.getDate() - 364)
    start.setDate(start.getDate() - start.getDay())
    const days = Array.from({ length: 53 * 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const key = date.toISOString().slice(0, 10)
      return { date, key, count: 0 }
    }).filter((day) => day.date <= end)
    const counts = new Map<string, number>()
    events.forEach((event) => {
      const key = event.occurredAt.slice(0, 10)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    days.forEach((day) => { day.count = counts.get(day.key) ?? 0 })
    const activeDays = days.filter((day) => day.count > 0)
    const byMonth = new Map<string, number>()
    days.forEach((day) => {
      const month = day.date.toLocaleDateString('en-US', { month: 'long' })
      byMonth.set(month, (byMonth.get(month) ?? 0) + day.count)
    })
    const mostActiveMonth = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]
    const mostActiveDay = [...days].sort((a, b) => b.count - a.count)[0]
    let longestStreak = 0
    let currentStreak = 0
    let streak = 0
    days.forEach((day) => {
      if (day.count > 0) {
        streak += 1
        longestStreak = Math.max(longestStreak, streak)
      } else streak = 0
    })
    for (let index = days.length - 1; index >= 0 && days[index].count > 0; index -= 1) currentStreak += 1
    const monthLabels = days.filter((day) => day.date.getDay() === 0 && day.date.getDate() <= 7).map((day) => ({
      label: day.date.toLocaleDateString('en-US', { month: 'short' }),
      offset: Math.floor((day.date.getTime() - start.getTime()) / 86400000 / 7),
    }))
    return { days, activeDays, mostActiveMonth, mostActiveDay, longestStreak, currentStreak, monthLabels }
  }, [events])
  return (
    <div className="rounded-xl border border-border/50 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-foreground">AI Activity</p><p className="mt-0.5 text-xs text-muted-foreground">Your AI interaction activity over the last 12 months.</p></div>
        <p className="shrink-0 text-right text-xs font-medium text-muted-foreground">Last 12 months</p>
      </div>
      <div className="mt-5 overflow-x-auto pb-1">
        <div className="min-w-[39rem]">
          <div className="ml-7 grid h-5 grid-cols-[repeat(53,minmax(0,1fr))] gap-1 text-[10px] text-muted-foreground">
            {dashboard.monthLabels.map((month, index) => <span key={`${month.label}-${index}`} style={{ gridColumnStart: month.offset + 1 }}>{month.label}</span>)}
          </div>
          <div className="flex gap-2">
            <div className="grid w-5 grid-rows-7 gap-1 text-[10px] text-muted-foreground">
              <span /> <span>M</span> <span /> <span>W</span> <span /> <span>F</span> <span />
            </div>
            <div className="grid h-[5.75rem] flex-1 grid-flow-col grid-rows-7 gap-1">
              {dashboard.days.map((day) => (
                <span key={day.key} title={`${day.key}: ${day.count} AI interaction${day.count === 1 ? '' : 's'}`} className={cn('h-3 w-3 rounded-[2px]', day.count === 0 ? 'bg-muted' : day.count === 1 ? 'bg-emerald-200 dark:bg-emerald-900' : day.count === 2 ? 'bg-emerald-400 dark:bg-emerald-700' : 'bg-emerald-600 dark:bg-emerald-500')} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 border-t border-border/40 pt-4 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Most active month</p><p className="mt-1 text-sm font-semibold text-foreground">{dashboard.mostActiveMonth?.[0] ?? '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Most active day</p><p className="mt-1 text-sm font-semibold text-foreground">{dashboard.mostActiveDay?.count ? dashboard.mostActiveDay.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Longest streak</p><p className="mt-1 text-sm font-semibold text-foreground">{dashboard.longestStreak}d</p></div>
        <div><p className="text-xs text-muted-foreground">Current streak</p><p className="mt-1 text-sm font-semibold text-foreground">{dashboard.currentStreak}d</p></div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground"><span>Less</span><span className="h-3 w-3 rounded-[2px] bg-muted" /><span className="h-3 w-3 rounded-[2px] bg-emerald-200 dark:bg-emerald-900" /><span className="h-3 w-3 rounded-[2px] bg-emerald-400 dark:bg-emerald-700" /><span className="h-3 w-3 rounded-[2px] bg-emerald-600 dark:bg-emerald-500" /><span>More</span><span className="ml-auto">{dashboard.activeDays.length} active days</span></div>
    </div>
  )
}


function ModelDetailDrawer({ model, onClose, onViewPerformance }: { model: CatalogModel; onClose: () => void; onViewPerformance: () => void }) {
  const drawerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onClose])

  return createPortal(
    <aside ref={drawerRef} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border/60 bg-card shadow-2xl" role="dialog" aria-labelledby="model-detail-title">
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/[0.055] to-transparent px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">AI model</p>
              <h2 id="model-detail-title" className="mt-0.5 break-words text-lg font-semibold tracking-tight">{model.name}</h2>
              <p className="mt-1 break-words text-xs text-muted-foreground">Configured through {model.providerName}</p>
              {model.name !== model.modelId && <p className="mt-1 break-all text-[10px] text-muted-foreground">{model.modelId}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close model details" className="rounded-lg border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border/60 hover:bg-background/80 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>● {model.availability}</span>
          {model.isDefault ? <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">Default model</span> : null}
          <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{model.type}</span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <section>
          <div className="mb-2 flex items-center gap-2"><Server className="h-3.5 w-3.5 text-primary" /><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Model overview</h3></div>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border/60 bg-background/45 shadow-sm">
            {[
              ['Provider', model.providerName],
              ['Context window', model.contextWindow],
              ['Availability', model.availability],
              ['Default model', model.isDefault ? 'Yes' : 'No'],
            ].map(([label, value], index) => <div key={label} className={cn('p-3', index % 2 === 0 && 'border-r border-border/40', index < 2 && 'border-b border-border/40')}><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-semibold text-foreground">{value}</p></div>)}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">Rp</span><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Model pricing</h3></div><span className="text-[10px] text-muted-foreground">Per 1M tokens</span></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/15"><p className="text-[10px] text-muted-foreground">Input tokens</p><p className="mt-1 text-base font-semibold tracking-tight text-blue-700 dark:text-blue-300">{catalogPrice(model.inputPrice)}</p></div>
            <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/15"><p className="text-[10px] text-muted-foreground">Output tokens</p><p className="mt-1 text-base font-semibold tracking-tight text-violet-700 dark:text-violet-300">{catalogPrice(model.outputPrice)}</p></div>
          </div>
        </section>

        <section className="rounded-xl border border-primary/15 bg-primary/[0.035] p-3.5">
          <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">Best for</h3></div>
          <p className="mt-2 text-xs leading-relaxed text-foreground/80">{model.bestFor}</p>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2"><Boxes className="h-3.5 w-3.5 text-primary" /><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Configured routing</h3></div>
          <div className="grid grid-cols-2 gap-2">{model.tectonaCapabilities.map((capability) => <div key={capability} className="flex min-h-10 items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2 text-[11px] font-medium"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10"><Sparkles className="h-3 w-3 text-primary" /></span>{capability}</div>)}</div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Key strengths</h3></div>
          <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-1">{(model.strengths.length ? model.strengths : ['Not specified']).map((strength, index) => <div key={strength} className={cn('flex items-start gap-2.5 py-2.5 text-xs', index > 0 && 'border-t border-border/35')}><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span><span className="leading-relaxed text-foreground/80">{strength}</span></div>)}</div>
        </section>
      </div>

      <div className="border-t border-border/50 bg-card/95 p-4">
        <button type="button" className={cn(enterpriseCyanGradientActionButtonClass(), 'w-full justify-center')} onClick={onViewPerformance}><BarChart3 className="h-4 w-4" strokeWidth={2.5} /> View performance</button>
      </div>
    </aside>,
    document.body,
  )
}

function AIProviderModelsCard({ onViewPerformance, onViewUsage }: { onViewPerformance: () => void; onViewUsage: () => void }) {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    setLoading(true)
    setError(false)
    fetchModelCatalog(controller.signal, getSession()?.token).then(data => {
      if (active) setCatalog(data)
    }).catch(() => {
      if (active) setError(true)
    }).finally(() => {
      window.clearTimeout(timeout)
      if (active) setLoading(false)
    })
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [revision])
  const models = catalog?.models ?? []
  const defaultModel = models.find(model => model.isDefault)
  const selectedModel = models.find(model => model.id === selectedId)
  const capabilities = [...new Set(models.flatMap(model => Object.keys(model.capabilitySupport)))]
  const refresh = () => { setSelectedId(null); setRevision(value => value + 1) }
  const sectionClass = 'rounded-xl border border-border/60 p-4'
  return <>
    <SectionCard icon={Sparkles} title="AI Provider & Models"
      description="View models and routing configured for the shared TECTONA runtime."
      headerAside={<div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{loading ? 'Syncing…' : error ? 'Sync failed' : catalog ? `Updated ${new Date(catalog.updatedAt).toLocaleTimeString('en-US')}` : 'Not synced'}</span>
        <button type="button" disabled={loading} onClick={refresh} aria-label="Refresh AI provider catalog" className="rounded-md p-1.5 hover:bg-muted disabled:opacity-50"><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /></button>
      </div>}>
      <div className="space-y-4 py-4" aria-busy={loading}>
        {error && <div role="alert" className={sectionClass}><h3 className="text-sm font-semibold">Unable to load AI providers and models</h3><p className="mt-1 text-xs text-muted-foreground">Catalog information is temporarily unavailable.{catalog ? ' Showing the last synced configuration.' : ''}</p><Button variant="outline" size="sm" onClick={refresh} className="mt-3">Retry</Button></div>}
        {loading && !catalog ? <div aria-label="Loading model catalog" className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[0,1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div><div className="h-44 animate-pulse rounded-lg bg-muted" /></div> : catalog && <>
          <p className="text-xs text-muted-foreground">Configured models are not live health checks. Routing can select a different model for each capability.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Configured providers', String(catalog.providers.length), 'Shared runtime configuration'],
              ['Configured models', String(models.length), 'Includes feature routes and fallbacks'],
              ['Default model', defaultModel?.name ?? 'Not specified', 'Primary runtime · feature overrides may apply'],
            ].map(([label,value,hint]) => <div key={label} className={sectionClass}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-base font-semibold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p></div>)}
          </div>
          {!catalog.providers.length ? <div className={sectionClass}><h3 className="text-sm font-semibold">No AI provider available</h3><p className="mt-1 text-xs text-muted-foreground">No enabled AI provider is configured for this runtime.</p></div> : <>
            <section><h3 className="mb-2 text-sm font-semibold">AI Providers</h3><div className="space-y-2">{catalog.providers.map(provider => <div key={provider.id} className={cn(sectionClass,'grid items-center gap-3 sm:grid-cols-4')}>
              <div><p className="text-sm font-semibold">{provider.name}</p><p className="mt-1 text-xs text-muted-foreground">{provider.protocol === 'openai_compat' ? 'OpenAI Compatible' : provider.protocol}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 text-xs">{provider.status}</p></div>
              <div><p className="text-xs text-muted-foreground">Models</p><p className="mt-1 text-xs">{models.filter(model => model.providerId === provider.id).length} models</p></div>
              <div><p className="text-xs text-muted-foreground">Region</p><p className="mt-1 text-xs">{provider.region}</p></div>
            </div>)}</div></section>
            {!models.length ? <div className={sectionClass}><h3 className="text-sm font-semibold">No AI models available</h3></div> : <>
              <section><h3 className="text-sm font-semibold">Configured Models</h3><p className="mb-2 text-xs text-muted-foreground">Select a model to view its metadata, pricing, and configured routing.</p>
                <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block"><table className="w-full text-left text-xs"><thead className="bg-muted/30 text-muted-foreground"><tr>{['Model','Capabilities','Context window','Status','Default','Details'].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>
                  {models.map(model => <tr key={model.id} onClick={() => setSelectedId(model.id)} className="cursor-pointer border-t border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-3"><button type="button" onClick={() => setSelectedId(model.id)} className="text-left font-medium hover:text-primary">{model.name}</button><p className="mt-1 text-[10px] text-muted-foreground">{model.providerName}</p></td>
                    <td className="px-3 py-3">{model.capabilities.length ? model.capabilities.join(' · ') : 'Not specified'}</td><td className="px-3 py-3">{model.contextWindow}</td><td className="px-3 py-3">{model.availability}</td><td className="px-3 py-3">{model.isDefault ? <Badge variant="secondary">Default</Badge> : '—'}</td><td className="px-3 py-3"><button type="button" aria-label={`View ${model.name} details`} onClick={() => setSelectedId(model.id)}><ChevronRight className="h-4 w-4" /></button></td>
                  </tr>)}
                </tbody></table></div>
                <div className="space-y-2 md:hidden">{models.map(model => <button type="button" key={model.id} onClick={() => setSelectedId(model.id)} className={cn(sectionClass,'w-full text-left')}><span className="block break-words text-sm font-semibold">{model.name}</span><span className="mt-1 block text-xs text-muted-foreground">{model.providerName} · {model.availability}{model.isDefault ? ' · Default' : ''}</span><span className="mt-2 block text-xs">{model.capabilities.join(' · ') || 'Not specified'}</span></button>)}</div>
              </section>
              <section className={sectionClass}><h3 className="text-sm font-semibold">Model Routing</h3><p className="mb-3 text-xs text-muted-foreground">Configured assignments; fallbacks may change the model used for an individual request.</p><div className="grid gap-3 sm:grid-cols-2">{models.map(model => <div key={model.id} className="border-l-2 border-primary/20 pl-3"><p className="break-words text-xs font-semibold">{model.name}</p><p className="mt-1 text-xs text-muted-foreground">{model.tectonaCapabilities.join(' · ')}</p></div>)}</div></section>
              <div className="grid gap-4 xl:grid-cols-2">
                <section className={sectionClass}><h3 className="text-sm font-semibold">Model Capability Matrix</h3><p className="mb-3 text-xs text-muted-foreground">Curated metadata for exact model versions.</p>
                  {!capabilities.length ? <p className="py-3 text-xs text-muted-foreground">Not specified. Capability metadata has not been configured.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Capability</th>{models.map(model => <th key={model.id} className="p-2 font-medium">{model.name}</th>)}</tr></thead><tbody>{capabilities.map(capability => <tr key={capability} className="border-t border-border/40"><td className="p-2">{capability}</td>{models.map(model => <td key={model.id} className="p-2">{({supported:'Supported',partial:'Partial',none:'Not supported'} as const)[model.capabilitySupport[capability]] ?? 'Not specified'}</td>)}</tr>)}</tbody></table></div>}
                </section>
                <section className={sectionClass}><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold">Model Pricing</h3><button type="button" onClick={onViewUsage} className="text-xs text-primary">View usage →</button></div><p className="mb-3 text-xs text-muted-foreground">Configured rates per 1M tokens · IDR</p><div className="grid gap-2 sm:grid-cols-2">{models.map(model => <button type="button" key={model.id} onClick={() => setSelectedId(model.id)} className="rounded-lg border border-border/50 p-3 text-left hover:bg-muted/30"><p className="break-words text-xs font-medium">{model.name}</p><p className="mt-2 text-[10px] text-muted-foreground">Input</p><p className="text-xs text-primary">{catalogPrice(model.inputPrice)}</p><p className="mt-2 text-[10px] text-muted-foreground">Output</p><p className="text-xs text-violet-600">{catalogPrice(model.outputPrice)}</p></button>)}</div><p className="mt-3 text-[10px] text-muted-foreground">Configured tariffs are estimates, not a vendor quote. Prices are subject to change.</p></section>
              </div>
            </>}
          </>}
        </>}
      </div>
    </SectionCard>
    {selectedModel && <ModelDetailDrawer model={selectedModel} onClose={() => setSelectedId(null)} onViewPerformance={() => { setSelectedId(null); onViewPerformance() }} />}
  </>
}

const usageCapabilities = ['AI Assistant', 'Document Generation', 'Requirement Analysis', 'Knowledge Assistant', 'Workflow Automation']

function interactionName(event: TokenTelemetryEvent): string {
  if (event.interactionType) return event.interactionType
  const source = `${event.trigger ?? ''} ${event.context ?? ''}`.toLowerCase()
  if (/document|template|generate/.test(source)) return 'Document Generation'
  if (/requirement|idea|analysis|analyz/.test(source)) return 'Requirement Analysis'
  if (/knowledge|knowledge base|\bkb\b/.test(source)) return 'Knowledge Assistant'
  if (/workflow|automation/.test(source)) return 'Workflow Automation'
  return 'AI Assistant'
}

type UsageRange = '7d' | '30d' | '90d' | 'year' | 'custom'

function catalogModelLabel(model?: string): string {
  return model || 'Unknown model'
}

function usagePeriod(range: UsageRange, now: Date, customFrom: string, customTo: string): { start: Date; end: Date; label: string } {
  const end = range === 'custom' && customTo ? new Date(`${customTo}T23:59:59.999`) : new Date(now)
  const start = new Date(end)
  if (range === '7d') start.setDate(end.getDate() - 6)
  else if (range === '30d') start.setDate(end.getDate() - 29)
  else if (range === '90d') start.setDate(end.getDate() - 89)
  else if (range === 'year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0) }
  else if (customFrom) start.setTime(new Date(`${customFrom}T00:00:00`).getTime())
  start.setHours(0, 0, 0, 0)
  const labels: Record<UsageRange, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', year: 'This year', custom: 'Custom range' }
  return { start, end, label: labels[range] }
}

function comparisonText(current: number, previous: number, suffix: string): string {
  if (previous <= 0) return 'No previous period data'
  const change = ((current - previous) / previous) * 100
  return `${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(0)}% vs previous ${suffix}`
}

function AIActivityDetailDrawer({ event, onClose }: { event: TokenTelemetryEvent; onClose: () => void }) {
  const drawerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => { if (keyboardEvent.key === 'Escape') onClose() }
    const handlePointerDown = (pointerEvent: PointerEvent) => { if (drawerRef.current && !drawerRef.current.contains(pointerEvent.target as Node)) onClose() }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('pointerdown', handlePointerDown) }
  }, [onClose])
  const rows = [
    ['Capability', interactionName(event)],
    ['Trigger', event.trigger ?? event.event],
    ['Model', catalogModelLabel(event.model)],
    ['Initiator', event.source === 'user' ? 'User' : 'System'],
    ['Timestamp', new Date(event.occurredAt).toLocaleString('en-US')],
    ['Input tokens', event.inputTokens?.toLocaleString() ?? '—'],
    ['Output tokens', event.outputTokens?.toLocaleString() ?? '—'],
    ['Total tokens', event.totalTokens?.toLocaleString() ?? '—'],
    ['Estimated cost', typeof event.totalCostIdr === 'number' ? `Rp ${Math.round(event.totalCostIdr).toLocaleString('id-ID')}` : '—'],
  ]
  return createPortal(<aside ref={drawerRef} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border/60 bg-card shadow-2xl" role="dialog" aria-labelledby="activity-detail-title"><div className="border-b border-border/50 bg-gradient-to-b from-primary/[0.055] to-transparent p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><Activity className="h-4 w-4" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">AI activity detail</p><h2 id="activity-detail-title" className="mt-0.5 text-lg font-semibold">{interactionName(event)}</h2><p className="mt-1 text-xs text-muted-foreground">Usage metadata for this AI interaction</p></div></div><button type="button" onClick={onClose} aria-label="Close activity details" className="rounded-lg p-1.5 text-muted-foreground hover:bg-background/80"><X className="h-4 w-4" /></button></div></div><div className="flex-1 space-y-4 overflow-y-auto p-5"><section className="overflow-hidden rounded-xl border border-border/60 bg-background/45">{rows.map(([label, value], index) => <div key={label} className={cn('flex items-start justify-between gap-4 px-3 py-3 text-xs', index > 0 && 'border-t border-border/35')}><span className="text-muted-foreground">{label}</span><span className="max-w-[62%] break-words text-right font-medium">{value}</span></div>)}</section>{event.context ? <section className="rounded-xl border border-primary/15 bg-primary/[0.035] p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">Related TECTONA context</p><p className="mt-2 break-words text-xs leading-relaxed text-foreground/80">{event.context}</p></section> : null}<p className="text-[10px] leading-relaxed text-muted-foreground">Prompts, model payloads, credentials, and confidential content are not displayed.</p></div></aside>, document.body)
}

function AIActivityListDrawer({ events, onClose, onSelect }: { events: TokenTelemetryEvent[]; onClose: () => void; onSelect: (event: TokenTelemetryEvent) => void }) {
  const drawerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const handlePointerDown = (event: PointerEvent) => { if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) onClose() }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('pointerdown', handlePointerDown) }
  }, [onClose])
  return createPortal(<aside ref={drawerRef} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-border/60 bg-card shadow-2xl" role="dialog" aria-labelledby="all-activity-title"><div className="flex items-start justify-between border-b border-border/50 bg-gradient-to-b from-primary/[0.055] to-transparent p-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">AI usage history</p><h2 id="all-activity-title" className="mt-0.5 text-lg font-semibold">All AI Activity</h2><p className="mt-1 text-xs text-muted-foreground">{events.length.toLocaleString()} interactions in the selected period</p></div><button type="button" onClick={onClose} aria-label="Close activity history" className="rounded-lg p-1.5 text-muted-foreground hover:bg-background/80"><X className="h-4 w-4" /></button></div><div className="flex-1 space-y-2 overflow-y-auto p-4">{events.map((event) => <button key={event.id} type="button" onClick={() => onSelect(event)} className="w-full rounded-xl border border-border/50 bg-background/40 p-3 text-left transition-colors hover:bg-muted/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold">{interactionName(event)}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{catalogModelLabel(event.model)} · {new Date(event.occurredAt).toLocaleString('en-US')}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></div><div className="mt-2 flex items-center justify-between text-[10px]"><span className={cn('rounded-full px-2 py-0.5', event.source === 'user' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700')}>{event.source === 'user' ? 'User' : 'System'}</span><span className="text-muted-foreground">{event.totalTokens?.toLocaleString() ?? '—'} tokens</span></div></button>)}</div></aside>, document.body)
}

function AIUsageSpendingCard({ events, loading, error, onRetry, onViewProviders }: { events: TokenTelemetryEvent[]; loading: boolean; error: boolean; onRetry: () => void; onViewProviders: () => void }) {
  const [range, setRange] = useState<UsageRange>('30d')
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [now] = useState(() => new Date())
  const defaultFrom = new Date(now); defaultFrom.setDate(now.getDate() - 29)
  const [customFrom, setCustomFrom] = useState(defaultFrom.toISOString().slice(0, 10))
  const [customTo, setCustomTo] = useState(now.toISOString().slice(0, 10))
  const [selectedActivity, setSelectedActivity] = useState<TokenTelemetryEvent | null>(null)
  const [activityListOpen, setActivityListOpen] = useState(false)
  const [pricingCatalog, setPricingCatalog] = useState<ModelCatalog | null>(null)
  const [pricingRevision, setPricingRevision] = useState(0)
  const [pricingLoading, setPricingLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setPricingLoading(true)
    fetchModelCatalog(controller.signal, getSession()?.token)
      .then((catalog) => { if (active) setPricingCatalog(catalog) })
      .catch(() => { if (active) setPricingCatalog(null) })
      .finally(() => { if (active) setPricingLoading(false) })
    return () => { active = false; controller.abort() }
  }, [pricingRevision])
  const period = usagePeriod(range, now, customFrom, customTo)
  const filteredRawEvents = events.filter((event) => { const timestamp = new Date(event.occurredAt); return timestamp >= period.start && timestamp <= period.end })
  const filteredEvents = filteredRawEvents.map((event) => applyCatalogPricing(event, pricingCatalog))
  const periodDuration = Math.max(period.end.getTime() - period.start.getTime(), 86400000)
  const previousStart = new Date(period.start.getTime() - periodDuration)
  const previousRawEvents = events.filter((event) => { const timestamp = new Date(event.occurredAt); return timestamp >= previousStart && timestamp < period.start })
  const previousEvents = previousRawEvents.map((event) => applyCatalogPricing(event, pricingCatalog))
  const totalTokens = filteredEvents.reduce((sum, event) => sum + (event.totalTokens ?? 0), 0)
  const inputTokens = filteredEvents.reduce((sum, event) => sum + (event.inputTokens ?? 0), 0)
  const outputTokens = filteredEvents.reduce((sum, event) => sum + (event.outputTokens ?? 0), 0)
  const previousTokens = previousEvents.reduce((sum, event) => sum + (event.totalTokens ?? 0), 0)
  const completePricing = filteredEvents.length > 0 && filteredEvents.every((event) => typeof event.totalCostIdr === 'number')
  const totalCost = completePricing ? filteredEvents.reduce((sum, event) => sum + (event.totalCostIdr ?? 0), 0) : null
  const previousCompletePricing = previousEvents.length > 0 && previousEvents.every((event) => typeof event.totalCostIdr === 'number')
  const previousCost = previousCompletePricing ? previousEvents.reduce((sum, event) => sum + (event.totalCostIdr ?? 0), 0) : 0
  const suffix = range === '30d' ? '30 days' : 'period'
  const estimatedWithCurrentPricing = filteredRawEvents.some((event) => usageCost(event, pricingCatalog).source === 'current_catalog')
  const costUnavailableDetail = pricingLoading
    ? 'Loading current model pricing…'
    : 'Pricing information is unavailable for one or more exact model deployments.'
  const costComparison = totalCost === null
    ? costUnavailableDetail
    : `${estimatedWithCurrentPricing ? 'Estimated using current configured rates · ' : ''}${comparisonText(totalCost, previousCost, suffix)}`
  const activeDays = new Set(filteredEvents.map((event) => event.occurredAt.slice(0, 10))).size
  const previousActiveDays = new Set(previousEvents.map((event) => event.occurredAt.slice(0, 10))).size

  const groupedDailyTokens = new Map<string, { date: string; input: number; output: number }>()
  filteredEvents.forEach((event) => { const key = event.occurredAt.slice(0, 10); const row = groupedDailyTokens.get(key) ?? { date: key, input: 0, output: 0 }; row.input += event.inputTokens ?? 0; row.output += event.outputTokens ?? 0; groupedDailyTokens.set(key, row) })
  const dailyTokens = [...groupedDailyTokens.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({ ...row, label: new Date(`${row.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))

  const capabilityRows = usageCapabilities.map((capability) => {
    const capabilityEvents = filteredEvents.filter((event) => interactionName(event) === capability)
    const tokens = capabilityEvents.reduce((sum, event) => sum + (event.totalTokens ?? 0), 0)
    return { capability, calls: capabilityEvents.length, tokens, share: totalTokens ? tokens / totalTokens * 100 : 0 }
  }).sort((a, b) => b.tokens - a.tokens)
  const modelCostMap = new Map<string, number>()
  filteredEvents.forEach((event) => { const label = catalogModelLabel(event.model); modelCostMap.set(label, (modelCostMap.get(label) ?? 0) + (event.totalCostIdr ?? 0)) })
  const modelCosts = [...modelCostMap.entries()].map(([name, cost]) => ({ name, cost, share: totalCost ? cost / totalCost * 100 : 0 })).sort((a, b) => b.cost - a.cost)
  const distribution = [{ name: 'User initiated', value: filteredEvents.filter((event) => event.source === 'user').length, color: '#2563eb' }, { name: 'System automatic', value: filteredEvents.filter((event) => event.source === 'system').length, color: '#7c3aed' }]
  const recentEvents = filteredEvents.slice(0, 8)

  return <>
    <SectionCard icon={Activity} title="AI Usage & Spending" description="Track your AI activity, token consumption, and estimated usage cost across TECTONA." headerAside={<div className="flex flex-wrap items-center justify-end gap-2"><select aria-label="Usage time range" value={range} onChange={(event) => setRange(event.target.value as UsageRange)} className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="year">This year</option><option value="custom">Custom range</option></select><span title={updatedAt.toLocaleTimeString('en-US')} className="hidden text-xs text-muted-foreground sm:inline">Updated just now</span><button type="button" aria-label="Refresh AI usage and pricing" title="Refresh" onClick={() => { setUpdatedAt(new Date()); setPricingRevision((value) => value + 1); window.dispatchEvent(new CustomEvent('tectona:token-telemetry-updated')) }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><RefreshCw className={cn('h-3.5 w-3.5', pricingLoading && 'animate-spin')} /></button></div>}>
      <div className="space-y-4 py-4">
        {range === 'custom' ? <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border/50 bg-muted/20 p-2 text-xs"><label className="flex items-center gap-2 text-muted-foreground">From<input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-md border border-border/60 bg-background px-2 py-1 text-foreground" /></label><label className="flex items-center gap-2 text-muted-foreground">To<input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} className="rounded-md border border-border/60 bg-background px-2 py-1 text-foreground" /></label></div> : null}
        {loading && !events.length ? <div className="space-y-4 animate-pulse"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-xl bg-muted/60" />)}</div><div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]"><div className="h-64 rounded-xl bg-muted/50" /><div className="h-64 rounded-xl bg-muted/50" /></div><div className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 rounded-xl bg-muted/40" />)}</div><div className="h-52 rounded-xl bg-muted/40" /></div> : error && !events.length ? <div className="rounded-xl border border-destructive/20 bg-destructive/[0.035] px-5 py-7 text-center"><h3 className="text-sm font-semibold">Unable to load AI usage data</h3><p className="mt-1 text-xs text-muted-foreground">AI usage information is temporarily unavailable.</p><Button type="button" variant="outline" className="mt-4" onClick={onRetry}>Retry</Button></div> : !filteredEvents.length ? <div className="rounded-xl border border-dashed border-border/70 px-5 py-9 text-center"><h3 className="text-sm font-semibold">No AI activity yet</h3><p className="mx-auto mt-1 max-w-lg text-xs text-muted-foreground">Your AI usage, token consumption, and estimated cost will appear after you start using AI capabilities in TECTONA.</p><Link to="/projects" className="mt-4 inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">Explore AI Features</Link></div> : <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
            { label: 'AI calls', value: filteredEvents.length.toLocaleString(), detail: comparisonText(filteredEvents.length, previousEvents.length, suffix), icon: MessageSquare, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
            { label: 'Total tokens', value: totalTokens.toLocaleString(), detail: comparisonText(totalTokens, previousTokens, suffix), icon: Coins, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' },
            { label: 'Estimated cost', value: totalCost === null ? '—' : `Rp ${Math.round(totalCost).toLocaleString('id-ID')}`, detail: costComparison, icon: BarChart3, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' },
            { label: 'Active days', value: activeDays.toLocaleString(), detail: `${activeDays - previousActiveDays >= 0 ? '+' : ''}${activeDays - previousActiveDays} days vs previous ${suffix}`, icon: CalendarDays, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/20' },
          ].map(({ label, value, detail, icon: Icon, tone }) => <div key={label} className="rounded-xl border border-border/60 bg-background/50 p-3"><div className="flex items-center gap-3"><div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', tone)}><Icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p></div></div><p className="mt-2 text-[10px] text-muted-foreground">{detail}</p></div>)}</div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><TokenActivityHeatmap events={events} /><div className="rounded-xl border border-border/50 bg-background/45 p-4"><h3 className="text-sm font-semibold">AI Call Distribution</h3><p className="text-xs text-muted-foreground">Breakdown of AI calls by initiation type.</p><div className="mt-3"><div className="relative mx-auto h-40 max-w-[13rem]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none">{distribution.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-semibold">{filteredEvents.length}</span><span className="text-[10px] text-muted-foreground">Total calls</span></div></div><div className="mt-3 space-y-2 border-t border-border/40 pt-3">{distribution.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-medium">{item.value} <span className="text-muted-foreground">({filteredEvents.length ? (item.value / filteredEvents.length * 100).toFixed(1) : '0.0'}%)</span></span></div>)}</div></div></div></div>

          <div className="grid gap-4 xl:grid-cols-3"><div className="rounded-xl border border-border/50 bg-background/45 p-4"><h3 className="text-sm font-semibold">Token Consumption</h3><p className="text-xs text-muted-foreground">Total tokens used in the selected period.</p><div className="mt-3 grid grid-cols-3 gap-2">{[['Input tokens', inputTokens], ['Output tokens', outputTokens], ['Avg tokens / call', Math.round(totalTokens / Math.max(filteredEvents.length, 1))]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border/50 p-2.5"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{Number(value).toLocaleString()}</p></div>)}</div><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyTokens}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / .55)" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} tick={{ fontSize: 9 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} width={38} /><Tooltip /><Bar dataKey="input" name="Input tokens" stackId="tokens" fill="#2563eb" radius={[0, 0, 2, 2]} /><Bar dataKey="output" name="Output tokens" stackId="tokens" fill="#34d399" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="flex gap-4 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-600" />Input tokens</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" />Output tokens</span></div></div>
            <div className="rounded-xl border border-border/50 bg-background/45 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Estimated Spending</h3><p className="text-xs text-muted-foreground">Estimated cost based on token usage and model pricing.</p></div><button type="button" onClick={onViewProviders} className="shrink-0 text-[10px] font-medium text-primary hover:underline">View model pricing →</button></div><p className="mt-4 text-2xl font-semibold tracking-tight">{totalCost === null ? '—' : `Rp ${Math.round(totalCost).toLocaleString('id-ID')}`}</p><p className="mt-1 text-[10px] text-muted-foreground">{costComparison}</p><div className="mt-4 overflow-hidden rounded-lg border border-border/50"><div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground"><span>Model</span><span>Estimated cost</span><span>Share</span></div>{modelCosts.map((row, index) => <div key={row.name} className={cn('grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-xs', index > 0 && 'border-t border-border/35')}><span className="truncate font-medium">{row.name}</span><span>{totalCost === null ? '—' : `Rp ${Math.round(row.cost).toLocaleString('id-ID')}`}</span><span className="text-muted-foreground">{totalCost ? `${row.share.toFixed(1)}%` : '—'}</span></div>)}</div></div>
            <div className="rounded-xl border border-border/50 bg-background/45 p-4"><h3 className="text-sm font-semibold">Usage by TECTONA Capability</h3><p className="text-xs text-muted-foreground">AI calls and token usage by feature area.</p><div className="mt-3 overflow-hidden rounded-lg border border-border/50"><div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground"><span>Capability</span><span>Calls</span><span>Tokens</span><span>Share</span></div>{capabilityRows.map((row, index) => <div key={row.capability} className={cn('grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 text-xs', index > 0 && 'border-t border-border/35')}><span className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10"><Sparkles className="h-3 w-3 text-primary" /></span><span className="truncate">{row.capability}</span></span><span>{row.calls}</span><span>{row.tokens.toLocaleString()}</span><span className="text-muted-foreground">{row.share.toFixed(0)}%</span></div>)}</div></div></div>

          <div className="rounded-xl border border-border/50 bg-background/45"><div className="flex items-start justify-between gap-3 px-4 py-3"><div><h3 className="text-sm font-semibold">Recent AI Activity</h3><p className="text-xs text-muted-foreground">Latest AI interactions and token usage.</p></div><button type="button" onClick={() => setActivityListOpen(true)} className="text-[10px] font-medium text-primary hover:underline">View all activity →</button></div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] text-left text-[11px]"><thead className="border-y border-border/40 bg-muted/20 text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Capability</th><th className="px-3 py-2 font-medium">Model</th><th className="px-3 py-2 font-medium">Initiator</th><th className="px-3 py-2 text-right font-medium">Input</th><th className="px-3 py-2 text-right font-medium">Output</th><th className="px-3 py-2 text-right font-medium">Total</th><th className="px-3 py-2 text-right font-medium">Cost (Est.)</th><th className="w-9 px-3 py-2" /></tr></thead><tbody>{recentEvents.map((event) => <tr key={event.id} onClick={() => setSelectedActivity(event)} className="cursor-pointer border-b border-border/30 last:border-0 hover:bg-muted/30"><td className="whitespace-nowrap px-3 py-2.5">{new Date(event.occurredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td><td className="px-3 py-2.5">{interactionName(event)}</td><td className="px-3 py-2.5">{catalogModelLabel(event.model)}</td><td className="px-3 py-2.5"><span className={cn('rounded-full px-2 py-0.5 text-[10px]', event.source === 'user' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700')}>{event.source === 'user' ? 'User' : 'System'}</span></td><td className="px-3 py-2.5 text-right">{event.inputTokens?.toLocaleString() ?? '—'}</td><td className="px-3 py-2.5 text-right">{event.outputTokens?.toLocaleString() ?? '—'}</td><td className="px-3 py-2.5 text-right">{event.totalTokens?.toLocaleString() ?? '—'}</td><td className="px-3 py-2.5 text-right">{typeof event.totalCostIdr === 'number' ? `Rp ${Math.round(event.totalCostIdr).toLocaleString('id-ID')}` : '—'}</td><td className="px-3 py-2.5"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td></tr>)}</tbody></table></div><div className="space-y-2 border-t border-border/40 p-3 md:hidden">{recentEvents.map((event) => <button key={event.id} type="button" onClick={() => setSelectedActivity(event)} className="w-full rounded-lg border border-border/50 p-3 text-left"><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium">{interactionName(event)}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></div><p className="mt-1 text-[10px] text-muted-foreground">{catalogModelLabel(event.model)} · {new Date(event.occurredAt).toLocaleString('en-US')}</p><p className="mt-2 text-[10px]">{event.totalTokens?.toLocaleString() ?? '—'} tokens · {typeof event.totalCostIdr === 'number' ? `Rp ${Math.round(event.totalCostIdr).toLocaleString('id-ID')}` : 'Cost unavailable'}</p></button>)}</div></div>
        </>}
      </div>
    </SectionCard>
    {activityListOpen ? <AIActivityListDrawer events={filteredEvents} onClose={() => setActivityListOpen(false)} onSelect={(event) => { setActivityListOpen(false); setSelectedActivity(event) }} /> : null}
    {selectedActivity ? <AIActivityDetailDrawer event={selectedActivity} onClose={() => setSelectedActivity(null)} /> : null}
  </>
}

export function ProfilePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [language, setLanguage] = useState('en')
  const [profilePrefs, setProfilePrefs] = useState<ProfilePreferences>(DEFAULT_PROFILE_PREFERENCES)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [tokenEvents, setTokenEvents] = useState<TokenTelemetryEvent[]>([])
  const [tokenEventsLoading, setTokenEventsLoading] = useState(true)
  const [tokenEventsError, setTokenEventsError] = useState(false)
  const [profileTab, setProfileTab] = useState<'account' | 'preferences' | 'security' | 'usage' | 'performance' | 'providers'>('account')
  const [identityProfile, setIdentityProfile] = useState<OidcUserInfo | null>(null)
  const [authzAssignments, setAuthzAssignments] = useState<AuthzAssignmentDto[]>([])
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyMsg, setPasskeyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [partnerResetBusy, setPartnerResetBusy] = useState(false)
  const [partnerResetMsg, setPartnerResetMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAddPasskey = async () => {
    setPasskeyBusy(true)
    setPasskeyMsg(null)
    try {
      await registerPasskey()
      setPasskeyMsg({ ok: true, text: 'Passkey added. You can now sign in with it on this device.' })
    } catch (err) {
      setPasskeyMsg({ ok: false, text: passkeyErrorMessage(err, 'enroll') })
    } finally {
      setPasskeyBusy(false)
    }
  }

  const handlePartnerReset = async () => {
    if (!session || !partnerEmail.trim()) return
    setPartnerResetBusy(true)
    setPartnerResetMsg(null)
    try {
      const result = await requestPartnerPasswordReset({
        accessToken: session.token,
        email: partnerEmail,
      })
      setPartnerEmail('')
      setPartnerResetMsg({ ok: true, text: result.message })
    } catch (err) {
      setPartnerResetMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'Unable to request a password reset right now.',
      })
    } finally {
      setPartnerResetBusy(false)
    }
  }

  useEffect(() => {
    const currentSession = requireAuth()
    if (!currentSession) {
      navigate('/login?next=/profile', { replace: true })
      return
    }
    setSession(currentSession)
    const preferences = readProfilePreferences(currentSession.user.id)
    setProfilePrefs(preferences)
    setEditName(normalizeUserDisplayName(currentSession.user.name || preferences.displayName || currentSession.user.email))
    void fetchUserInfo(currentSession.token).then(setIdentityProfile).catch(() => undefined)
    void listAuthzAssignments().then(setAuthzAssignments).catch(() => undefined)
    const localEvents = mergeTokenEvents([], readTokenTelemetry(currentSession.user.id))
    setTokenEvents(localEvents)
    void fetchTokenAudit(currentSession.token, 80, currentSession.user.id)
      .then((events) => setTokenEvents(mergeTokenEvents(events, localEvents)))
      .catch(() => { if (!localEvents.length) setTokenEventsError(true) })
      .finally(() => setTokenEventsLoading(false))
  }, [navigate])

  useEffect(() => {
    const refreshTokenEvents = () => {
      const current = getSession()
      if (!current) return
      setTokenEventsLoading(true)
      setTokenEventsError(false)
      void fetchTokenAudit(current.token, 80, current.user.id)
        .then((events) => setTokenEvents(mergeTokenEvents(events, readTokenTelemetry(current.user.id))))
        .catch(() => {
          const localEvents = mergeTokenEvents([], readTokenTelemetry(current.user.id))
          setTokenEvents(localEvents)
          if (!localEvents.length) setTokenEventsError(true)
        })
        .finally(() => setTokenEventsLoading(false))
    }
    window.addEventListener('tectona:token-telemetry-updated', refreshTokenEvents)
    return () => window.removeEventListener('tectona:token-telemetry-updated', refreshTokenEvents)
  }, [])

  const updateProfilePreferences = (next: ProfilePreferences) => {
    if (!session) return
    setProfilePrefs(next)
    saveProfilePreferences(session.user.id, next)
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => updateProfilePreferences({ ...profilePrefs, avatar: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const saveDisplayName = () => {
    const nextName = editName.trim()
    if (!nextName) return
    updateProfilePreferences({ ...profilePrefs, displayName: nextName })
    setEditOpen(false)
  }

  const handleLogout = () => {
    void logoutAsync().finally(() => {
      navigate(buildLoginPathAfterSignOut('/profile'), { replace: true })
    })
  }

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(dateString))
    } catch {
      return '-'
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
      case 'root':
        return 'destructive' as const
      case 'reviewer':
        return 'secondary' as const
      default:
        return 'default' as const
    }
  }

  if (!session) return null

  const displayName = normalizeUserDisplayName(identityProfile?.display_name || session.user.name || profilePrefs.displayName || session.user.email)
  const effectiveRoles = identityProfile?.roles?.length ? identityProfile.roles : session.user.roles
  const userAuthzAssignments = authzAssignments.filter((assignment) => assignment.principal_sub === session.user.id)
  const primaryAuthzAssignment =
    userAuthzAssignments.find((assignment) => assignment.scope_type_code === 'organization') ?? userAuthzAssignments[0]
  const platformRole = primaryAuthzAssignment ? primaryAuthzAssignment.role_code : primaryRbacRole(effectiveRoles, session.user.role)
  const platformRoleLabel = primaryAuthzAssignment ? primaryAuthzAssignment.role_name : rbacRoleLabel(platformRole)
  const rbacRoles = userAuthzAssignments.length
    ? userAuthzAssignments.map((assignment) => `${assignment.role_name} (${scopeTypeLabel(assignment.scope_type_code)})`)
    : (effectiveRoles ?? []).map(rbacRoleLabel)
  const initials = profileInitials(displayName, session.user.email)

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[108rem] flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* Top navigation */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Tectona
          </Link>
          <img src="/images/logo.png" alt="Tectona" className="h-8 w-auto object-contain opacity-80" />
        </header>

        {/* Profile hero */}
        <div className="liquid-glass-enterprise-panel mb-6 rounded-2xl border border-border/50 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <button type="button" className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-md" onClick={() => avatarInputRef.current?.click()} aria-label="Change profile photo">
                {profilePrefs.avatar ? <img src={profilePrefs.avatar} alt="" className="h-full w-full object-cover" /> : initials}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"><Camera className="h-5 w-5" aria-hidden /></span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{displayName}</h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">{session.user.email}</p>
                <div className="mt-3">
                  <Badge variant={getRoleBadgeVariant(platformRole)} className="text-xs font-medium">
                    {platformRoleLabel}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => setEditOpen(true)}>
                <Edit3 className="h-4 w-4" aria-hidden /> Edit profile
              </Button>
              <Button type="button" variant="outline" className={cn(authCardButtonClass, 'sm:w-auto sm:min-w-[10rem] border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive')} onClick={handleLogout}>
                <LogOut className="h-4 w-4 shrink-0" aria-hidden /> Sign out
              </Button>
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="h-fit rounded-xl border border-border/60 bg-card/70 p-2 shadow-sm backdrop-blur-sm" aria-label="Profile menu">
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Profile</p>
            {[
              ['account', User, 'Account information'],
              ['preferences', Globe, 'Preferences'],
              ['security', Shield, 'Session & security'],
              ['usage', Activity, 'AI usage & spending'],
              ['performance', Activity, 'AI Performance'],
              ['providers', Activity, 'AI provider & models'],
            ].map(([tab, Icon, label]) => (
              <button key={tab as string} type="button" onClick={() => setProfileTab(tab as typeof profileTab)} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors', profileTab === tab ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label as string}
              </button>
            ))}
          </aside>

          <main className="min-w-0 space-y-6">
          {profileTab === 'usage' ? <AIUsageSpendingCard events={tokenEvents} loading={tokenEventsLoading} error={tokenEventsError} onRetry={() => window.dispatchEvent(new CustomEvent('tectona:token-telemetry-updated'))} onViewProviders={() => setProfileTab('providers')} /> : null}
          {profileTab === 'performance' ? <AIPerformanceCard /> : null}
          {profileTab === 'providers' ? (
            <AIProviderModelsCard onViewPerformance={() => setProfileTab('performance')} onViewUsage={() => setProfileTab('usage')} />
          ) : null}
          <SectionCard
            icon={User}
            title="Account information"
            description="Your identity and session summary."
            className={profileTab === 'account' ? undefined : 'hidden'}
          >
            <dl>
              <ProfileField label="Display name" value={displayName} />
              <ProfileField label="Email" value={session.user.email || '-'} />
              <ProfileField label="Primary RBAC role" value={platformRoleLabel} />
              <ProfileField label="RBAC roles" value={rbacRoles.length ? rbacRoles.join(', ') : 'No role claims'} />
              <ProfileField label="Account ID" value={session.user.id} mono />
              <ProfileField label="Job title" value={identityProfile?.job_title || session.user.jobTitle || '-'} />
              <ProfileField label="Organizational unit" value={identityProfile?.organizational_unit || session.user.organizationalUnit || '-'} />
              <ProfileField label="Account status" value={identityProfile?.account_status || session.user.accountStatus || 'Active'} />
              <ProfileField label="Last login" value={formatDate(session.loginAt)} />
            </dl>
          </SectionCard>

          <div className={cn('space-y-6', profileTab === 'preferences' || profileTab === 'security' ? undefined : 'hidden')}>
            <SectionCard
              icon={Globe}
              title="Preferences"
              description="Language, timezone, and notifications."
              className={profileTab === 'preferences' ? undefined : 'hidden'}
            >
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="language" className="text-sm text-muted-foreground">
                    Language
                  </Label>
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="en">English</option>
                    <option value="id" disabled>
                      Indonesian (coming soon)
                    </option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-sm text-muted-foreground">Time zone</Label>
                  <select id="timezone" value={profilePrefs.timezone} onChange={(event) => updateProfilePreferences({ ...profilePrefs, timezone: event.target.value })} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <option value="Asia/Jakarta">Jakarta (UTC+7)</option>
                    <option value="Asia/Singapore">Singapore (UTC+8)</option>
                    <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
                    <option value="Australia/Sydney">Sydney (UTC+10)</option>
                    <option value="Europe/London">London (UTC+0/+1)</option>
                    <option value="America/New_York">New York (UTC-5/-4)</option>
                  </select>
                </div>
                <div className="border-t border-border/40 pt-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><Bell className="h-4 w-4 text-primary" aria-hidden /> Notification preferences</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ['taskAssignment', 'Task assignments'],
                      ['mentions', 'Mentions'],
                      ['approvals', 'Approval requests'],
                      ['reminders', 'Task reminders'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={profilePrefs.notifications[key] ?? false} onChange={(event) => updateProfilePreferences({ ...profilePrefs, notifications: { ...profilePrefs.notifications, [key]: event.target.checked } })} className="h-4 w-4 rounded border-input text-primary accent-primary" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={Shield}
              title="Session & security"
              description="Active session on this device."
              className={profileTab === 'security' ? undefined : 'hidden'}
            >
              <dl>
                <ProfileField label="Session token" value={maskToken(session.token)} mono />
              </dl>
              <p className="flex items-start gap-2 border-t border-border/40 py-4 text-xs leading-relaxed text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Token is partially masked for security. Sign out to end your session in this browser.
              </p>
              <div className="border-t border-border/40 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Passkey</p>
                    <p className="text-xs text-muted-foreground">
                      Add a passkey to sign in with your fingerprint / PIN — no password.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 gap-2"
                    onClick={() => void handleAddPasskey()}
                    disabled={passkeyBusy}
                  >
                    <Fingerprint className="h-4 w-4" />
                    {passkeyBusy ? 'Adding…' : 'Add passkey'}
                  </Button>
                </div>
                {passkeyMsg && (
                  <p className={cn('mt-3 text-xs', passkeyMsg.ok ? 'text-emerald-600' : 'text-destructive')}>
                    {passkeyMsg.text}
                  </p>
                )}
              </div>
              <div className="border-t border-border/40 py-5">
                <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/[0.045] via-background to-background p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <HeartHandshake className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Help your partner</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Send a secure password reset link to a colleague with a password-based Tectona account. Microsoft and other SSO-only accounts are not changed.
                      </p>
                    </div>
                  </div>
                  <form
                    className="mt-4 flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handlePartnerReset()
                    }}
                  >
                    <label htmlFor="partner-reset-email" className="sr-only">Partner email address</label>
                    <input
                      id="partner-reset-email"
                      type="email"
                      value={partnerEmail}
                      onChange={(event) => setPartnerEmail(event.target.value)}
                      placeholder="partner@company.com"
                      autoComplete="email"
                      required
                      className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button type="submit" className="h-10 shrink-0 gap-2" disabled={partnerResetBusy || !partnerEmail.trim()}>
                      <Send className="h-4 w-4" aria-hidden />
                      {partnerResetBusy ? 'Sending…' : 'Send reset link'}
                    </Button>
                  </form>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Only active password-based Tectona accounts in your organization are eligible.
                  </p>
                  {partnerResetMsg ? (
                    <p role="status" className={cn('mt-3 rounded-lg border px-3 py-2 text-xs', partnerResetMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-destructive/20 bg-destructive/[0.04] text-destructive')}>
                      {partnerResetMsg.text}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-border/40 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Laptop className="h-4 w-4" aria-hidden /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">This device</p>
                    <p className="text-xs text-muted-foreground">Current browser session · Active now</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Active</span>
                </div>
                <Button type="button" variant="outline" className="mt-3 h-10 w-full gap-2 text-xs" onClick={handleLogout}>
                  <Shield className="h-3.5 w-3.5" aria-hidden /> Sign out all devices
                </Button>
              </div>
            </SectionCard>
          </div>
          </main>
        </div>

        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
            <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div><h2 id="edit-profile-title" className="text-lg font-semibold text-foreground">Edit profile</h2><p className="mt-1 text-sm text-muted-foreground">These changes are saved for this browser.</p></div>
                <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Close edit profile"><span className="text-lg">×</span></button>
              </div>
              <div className="mt-5 space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <input id="display-name" value={editName} onChange={(event) => setEditName(event.target.value)} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" autoFocus />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="button" className="gap-2" onClick={saveDisplayName}><Check className="h-4 w-4" aria-hidden />Save changes</Button>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          Tectona Project Management Platform
        </footer>
      </div>
    </div>
  )
}
