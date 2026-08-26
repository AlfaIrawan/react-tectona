import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Bell,
  Camera,
  Check,
  Clock,
  Edit3,
  Fingerprint,
  Globe,
  Laptop,
  LogOut,
  Shield,
  User,
} from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getSession, logoutAsync, requireAuth, registerPasskey, type Session } from '@/auth/authService'
import { fetchTokenAudit, fetchUserInfo, type OidcUserInfo } from '@/lib/api/identityApi'
import { passkeyErrorMessage } from '@/lib/api/webauthnApi'
import { buildLoginPathAfterSignOut } from '@/auth/loginRedirect'
import { authCardButtonClass } from '@/lib/authUiClasses'
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
  className,
  children,
}: {
  icon: typeof User
  title: string
  description: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('rounded-xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm', className)}>
      <div className="border-b border-border/40 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
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
        <div><p className="text-xs text-muted-foreground">Token events</p><p className="text-2xl font-semibold text-foreground">{events.length.toLocaleString()}</p></div>
        <p className="text-right text-xs text-muted-foreground">Last 12 months<br /><span className="text-foreground">User + system activity</span></p>
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
                <span key={day.key} title={`${day.key}: ${day.count} token event${day.count === 1 ? '' : 's'}`} className={cn('h-3 w-3 rounded-[2px]', day.count === 0 ? 'bg-muted' : day.count === 1 ? 'bg-emerald-200 dark:bg-emerald-900' : day.count === 2 ? 'bg-emerald-400 dark:bg-emerald-700' : 'bg-emerald-600 dark:bg-emerald-500')} />
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

