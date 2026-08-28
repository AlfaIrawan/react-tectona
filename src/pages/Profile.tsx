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
  Laptop,
  LogOut,
  MapPin,
  MessageSquare,
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
import { fetchTokenAudit, fetchUserInfo, type OidcUserInfo } from '@/lib/api/identityApi'
import { listAuthzAssignments, type AuthzAssignmentDto } from '@/lib/api/authzApi'
import { passkeyErrorMessage } from '@/lib/api/webauthnApi'
import { buildLoginPathAfterSignOut } from '@/auth/loginRedirect'
import { authCardButtonClass } from '@/lib/authUiClasses'
import { enterpriseCyanGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { maskToken, readTokenTelemetry, type TokenTelemetryEvent } from '@/lib/tokenTelemetry'
import { normalizeUserDisplayName } from '@/lib/userDisplayName'

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


type CatalogAvailability = 'Available' | 'Limited' | 'Unavailable' | 'Deprecated'

type CatalogModel = {
  id: string
  name: string
  type: string
  capabilities: string[]
  contextWindow: string
  availability: CatalogAvailability
  isDefault: boolean
  inputPrice: number
  outputPrice: number
  bestFor: string
  tectonaCapabilities: string[]
  strengths: string[]
}

const catalogModels: CatalogModel[] = [
  {
    id: 'gemma-4-26b',
    name: 'Gemma 4 26B',
    type: 'General + Multilingual',
    capabilities: ['General', 'Multilingual'],
    contextWindow: '128K',
    availability: 'Available',
    isDefault: true,
    inputPrice: 2394,
    outputPrice: 6840,
    bestFor: 'General enterprise assistance, multilingual content, and document understanding.',
    tectonaCapabilities: ['AI Assistant', 'Document Intelligence', 'Knowledge Assistant'],
    strengths: ['Strong multilingual understanding', 'Efficient general-purpose generation', 'Reliable document comprehension', 'Optimized for enterprise use'],
  },
  {
    id: 'qwen-3-6-35b-a3b-fp8',
    name: 'Qwen 3.6 35B A3B FP8',
    type: 'Vision + Text + Reasoning',
    capabilities: ['Vision', 'Text', 'Document', 'Reasoning'],
    contextWindow: '128K',
    availability: 'Available',
    isDefault: false,
    inputPrice: 2223,
    outputPrice: 15390,
    bestFor: 'Business analysis, multimodal understanding, document analysis, visual reasoning, and text generation.',
    tectonaCapabilities: ['Document Intelligence', 'AI Assistant', 'Requirement Analysis', 'Knowledge Assistant'],
    strengths: ['Strong business and requirement analysis', 'Excellent vision and text understanding', 'Efficient mixture-of-experts architecture', 'Strong performance for document analysis'],
  },
  {
    id: 'gpt-oss-120b',
    name: 'GPT-OSS 120B',
    type: 'Reasoning + General',
    capabilities: ['Reasoning', 'General'],
    contextWindow: '128K',
    availability: 'Available',
    isDefault: false,
    inputPrice: 823,
    outputPrice: 4001,
    bestFor: 'Complex reasoning, structured analysis, and demanding general-purpose tasks.',
    tectonaCapabilities: ['AI Assistant', 'Requirement Analysis', 'Workflow Automation'],
    strengths: ['Strong structured reasoning', 'Capable general-purpose generation', 'Effective analytical assistance', 'Optimized for complex tasks'],
  },
]

const capabilityMatrix = [
  ['General Q&A', 'supported', 'supported', 'supported'],
  ['Reasoning', 'partial', 'supported', 'supported'],
  ['Vision', 'none', 'supported', 'none'],
  ['Document Analysis', 'supported', 'supported', 'supported'],
  ['Multilingual', 'supported', 'supported', 'supported'],
] as const

function availabilityClass(availability: CatalogAvailability): string {
  if (availability === 'Available') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
  if (availability === 'Limited') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
  if (availability === 'Deprecated') return 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300'
  return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
}

function CapabilityIndicator({ value }: { value: 'supported' | 'partial' | 'none' }) {
  if (value === 'supported') return <span className="font-semibold text-emerald-600" title="Supported">✓</span>
  if (value === 'partial') return <span className="font-semibold text-slate-500" title="Partial">◐</span>
  return <span className="text-muted-foreground" title="Not supported">—</span>
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
              <h2 id="model-detail-title" className="mt-0.5 truncate text-lg font-semibold tracking-tight">{model.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Enterprise model available through Lintasarta</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close model details" className="rounded-lg border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border/60 hover:bg-background/80 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium', availabilityClass(model.availability))}>● {model.availability}</span>
          {model.isDefault ? <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">Default model</span> : null}
          <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{model.type}</span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <section>
          <div className="mb-2 flex items-center gap-2"><Server className="h-3.5 w-3.5 text-primary" /><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Model overview</h3></div>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border/60 bg-background/45 shadow-sm">
            {[
              ['Provider', 'Lintasarta'],
              ['Context window', `${model.contextWindow} tokens`],
              ['Availability', model.availability],
              ['Default model', model.isDefault ? 'Yes' : 'No'],
            ].map(([label, value], index) => <div key={label} className={cn('p-3', index % 2 === 0 && 'border-r border-border/40', index < 2 && 'border-b border-border/40')}><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-semibold text-foreground">{value}</p></div>)}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">Rp</span><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Model pricing</h3></div><span className="text-[10px] text-muted-foreground">Per 1M tokens</span></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/15"><p className="text-[10px] text-muted-foreground">Input tokens</p><p className="mt-1 text-base font-semibold tracking-tight text-blue-700 dark:text-blue-300">Rp {model.inputPrice.toLocaleString('en-US')}</p></div>
            <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/15"><p className="text-[10px] text-muted-foreground">Output tokens</p><p className="mt-1 text-base font-semibold tracking-tight text-violet-700 dark:text-violet-300">Rp {model.outputPrice.toLocaleString('en-US')}</p></div>
          </div>
        </section>

        <section className="rounded-xl border border-primary/15 bg-primary/[0.035] p-3.5">
          <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">Best for</h3></div>
          <p className="mt-2 text-xs leading-relaxed text-foreground/80">{model.bestFor}</p>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2"><Boxes className="h-3.5 w-3.5 text-primary" /><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Used by TECTONA capabilities</h3></div>
          <div className="grid grid-cols-2 gap-2">{model.tectonaCapabilities.map((capability) => <div key={capability} className="flex min-h-10 items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2 text-[11px] font-medium"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10"><Sparkles className="h-3 w-3 text-primary" /></span>{capability}</div>)}</div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /><h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Key strengths</h3></div>
          <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-1">{model.strengths.map((strength, index) => <div key={strength} className={cn('flex items-start gap-2.5 py-2.5 text-xs', index > 0 && 'border-t border-border/35')}><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span><span className="leading-relaxed text-foreground/80">{strength}</span></div>)}</div>
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
  const [selectedModel, setSelectedModel] = useState<CatalogModel | null>(null)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const defaultModel = catalogModels.find((model) => model.isDefault) as CatalogModel

  return (
    <>
      <SectionCard
        icon={Sparkles}
        title="AI Provider & Models"
        description="View AI providers and models available to your account."
        headerAside={<div className="flex items-center gap-2 text-xs text-muted-foreground"><span title={updatedAt.toLocaleTimeString('en-US')}>Updated just now</span><button type="button" aria-label="Refresh AI provider catalog" title="Refresh" onClick={() => setUpdatedAt(new Date())} className="rounded-md p-1.5 hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" aria-hidden /></button></div>}
      >
        <div className="space-y-4 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/50 p-3"><p className="text-xs text-muted-foreground">Available providers</p><p className="mt-1 text-xl font-semibold">1</p><p className="text-[11px] text-muted-foreground">Enterprise provider</p></div>
            <div className="rounded-lg border border-border/60 bg-background/50 p-3"><p className="text-xs text-muted-foreground">Available models</p><p className="mt-1 text-xl font-semibold">{catalogModels.length}</p><p className="text-[11px] text-muted-foreground">Ready to use</p></div>
            <div className="rounded-lg border border-border/60 bg-background/50 p-3"><p className="text-xs text-muted-foreground">Default model</p><p className="mt-1 text-base font-semibold">{defaultModel.name.replace(' 7B', '')}</p><span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{defaultModel.type}</span></div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">AI Provider</h3>
            <div className="mt-2 grid items-center gap-4 rounded-lg border border-border/60 p-3 md:grid-cols-[1.5fr_repeat(3,minmax(0,0.7fr))]">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Server className="h-4 w-4" aria-hidden /></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Lintasarta</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">OpenAI Compatible</span></div><p className="text-xs text-muted-foreground">Enterprise AI services for TECTONA</p></div></div>
              <div><p className="flex items-center gap-1 text-[10px] text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> Status</p><p className="mt-1 text-xs font-medium text-emerald-600">● Available</p></div>
              <div><p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Boxes className="h-3 w-3" /> Models</p><p className="mt-1 text-xs font-medium">3 models</p></div>
              <div><p className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" /> Region</p><p className="mt-1 text-xs font-medium">Indonesia</p></div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Available Models</h3><p className="text-xs text-muted-foreground">Select a model to view capabilities, details, and pricing.</p>
            <div className="mt-2 hidden overflow-hidden rounded-lg border border-border/60 md:block"><table className="w-full text-left text-xs"><thead className="bg-muted/30 text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Model</th><th className="px-3 py-2 font-medium">Capabilities</th><th className="px-3 py-2 font-medium">Context Window</th><th className="px-3 py-2 font-medium">Availability</th><th className="px-3 py-2 font-medium">Default</th><th className="w-10 px-3 py-2 font-medium">Action</th></tr></thead><tbody>{catalogModels.map((model) => <tr key={model.id} role="button" tabIndex={0} onClick={() => setSelectedModel(model)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedModel(model) }} className="cursor-pointer border-t border-border/40 transition-colors hover:bg-muted/35"><td className="px-3 py-3 font-medium">{model.name}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{model.capabilities.map((capability) => <span key={capability} className="rounded-full bg-primary/7 px-2 py-0.5 text-[10px] text-primary">{capability}</span>)}</div></td><td className="px-3 py-3">{model.contextWindow}</td><td className="px-3 py-3"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', availabilityClass(model.availability))}>● {model.availability}</span></td><td className="px-3 py-3">{model.isDefault ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Default</span> : '—'}</td><td className="px-3 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td></tr>)}</tbody></table></div>
            <div className="mt-2 space-y-2 md:hidden">{catalogModels.map((model) => <button key={model.id} type="button" onClick={() => setSelectedModel(model)} className="w-full rounded-lg border border-border/60 p-3 text-left hover:bg-muted/35"><div className="flex items-center justify-between"><span className="text-sm font-medium">{model.name}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2 flex flex-wrap gap-1">{model.capabilities.map((capability) => <span key={capability} className="rounded-full bg-primary/7 px-2 py-0.5 text-[10px] text-primary">{capability}</span>)}</div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{model.contextWindow} context</span><span className="text-emerald-600">● {model.availability}</span></div></button>)}</div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-border/60 p-3"><h3 className="text-sm font-semibold">Model Capability Matrix</h3><p className="text-xs text-muted-foreground">Compare key capabilities across available models.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-xs"><thead className="text-muted-foreground"><tr><th className="pb-2 text-left font-medium">Capability</th>{catalogModels.map((model) => <th key={model.id} className="pb-2 text-center font-medium">{model.name.replace(/ (26B|7B|120B)$/, '')}</th>)}</tr></thead><tbody>{capabilityMatrix.map(([capability, ...values]) => <tr key={capability} className="border-t border-border/40"><td className="py-2">{capability}</td>{values.map((value, index) => <td key={`${capability}-${catalogModels[index].id}`} className="py-2 text-center"><CapabilityIndicator value={value} /></td>)}</tr>)}</tbody></table></div><div className="mt-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground"><span className="text-emerald-600">✓ Supported</span><span>◐ Partial</span><span>— Not supported</span></div></div>
            <div className="rounded-lg border border-border/60 p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Model Pricing</h3><p className="text-xs text-muted-foreground">Pricing per 1M tokens provided by Lintasarta.</p></div><button type="button" onClick={onViewUsage} className="text-[11px] font-medium text-primary hover:underline">View usage</button></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{catalogModels.map((model) => <button key={model.id} type="button" onClick={() => setSelectedModel(model)} className="rounded-lg border border-border/50 p-3 text-left hover:bg-muted/30"><p className="text-xs font-semibold">{model.name}</p><div className="mt-3"><p className="text-[10px] text-muted-foreground">Input</p><p className="text-sm font-semibold text-primary">Rp {model.inputPrice.toLocaleString('en-US')}</p></div><div className="mt-2"><p className="text-[10px] text-muted-foreground">Output</p><p className="text-sm font-semibold text-violet-600">Rp {model.outputPrice.toLocaleString('en-US')}</p></div></button>)}</div><p className="mt-3 text-[10px] text-muted-foreground">ⓘ All prices are in IDR and subject to change.</p></div>
          </div>
        </div>
      </SectionCard>

      {selectedModel ? <ModelDetailDrawer model={selectedModel} onClose={() => setSelectedModel(null)} onViewPerformance={() => { setSelectedModel(null); onViewPerformance() }} /> : null}
    </>
  )
}

type PerformanceWindow = 7 | 30 | 90
type PerformanceStatus = 'Healthy' | 'Degraded' | 'Critical'

const performanceInteractions = ['AI Assistant', 'Document Generation', 'Requirement Analysis', 'Knowledge Assistant', 'Workflow Automation']
const performanceModels = [
  { key: 'qwen', label: 'Qwen 3.6 35B A3B FP8' },
  { key: 'gemma', label: 'Gemma 4' },
  { key: 'gpt-oss', label: 'GPT-OSS' },
]

function performancePercentile(values: number[], percentile: number): number | null {
  if (values.length < 2) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * percentile
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

function seconds(value: number | null): string {
  return value === null ? '—' : `${(value / 1000).toFixed(1)}s`
}

function performanceStatus(avgMs: number | null, successRate: number | null): PerformanceStatus | null {
  if (avgMs === null && successRate === null) return null
  if (successRate !== null && successRate < 97 || avgMs !== null && avgMs >= 5000) return 'Critical'
  if (successRate !== null && successRate < 99 || avgMs !== null && avgMs >= 3000) return 'Degraded'
  return 'Healthy'
}

function statusClass(status: PerformanceStatus | null): string {
  if (status === 'Critical') return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
  if (status === 'Degraded') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
}

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
  const normalized = (model ?? '').toLowerCase()
  if (normalized.includes('gemma')) return 'Gemma 4 26B'
  if (normalized.includes('qwen3.6')) return 'Qwen 3.6 35B A3B FP8'
  if (normalized.includes('qwen')) return 'Qwen (legacy)'
  if (normalized.includes('gpt-oss')) return 'GPT-OSS 120B'
  return model?.split('/').pop() ?? 'Unknown model'
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
  const period = usagePeriod(range, now, customFrom, customTo)
  const filteredEvents = events.filter((event) => { const timestamp = new Date(event.occurredAt); return timestamp >= period.start && timestamp <= period.end })
  const periodDuration = Math.max(period.end.getTime() - period.start.getTime(), 86400000)
  const previousStart = new Date(period.start.getTime() - periodDuration)
  const previousEvents = events.filter((event) => { const timestamp = new Date(event.occurredAt); return timestamp >= previousStart && timestamp < period.start })
  const totalTokens = filteredEvents.reduce((sum, event) => sum + (event.totalTokens ?? 0), 0)
  const inputTokens = filteredEvents.reduce((sum, event) => sum + (event.inputTokens ?? 0), 0)
  const outputTokens = filteredEvents.reduce((sum, event) => sum + (event.outputTokens ?? 0), 0)
  const previousTokens = previousEvents.reduce((sum, event) => sum + (event.totalTokens ?? 0), 0)
  const completePricing = filteredEvents.length > 0 && filteredEvents.every((event) => typeof event.totalCostIdr === 'number')
  const totalCost = completePricing ? filteredEvents.reduce((sum, event) => sum + (event.totalCostIdr ?? 0), 0) : null
  const previousCompletePricing = previousEvents.length > 0 && previousEvents.every((event) => typeof event.totalCostIdr === 'number')
  const previousCost = previousCompletePricing ? previousEvents.reduce((sum, event) => sum + (event.totalCostIdr ?? 0), 0) : 0
  const activeDays = new Set(filteredEvents.map((event) => event.occurredAt.slice(0, 10))).size
  const previousActiveDays = new Set(previousEvents.map((event) => event.occurredAt.slice(0, 10))).size
  const suffix = range === '30d' ? '30 days' : 'period'

  const groupedDailyTokens = new Map<string, { date: string; input: number; output: number }>()
  filteredEvents.forEach((event) => { const key = event.occurredAt.slice(0, 10); const row = groupedDailyTokens.get(key) ?? { date: key, input: 0, output: 0 }; row.input += event.inputTokens ?? 0; row.output += event.outputTokens ?? 0; groupedDailyTokens.set(key, row) })
  const dailyTokens = [...groupedDailyTokens.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({ ...row, label: new Date(`${row.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))

  const capabilityRows = performanceInteractions.map((capability) => {
    const capabilityEvents = filteredEvents.filter((event) => interactionName(event) === capability)
    const tokens = capabilityEvents.reduce((sum, event) => sum + (event.totalTokens ?? 0), 0)
    return { capability, calls: capabilityEvents.length, tokens, share: totalTokens ? tokens / totalTokens * 100 : 0 }
  }).sort((a, b) => b.tokens - a.tokens)
  const modelCostMap = new Map(catalogModels.map((model) => [model.name, 0]))
  filteredEvents.forEach((event) => { const label = catalogModelLabel(event.model); modelCostMap.set(label, (modelCostMap.get(label) ?? 0) + (event.totalCostIdr ?? 0)) })
  const modelCosts = [...modelCostMap.entries()].map(([name, cost]) => ({ name, cost, share: totalCost ? cost / totalCost * 100 : 0 })).sort((a, b) => b.cost - a.cost)
  const distribution = [{ name: 'User initiated', value: filteredEvents.filter((event) => event.source === 'user').length, color: '#2563eb' }, { name: 'System automatic', value: filteredEvents.filter((event) => event.source === 'system').length, color: '#7c3aed' }]
  const recentEvents = filteredEvents.slice(0, 8)

  return <>
    <SectionCard icon={Activity} title="AI Usage & Spending" description="Track your AI activity, token consumption, and estimated usage cost across TECTONA." headerAside={<div className="flex flex-wrap items-center justify-end gap-2"><select aria-label="Usage time range" value={range} onChange={(event) => setRange(event.target.value as UsageRange)} className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="year">This year</option><option value="custom">Custom range</option></select><span title={updatedAt.toLocaleTimeString('en-US')} className="hidden text-xs text-muted-foreground sm:inline">Updated just now</span><button type="button" aria-label="Refresh AI usage" title="Refresh" onClick={() => { setUpdatedAt(new Date()); window.dispatchEvent(new CustomEvent('tectona:token-telemetry-updated')) }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" /></button></div>}>
      <div className="space-y-4 py-4">
        {range === 'custom' ? <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border/50 bg-muted/20 p-2 text-xs"><label className="flex items-center gap-2 text-muted-foreground">From<input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-md border border-border/60 bg-background px-2 py-1 text-foreground" /></label><label className="flex items-center gap-2 text-muted-foreground">To<input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} className="rounded-md border border-border/60 bg-background px-2 py-1 text-foreground" /></label></div> : null}
        {loading && !events.length ? <div className="space-y-4 animate-pulse"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-xl bg-muted/60" />)}</div><div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]"><div className="h-64 rounded-xl bg-muted/50" /><div className="h-64 rounded-xl bg-muted/50" /></div><div className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 rounded-xl bg-muted/40" />)}</div><div className="h-52 rounded-xl bg-muted/40" /></div> : error && !events.length ? <div className="rounded-xl border border-destructive/20 bg-destructive/[0.035] px-5 py-7 text-center"><h3 className="text-sm font-semibold">Unable to load AI usage data</h3><p className="mt-1 text-xs text-muted-foreground">AI usage information is temporarily unavailable.</p><Button type="button" variant="outline" className="mt-4" onClick={onRetry}>Retry</Button></div> : !filteredEvents.length ? <div className="rounded-xl border border-dashed border-border/70 px-5 py-9 text-center"><h3 className="text-sm font-semibold">No AI activity yet</h3><p className="mx-auto mt-1 max-w-lg text-xs text-muted-foreground">Your AI usage, token consumption, and estimated cost will appear after you start using AI capabilities in TECTONA.</p><Link to="/projects" className="mt-4 inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">Explore AI Features</Link></div> : <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
            { label: 'AI calls', value: filteredEvents.length.toLocaleString(), detail: comparisonText(filteredEvents.length, previousEvents.length, suffix), icon: MessageSquare, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
            { label: 'Total tokens', value: totalTokens.toLocaleString(), detail: comparisonText(totalTokens, previousTokens, suffix), icon: Coins, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' },
            { label: 'Estimated cost', value: totalCost === null ? '—' : `Rp ${Math.round(totalCost).toLocaleString('id-ID')}`, detail: totalCost === null ? 'Pricing information is unavailable for one or more models.' : comparisonText(totalCost, previousCost, suffix), icon: BarChart3, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' },
            { label: 'Active days', value: activeDays.toLocaleString(), detail: `${activeDays - previousActiveDays >= 0 ? '+' : ''}${activeDays - previousActiveDays} days vs previous ${suffix}`, icon: CalendarDays, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/20' },
          ].map(({ label, value, detail, icon: Icon, tone }) => <div key={label} className="rounded-xl border border-border/60 bg-background/50 p-3"><div className="flex items-center gap-3"><div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', tone)}><Icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p></div></div><p className="mt-2 text-[10px] text-muted-foreground">{detail}</p></div>)}</div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><TokenActivityHeatmap events={events} /><div className="rounded-xl border border-border/50 bg-background/45 p-4"><h3 className="text-sm font-semibold">AI Call Distribution</h3><p className="text-xs text-muted-foreground">Breakdown of AI calls by initiation type.</p><div className="mt-3"><div className="relative mx-auto h-40 max-w-[13rem]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none">{distribution.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-semibold">{filteredEvents.length}</span><span className="text-[10px] text-muted-foreground">Total calls</span></div></div><div className="mt-3 space-y-2 border-t border-border/40 pt-3">{distribution.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-medium">{item.value} <span className="text-muted-foreground">({filteredEvents.length ? (item.value / filteredEvents.length * 100).toFixed(1) : '0.0'}%)</span></span></div>)}</div></div></div></div>

          <div className="grid gap-4 xl:grid-cols-3"><div className="rounded-xl border border-border/50 bg-background/45 p-4"><h3 className="text-sm font-semibold">Token Consumption</h3><p className="text-xs text-muted-foreground">Total tokens used in the selected period.</p><div className="mt-3 grid grid-cols-3 gap-2">{[['Input tokens', inputTokens], ['Output tokens', outputTokens], ['Avg tokens / call', Math.round(totalTokens / Math.max(filteredEvents.length, 1))]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border/50 p-2.5"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{Number(value).toLocaleString()}</p></div>)}</div><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyTokens}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / .55)" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} tick={{ fontSize: 9 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} width={38} /><Tooltip /><Bar dataKey="input" name="Input tokens" stackId="tokens" fill="#2563eb" radius={[0, 0, 2, 2]} /><Bar dataKey="output" name="Output tokens" stackId="tokens" fill="#34d399" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="flex gap-4 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-600" />Input tokens</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" />Output tokens</span></div></div>
            <div className="rounded-xl border border-border/50 bg-background/45 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Estimated Spending</h3><p className="text-xs text-muted-foreground">Estimated cost based on token usage and model pricing.</p></div><button type="button" onClick={onViewProviders} className="shrink-0 text-[10px] font-medium text-primary hover:underline">View model pricing →</button></div><p className="mt-4 text-2xl font-semibold tracking-tight">{totalCost === null ? '—' : `Rp ${Math.round(totalCost).toLocaleString('id-ID')}`}</p><p className="mt-1 text-[10px] text-muted-foreground">{totalCost === null ? 'Pricing information is unavailable for one or more models.' : comparisonText(totalCost, previousCost, suffix)}</p><div className="mt-4 overflow-hidden rounded-lg border border-border/50"><div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground"><span>Model</span><span>Estimated cost</span><span>Share</span></div>{modelCosts.map((row, index) => <div key={row.name} className={cn('grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-xs', index > 0 && 'border-t border-border/35')}><span className="truncate font-medium">{row.name}</span><span>{totalCost === null ? '—' : `Rp ${Math.round(row.cost).toLocaleString('id-ID')}`}</span><span className="text-muted-foreground">{totalCost ? `${row.share.toFixed(1)}%` : '—'}</span></div>)}</div></div>
            <div className="rounded-xl border border-border/50 bg-background/45 p-4"><h3 className="text-sm font-semibold">Usage by TECTONA Capability</h3><p className="text-xs text-muted-foreground">AI calls and token usage by feature area.</p><div className="mt-3 overflow-hidden rounded-lg border border-border/50"><div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground"><span>Capability</span><span>Calls</span><span>Tokens</span><span>Share</span></div>{capabilityRows.map((row, index) => <div key={row.capability} className={cn('grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 text-xs', index > 0 && 'border-t border-border/35')}><span className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10"><Sparkles className="h-3 w-3 text-primary" /></span><span className="truncate">{row.capability}</span></span><span>{row.calls}</span><span>{row.tokens.toLocaleString()}</span><span className="text-muted-foreground">{row.share.toFixed(0)}%</span></div>)}</div></div></div>

          <div className="rounded-xl border border-border/50 bg-background/45"><div className="flex items-start justify-between gap-3 px-4 py-3"><div><h3 className="text-sm font-semibold">Recent AI Activity</h3><p className="text-xs text-muted-foreground">Latest AI interactions and token usage.</p></div><button type="button" onClick={() => setActivityListOpen(true)} className="text-[10px] font-medium text-primary hover:underline">View all activity →</button></div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] text-left text-[11px]"><thead className="border-y border-border/40 bg-muted/20 text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Capability</th><th className="px-3 py-2 font-medium">Model</th><th className="px-3 py-2 font-medium">Initiator</th><th className="px-3 py-2 text-right font-medium">Input</th><th className="px-3 py-2 text-right font-medium">Output</th><th className="px-3 py-2 text-right font-medium">Total</th><th className="px-3 py-2 text-right font-medium">Cost (Est.)</th><th className="w-9 px-3 py-2" /></tr></thead><tbody>{recentEvents.map((event) => <tr key={event.id} onClick={() => setSelectedActivity(event)} className="cursor-pointer border-b border-border/30 last:border-0 hover:bg-muted/30"><td className="whitespace-nowrap px-3 py-2.5">{new Date(event.occurredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td><td className="px-3 py-2.5">{interactionName(event)}</td><td className="px-3 py-2.5">{catalogModelLabel(event.model)}</td><td className="px-3 py-2.5"><span className={cn('rounded-full px-2 py-0.5 text-[10px]', event.source === 'user' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700')}>{event.source === 'user' ? 'User' : 'System'}</span></td><td className="px-3 py-2.5 text-right">{event.inputTokens?.toLocaleString() ?? '—'}</td><td className="px-3 py-2.5 text-right">{event.outputTokens?.toLocaleString() ?? '—'}</td><td className="px-3 py-2.5 text-right">{event.totalTokens?.toLocaleString() ?? '—'}</td><td className="px-3 py-2.5 text-right">{typeof event.totalCostIdr === 'number' ? `Rp ${Math.round(event.totalCostIdr).toLocaleString('id-ID')}` : '—'}</td><td className="px-3 py-2.5"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td></tr>)}</tbody></table></div><div className="space-y-2 border-t border-border/40 p-3 md:hidden">{recentEvents.map((event) => <button key={event.id} type="button" onClick={() => setSelectedActivity(event)} className="w-full rounded-lg border border-border/50 p-3 text-left"><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium">{interactionName(event)}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></div><p className="mt-1 text-[10px] text-muted-foreground">{catalogModelLabel(event.model)} · {new Date(event.occurredAt).toLocaleString('en-US')}</p><p className="mt-2 text-[10px]">{event.totalTokens?.toLocaleString() ?? '—'} tokens · {typeof event.totalCostIdr === 'number' ? `Rp ${Math.round(event.totalCostIdr).toLocaleString('id-ID')}` : 'Cost unavailable'}</p></button>)}</div></div>
        </>}
      </div>
    </SectionCard>
    {activityListOpen ? <AIActivityListDrawer events={filteredEvents} onClose={() => setActivityListOpen(false)} onSelect={(event) => { setActivityListOpen(false); setSelectedActivity(event) }} /> : null}
    {selectedActivity ? <AIActivityDetailDrawer event={selectedActivity} onClose={() => setSelectedActivity(null)} /> : null}
  </>
}

function AIPerformanceCard({ events }: { events: TokenTelemetryEvent[] }) {
  const [windowSize, setWindowSize] = useState<PerformanceWindow>(30)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [now] = useState(() => Date.now())
  const performanceEvents = events.filter((event) => typeof event.latencyMs === 'number' && event.latencyMs >= 0)
  const statusEvents = events.filter((event) => event.performanceStatus)
  const hasData = performanceEvents.length > 0 || statusEvents.length > 0

  const trend = useMemo(() => {
    const start = new Date(now - (windowSize - 1) * 86400000)
    return Array.from({ length: windowSize }, (_, index) => {
      const date = new Date(start.getTime() + index * 86400000)
      const samples = performanceEvents.filter((event) => new Date(event.occurredAt).toDateString() === date.toDateString()).map((event) => event.latencyMs as number)
      return { date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), average: samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length / 1000 : null, p95: performancePercentile(samples, 0.95) ? (performancePercentile(samples, 0.95) as number) / 1000 : null }
    })
  }, [now, performanceEvents, windowSize])

  const avgMs = performanceEvents.length ? performanceEvents.reduce((sum, event) => sum + (event.latencyMs as number), 0) / performanceEvents.length : null
  const p95Ms = performancePercentile(performanceEvents.map((event) => event.latencyMs as number), 0.95)
  const knownSuccessRate = statusEvents.length ? statusEvents.filter((event) => event.performanceStatus === 'success').length / statusEvents.length * 100 : null
  const failedCount = statusEvents.filter((event) => event.performanceStatus !== 'success').length

  const reliability = [
    { label: 'Successful', value: knownSuccessRate, status: knownSuccessRate !== null ? 'Healthy' : null },
    { label: 'Failed', value: statusEvents.length ? statusEvents.filter((event) => event.performanceStatus === 'failed').length / statusEvents.length * 100 : null },
    { label: 'Timeout', value: statusEvents.length ? statusEvents.filter((event) => event.performanceStatus === 'timeout').length / statusEvents.length * 100 : null },
    { label: 'Rate limited', value: statusEvents.length ? statusEvents.filter((event) => event.performanceStatus === 'rate_limited').length / statusEvents.length * 100 : null },
    { label: 'Retried', value: events.some((event) => event.retryCount !== undefined) ? events.reduce((sum, event) => sum + (event.retryCount ?? 0), 0) / Math.max(events.length, 1) * 100 : null },
  ]

  const modelRows = performanceModels.map((model) => {
    const modelEvents = performanceEvents.filter((event) => (event.model ?? '').toLowerCase().includes(model.key))
    const values = modelEvents.map((event) => event.latencyMs as number)
    const modelStatuses = modelEvents.filter((event) => event.performanceStatus)
    const success = modelStatuses.length ? modelStatuses.filter((event) => event.performanceStatus === 'success').length / modelStatuses.length * 100 : null
    return { ...model, avg: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, p95: performancePercentile(values, 0.95), success, timeout: modelStatuses.length ? modelStatuses.filter((event) => event.performanceStatus === 'timeout').length / modelStatuses.length * 100 : null, status: performanceStatus(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, success) }
  })

  const interactionRows = performanceInteractions.map((label) => {
    const rows = performanceEvents.filter((event) => interactionName(event) === label)
    const values = rows.map((event) => event.latencyMs as number)
    const interactionStatuses = rows.filter((event) => event.performanceStatus)
    const success = interactionStatuses.length ? interactionStatuses.filter((event) => event.performanceStatus === 'success').length / interactionStatuses.length * 100 : null
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
    return { label, average, success, status: performanceStatus(average, success) }
  })

  const metricTitle = 'Not enough data yet'
  return (
    <SectionCard
      icon={Activity}
      title="AI Performance"
      description="Monitor the responsiveness and reliability of your AI interactions across TECTONA."
      headerAside={<div className="flex items-center gap-2 text-xs text-muted-foreground"><span title={updatedAt.toLocaleTimeString('en-US')}>Updated just now</span><button type="button" aria-label="Refresh AI performance" title="Refresh" onClick={() => { setUpdatedAt(new Date()); window.dispatchEvent(new CustomEvent('tectona:token-telemetry-updated')) }} className="rounded-md p-1.5 hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" aria-hidden /></button></div>}
    >
      <div className="space-y-4 py-4">
        {!hasData ? (
          <div className="rounded-lg border border-dashed border-border/70 px-5 py-8 text-center">
            <h3 className="text-sm font-semibold text-foreground">No AI performance data yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Performance metrics will appear after you start using AI capabilities in TECTONA.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Use AI Assistant, document generation, or other AI-powered features to start collecting performance insights.</p>
            <Link to="/projects" className="mt-4 inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">Explore AI Features</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Average response', value: seconds(avgMs), detail: avgMs !== null ? '↓ 8% vs previous period' : metricTitle },
                { label: <span title="95% of your AI interactions completed within this response time.">P95 response ⓘ</span>, value: seconds(p95Ms), detail: p95Ms === null ? metricTitle : '95th percentile' },
                { label: 'Success rate', value: knownSuccessRate === null ? '—' : `${knownSuccessRate.toFixed(1)}%`, detail: knownSuccessRate === null ? metricTitle : 'Healthy' },
                { label: 'Failed requests', value: statusEvents.length ? `${(100 - (knownSuccessRate ?? 0)).toFixed(1)}%` : '—', detail: statusEvents.length ? `${failedCount} failed interactions` : metricTitle },
              ].map((card) => <div key={String(card.label)} className="rounded-lg border border-border/60 bg-background/50 px-3 py-3"><p className="text-xs text-muted-foreground">{card.label}</p><p className="mt-1 text-xl font-semibold text-foreground">{card.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{card.detail}</p></div>)}
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Response Time Trend</h3><p className="text-xs text-muted-foreground">Average and P95 response time for your AI interactions.</p></div><div className="flex rounded-md border border-border/60 p-0.5">{([7, 30, 90] as PerformanceWindow[]).map((value) => <button key={value} type="button" onClick={() => setWindowSize(value)} className={cn('rounded px-2 py-1 text-[11px]', windowSize === value ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground')}>{value}D</button>)}</div></div>
              <div className="mt-3 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / .55)" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} minTickGap={24} /><YAxis unit="s" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="average" name="Average response" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls /><Line type="monotone" dataKey="p95" name="P95 response" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls /></LineChart></ResponsiveContainer></div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border/60 p-3"><h3 className="text-sm font-semibold">AI Reliability</h3><p className="text-xs text-muted-foreground">Runtime outcomes of your AI interactions.</p><div className="mt-3 space-y-2.5">{reliability.map((row) => <div key={row.label}><div className="flex items-center justify-between text-xs"><span title={row.label === 'Retried' ? 'AI interactions automatically retried after an unsuccessful attempt.' : row.label === 'Rate limited' ? 'Requests temporarily limited by an AI service or model.' : undefined}>{row.label}</span><span className="font-medium">{row.value === null ? <span title={metricTitle}>—</span> : `${row.value.toFixed(1)}%`}{row.status ? <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">Healthy</span> : null}</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(row.value ?? 0, 100)}%` }} /></div></div>)}</div></div>
              <div className="rounded-lg border border-border/60 p-3"><h3 className="text-sm font-semibold">Performance by Interaction Type</h3><p className="text-xs text-muted-foreground">Compare responsiveness across TECTONA AI capabilities.</p><div className="mt-3 space-y-1">{interactionRows.map((row) => <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded px-1 py-2 text-xs hover:bg-muted/50"><span>{row.label}</span><span>{seconds(row.average)} · {row.success === null ? '—' : `${row.success.toFixed(1)}%`}</span>{row.status ? <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', statusClass(row.status))}>{row.status}</span> : <span title={metricTitle}>—</span>}</div>)}</div></div>
            </div>
            <div className="rounded-lg border border-border/60 p-3"><h3 className="text-sm font-semibold">Model Performance</h3><p className="text-xs text-muted-foreground">Compare runtime performance across AI models available to your account.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-muted-foreground"><tr className="border-b border-border/40"><th className="pb-2 font-medium">Model</th><th className="pb-2 font-medium">Avg response</th><th className="pb-2 font-medium">P95</th><th className="pb-2 font-medium">Success rate</th><th className="pb-2 font-medium">Timeout</th><th className="pb-2 font-medium">Status</th></tr></thead><tbody>{modelRows.map((row) => <tr key={row.key} className="border-b border-border/30 last:border-0"><td className="py-2 font-medium">{row.label}</td><td>{seconds(row.avg)}</td><td>{seconds(row.p95)}</td><td>{row.success === null ? <span title={metricTitle}>—</span> : `${row.success.toFixed(1)}%`}</td><td>{row.timeout === null ? <span title={metricTitle}>—</span> : `${row.timeout.toFixed(1)}%`}</td><td>{row.status ? <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', statusClass(row.status))}>{row.status}</span> : <span title={metricTitle}>—</span>}</td></tr>)}</tbody></table></div></div>
          </>
        )}
      </div>
    </SectionCard>
  )
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
              <Button type="button" variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
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
          {profileTab === 'performance' ? <AIPerformanceCard events={tokenEvents} /> : null}
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
                    className="shrink-0 gap-2"
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
              <div className="border-t border-border/40 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Laptop className="h-4 w-4" aria-hidden /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">This device</p>
                    <p className="text-xs text-muted-foreground">Current browser session · Active now</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Active</span>
                </div>
                <Button type="button" variant="outline" className="mt-3 w-full gap-2 text-xs" onClick={handleLogout}>
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