function TokenUsageCard({ events, view = 'usage', costMode = 'all' }: { events: TokenTelemetryEvent[]; view?: 'usage' | 'cost'; costMode?: 'all' | 'performance' | 'provider' }) {
  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = date.toISOString().slice(0, 10)
      return { key, day: date.toLocaleDateString('en-US', { weekday: 'short' }), user: 0, system: 0 }
    })
    const byDay = new Map(days.map((day) => [day.key, day]))
    events.forEach((event) => {
      const day = byDay.get(event.occurredAt.slice(0, 10))
      if (day) day[event.source] += 1
    })
    return days
  }, [events])
  const userEvents = events.filter((event) => event.source === 'user')
  const systemEvents = events.filter((event) => event.source === 'system')
  const recentEvents = events.slice(0, 6)
  const costSummary = useMemo(() => {
    const byProvider = new Map<string, { vendor: string; provider: string; model: string; calls: number; tokens: number; cost: number; latencyTotal: number; latencySamples: number }>()
    events.forEach((event) => {
      const model = event.model ?? 'Unknown model'
      const provider = event.provider ?? 'openai_compat'
      const vendor = event.vendor ?? 'Lintas Arta'
      const key = `${vendor}|${provider}|${model}`
      const current = byProvider.get(key) ?? { vendor, provider, model, calls: 0, tokens: 0, cost: 0, latencyTotal: 0, latencySamples: 0 }
      current.calls += 1
      current.tokens += event.totalTokens ?? 0
      current.cost += event.totalCostIdr ?? 0
      if (typeof event.latencyMs === 'number') {
        current.latencyTotal += event.latencyMs
        current.latencySamples += 1
      }
      byProvider.set(key, current)
    })
    const configuredModels = [
      { model: 'google/gemma-4-26b-a4b-it', provider: 'openai_compat' },
      { model: 'qwen/qwen25-vl-7b-instruct', provider: 'openai_compat' },
      { model: 'openai/gpt-oss-120b', provider: 'openai_compat' },
    ]
    configuredModels.forEach(({ model, provider }) => {
      const key = `Lintas Arta|${provider}|${model}`
      if (!byProvider.has(key)) byProvider.set(key, { vendor: 'Lintas Arta', provider, model, calls: 0, tokens: 0, cost: 0, latencyTotal: 0, latencySamples: 0 })
    })
    const rows = [...byProvider.values()].sort((a, b) => b.cost - a.cost || a.model.localeCompare(b.model))
    return { rows, totalTokens: events.reduce((sum, event) => sum + (event.totalTokens ?? 0), 0), totalCost: events.reduce((sum, event) => sum + (event.totalCostIdr ?? 0), 0) }
  }, [events])
  const providerChartData = costSummary.rows.map((row) => ({
    model: row.model.split('/').pop() ?? row.model,
    calls: row.calls,
    tokens: row.tokens,
    latency: row.latencySamples ? Math.round(row.latencyTotal / row.latencySamples) : 0,
    latencySamples: row.latencySamples,
  }))
  const hasLatencyData = providerChartData.some((row) => row.latencySamples > 0)
  const activeTab = view

  return (
    <SectionCard icon={Activity} title="AI/LLM token activity" description="Actual input, output, and total tokens returned by the AI runtime.">
      <div className="space-y-5 py-4">
        <div className="min-w-0 flex-1">
          {activeTab === 'cost' ? (
          <div className="space-y-4">
            <div className={cn('grid gap-3 sm:grid-cols-3', costMode === 'performance' && 'hidden')}>
              <div className="rounded-xl border border-border/50 bg-background/60 p-3"><p className="text-xs text-muted-foreground">Estimated cost</p><p className="mt-1 text-xl font-semibold text-foreground">Rp {Math.round(costSummary.totalCost).toLocaleString('id-ID')}</p></div>
              <div className="rounded-xl border border-border/50 bg-background/60 p-3"><p className="text-xs text-muted-foreground">Total tokens</p><p className="mt-1 text-xl font-semibold text-foreground">{costSummary.totalTokens.toLocaleString()}</p></div>
              <div className="rounded-xl border border-border/50 bg-background/60 p-3"><p className="text-xs text-muted-foreground">Vendor / models</p><p className="mt-1 text-xl font-semibold text-foreground">1 / 3</p><p className="text-[10px] text-muted-foreground">Lintas Arta · 3 configured models</p></div>
            </div>
            <div className={cn('rounded-xl border border-border/50 bg-background/45 p-4', costMode === 'provider' && 'hidden')}>
              <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-foreground">Model performance</p><p className="text-xs text-muted-foreground">Average response latency from recorded LLM calls</p></div><span className="text-xs text-muted-foreground">milliseconds</span></div>
              <div className="h-52 w-full">
                {hasLatencyData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={providerChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / .55)" />
                      <XAxis dataKey="model" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [`${Number(value).toLocaleString('id-ID')} ms`, 'Avg latency']} />
                      <Bar dataKey="latency" name="Avg latency" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 text-center text-xs text-muted-foreground">
                    No latency data recorded yet.
                  </div>
                )}
              </div>
            </div>
            <div className={cn('rounded-xl border border-border/50 bg-background/45 p-4', costMode === 'performance' && 'hidden')}>
              <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-foreground">Usage by model</p><p className="text-xs text-muted-foreground">Calls and total tokens recorded per model</p></div><span className="text-xs text-muted-foreground">Tokens</span></div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={providerChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / .55)" />
                    <XAxis dataKey="model" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value, name) => [Number(value).toLocaleString('id-ID'), name === 'tokens' ? 'Tokens' : 'Calls']} />
                    <Bar dataKey="tokens" name="Tokens" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={cn('rounded-xl border border-border/50 bg-background/45 p-4', costMode === 'performance' && 'hidden')}>
              <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-foreground">Provider usage</p><p className="text-xs text-muted-foreground">Vendor: Lintas Arta · estimated from recorded tokens</p></div><span className="text-xs text-muted-foreground">IDR</span></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[44rem] text-left text-xs"><thead className="text-muted-foreground"><tr><th className="pb-2 font-medium">Vendor / provider</th><th className="pb-2 font-medium">Model</th><th className="pb-2 text-right font-medium">Calls</th><th className="pb-2 text-right font-medium">Tokens</th><th className="pb-2 text-right font-medium">Avg latency</th><th className="pb-2 text-right font-medium">Cost</th></tr></thead><tbody>{costSummary.rows.length ? costSummary.rows.map((row) => <tr key={`${row.vendor}-${row.provider}-${row.model}`} className="border-t border-border/40"><td className="py-2.5 text-foreground">{row.vendor}<span className="block text-[10px] text-muted-foreground">{row.provider}</span></td><td className="py-2.5 text-foreground">{row.model}</td><td className="py-2.5 text-right text-muted-foreground">{row.calls}</td><td className="py-2.5 text-right text-muted-foreground">{row.tokens.toLocaleString()}</td><td className="py-2.5 text-right text-muted-foreground">{row.latencySamples ? `${Math.round(row.latencyTotal / row.latencySamples).toLocaleString()} ms` : '—'}</td><td className="py-2.5 text-right font-medium text-foreground">Rp {Math.round(row.cost).toLocaleString('id-ID')}</td></tr>) : <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No priced AI usage recorded yet.</td></tr>}</tbody></table></div>
            </div>
            <div className={cn('grid gap-2 sm:grid-cols-3', costMode === 'performance' && 'hidden')}>
              {[['Gemma', 2394, 6840], ['Qwen', 2223, 15390], ['GPT-OSS', 823, 4001]].map(([model, input, output]) => <div key={model} className="rounded-lg border border-border/40 bg-background/35 p-3 text-xs"><p className="font-medium text-foreground">{model}</p><p className="mt-1 text-muted-foreground">Input: Rp {Number(input).toLocaleString('id-ID')} / 1M</p><p className="text-muted-foreground">Output: Rp {Number(output).toLocaleString('id-ID')} / 1M</p></div>)}
            </div>
          </div>
        ) : <>
        <TokenActivityHeatmap events={events} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Total AI calls</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{events.length}</p>
          </div>
          <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
            <p className="text-xs text-muted-foreground">User initiated</p>
            <p className="mt-1 text-xl font-semibold text-blue-600">{userEvents.length}</p>
          </div>
          <div className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
            <p className="text-xs text-muted-foreground">System automatic</p>
            <p className="mt-1 text-xl font-semibold text-violet-600">{systemEvents.length}</p>
          </div>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="profileTokenUser" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profileTokenSystem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / .55)" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="user" name="User initiated" stroke="#2563eb" fill="url(#profileTokenUser)" strokeWidth={2} />
              <Area type="monotone" dataKey="system" name="System automatic" stroke="#7c3aed" fill="url(#profileTokenSystem)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Recent token events</span>
            <span>{events.length ? 'Newest first' : 'No AI usage returned yet'}</span>
          </div>
          {recentEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-3 border-t border-border/40 py-2.5 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{event.event}</p>
                <p className="truncate text-muted-foreground">Trigger: {event.trigger ?? event.event}</p>
                <p className="truncate text-muted-foreground">Input: {event.inputTokens?.toLocaleString() ?? '—'} · Output: {event.outputTokens?.toLocaleString() ?? '—'} · Total: {event.totalTokens?.toLocaleString() ?? '—'} · {event.context ?? 'LLM usage'} · {new Date(event.occurredAt).toLocaleString()}</p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-1 font-medium', event.source === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300')}>
                {event.source === 'user' ? 'User' : 'System'}
              </span>
            </div>
          ))}
        </div>
        </>}
          </div>
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
  const [profileTab, setProfileTab] = useState<'account' | 'preferences' | 'security' | 'usage' | 'performance' | 'providers'>('account')
  const [identityProfile, setIdentityProfile] = useState<OidcUserInfo | null>(null)
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
    const localEvents = mergeTokenEvents([], readTokenTelemetry(currentSession.user.id))
    setTokenEvents(localEvents)
    void fetchTokenAudit(currentSession.token, 80, currentSession.user.id)
      .then((events) => setTokenEvents(mergeTokenEvents(events, localEvents)))
      .catch(() => undefined)
  }, [navigate])

  useEffect(() => {
    const refreshTokenEvents = () => {
      const current = getSession()
      if (!current) return
      void fetchTokenAudit(current.token, 80, current.user.id)
        .then((events) => setTokenEvents(mergeTokenEvents(events, readTokenTelemetry(current.user.id))))
        .catch(() => setTokenEvents(mergeTokenEvents([], readTokenTelemetry(current.user.id))))
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
  const platformRole = primaryRbacRole(effectiveRoles, session.user.role)
  const rbacRoles = effectiveRoles ?? []
  const initials = profileInitials(displayName, session.user.email)

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 lg:py-10">
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
                    {rbacRoleLabel(platformRole)}
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
          {profileTab === 'usage' ? <TokenUsageCard events={tokenEvents} view="usage" /> : null}
          {profileTab === 'performance' ? <TokenUsageCard events={tokenEvents} view="cost" costMode="performance" /> : null}
          {profileTab === 'providers' ? (
            <TokenUsageCard events={tokenEvents} view="cost" costMode="provider" />
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
              <ProfileField label="Primary RBAC role" value={rbacRoleLabel(platformRole)} />
              <ProfileField label="RBAC roles" value={rbacRoles.length ? rbacRoles.map(rbacRoleLabel).join(', ') : 'No role claims'} />
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
