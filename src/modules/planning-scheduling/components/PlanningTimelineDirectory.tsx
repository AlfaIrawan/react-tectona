import { Fragment, useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  ArrowUpDown,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock3,
  Filter,
  GanttChartSquare,
  Gauge,
  GripVertical,
  LayoutGrid,
  Layers3,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { EnterpriseGroupByControl } from '@/components/enterprise/EnterpriseGroupByControl'
import { EnterpriseSelectionToggle } from '@/components/enterprise/EnterpriseSelectionToggle'
import { EnterpriseColumnVisibilityControl } from '@/components/enterprise/EnterpriseColumnVisibilityControl'
import {
  PlanningSvarGantt,
  type PlanningGanttItem,
  type PlanningGanttZoomLevel,
} from '@/modules/planning-scheduling/components/PlanningSvarGantt'

type TimelineDocStatus = 'Active' | 'In Review' | 'Draft' | 'Archived'

export type PlanningTimelineDoc = {
  id: string
  name: string
  subtitle: string
  code: string
  scope: string
  owner: string
  status: TimelineDocStatus
  progress: number
  taskCount: number
  milestoneCount: number
  spark: number[]
  updatedLabel: string
  items: PlanningGanttItem[]
  workspaceOrder?: string[]
}

/** Build a Gantt item with sensible defaults so mock timelines stay compact. */
function mkItem(
  id: string,
  title: string,
  workspace: string,
  project: string,
  type: PlanningGanttItem['type'],
  startDate: string,
  endDate: string,
  progress: number,
  owner: string,
  parentId?: string,
): PlanningGanttItem {
  return { id, title, workspace, project, team: '—', owner, sprint: '—', type, startDate, endDate, progress, itemSource: 'tectona', parentId }
}

const MOCK_TIMELINE_DOCS: PlanningTimelineDoc[] = [
  {
    id: 'tl-core-banking',
    name: 'Core Banking Replatform',
    subtitle: 'Vendor to production delivery plan',
    code: 'TL-CORE-BANKING',
    scope: 'Delivery',
    owner: 'Ricky Gunawan',
    status: 'Active',
    progress: 45,
    taskCount: 18,
    milestoneCount: 1,
    spark: [8, 10, 9, 12, 14, 13, 16, 18],
    updatedLabel: '12 min ago',
    workspaceOrder: ['Wakatobi'],
    items: [
      // Epic — top-level row under the auto-generated "Wakatobi" project summary.
      mkItem('cb-epic', 'Banking System — vendor to production', 'Wakatobi', 'Wakatobi', 'Phase', '2026-08-06', '2026-10-07', 45, 'Ricky Gunawan'),

      // Feature — Kick-off & squad mobilization
      mkItem('cb-f1', 'Kick-off & squad mobilization', 'Wakatobi', 'Wakatobi', 'Phase', '2026-08-08', '2026-08-30', 70, 'Ricky Gunawan', 'cb-epic'),
      mkItem('cb-f1-t1', 'Target architecture blueprint sign-off', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-08-08', '2026-08-18', 80, 'Mina Aulia', 'cb-f1'),
      mkItem('cb-f1-t2', 'Delivery squad formation & RACI', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-08-13', '2026-08-23', 65, 'Jonas Rahardian', 'cb-f1'),
      mkItem('cb-f1-t3', 'Kick-off workshop preparation', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-08-14', '2026-08-24', 60, 'Ayla Putri', 'cb-f1'),
      mkItem('cb-f1-t4', 'Development & sandbox environment setup', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-08-18', '2026-08-28', 50, 'Rizky Pratama', 'cb-f1'),
      mkItem('cb-f1-t5', 'Joint kick-off meeting', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-08-20', '2026-08-30', 40, 'Ricky Gunawan', 'cb-f1'),

      // Feature — Vendor selection & procurement
      mkItem('cb-f2', 'Vendor selection & procurement', 'Wakatobi', 'Wakatobi', 'Phase', '2026-08-06', '2026-08-22', 55, 'Ricky Gunawan', 'cb-epic'),
      mkItem('cb-f2-t1', 'Final vendor contract & SLA review', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-08-06', '2026-08-16', 60, 'Ayla Putri', 'cb-f2'),
      mkItem('cb-f2-t2', 'Security & regulatory compliance', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-08-10', '2026-08-20', 40, 'Ayla Putri', 'cb-f2'),
      mkItem('cb-f2-t3', 'Vendor technical evaluation & planning', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-08-12', '2026-08-22', 35, 'Jonas Rahardian', 'cb-f2'),

      // Feature — Development phase 1 — sprint zero
      mkItem('cb-f3', 'Development phase 1 — sprint zero', 'Wakatobi', 'Wakatobi', 'Phase', '2026-09-02', '2026-10-07', 20, 'Mina Aulia', 'cb-epic'),
      mkItem('cb-f3-t1', 'Core ledger & account module', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-09-02', '2026-09-12', 25, 'Rizky Pratama', 'cb-f3'),
      mkItem('cb-f3-t2', 'Payment hub — domestic & international', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-09-09', '2026-09-19', 15, 'Rizky Pratama', 'cb-f3'),
      mkItem('cb-f3-t3', 'Legacy core data migration strategy', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-09-15', '2026-09-25', 10, 'Mina Aulia', 'cb-f3'),
      mkItem('cb-f3-t4', 'SWIFT / SEPA transfer implementation', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-09-17', '2026-09-27', 10, 'Jonas Rahardian', 'cb-f3'),
      mkItem('cb-f3-t5', 'Mobile banking channel MVP', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-09-22', '2026-10-02', 5, 'Ayla Putri', 'cb-f3'),
      mkItem('cb-f3-t6', 'Regulatory reporting (OJK / BI)', 'Wakatobi', 'Wakatobi', 'Workstream', '2026-09-27', '2026-10-07', 0, 'Ricky Gunawan', 'cb-f3'),

      // Milestone
      mkItem('cb-milestone', 'Go-live readiness review', 'Wakatobi', 'Wakatobi', 'Milestone', '2026-10-07', '2026-10-07', 0, 'Ricky Gunawan', 'cb-epic'),
    ],
  },
  {
    id: 'tl-loan-origination',
    name: 'Loan Origination Revamp',
    subtitle: 'Digital lending journey rollout',
    code: 'TL-LOAN-ORIGINATION',
    scope: 'Program',
    owner: 'Mina Aulia',
    status: 'Active',
    progress: 48,
    taskCount: 11,
    milestoneCount: 2,
    spark: [6, 7, 9, 8, 11, 12, 12, 14],
    updatedLabel: '34 min ago',
    workspaceOrder: ['Adira Digital Lending'],
    items: [
      mkItem('lo-1', 'Journey discovery & UX blueprint', 'Adira Digital Lending', 'Loan Origination', 'Phase', '2026-05-04', '2026-05-25', 80, 'Mina Aulia'),
      mkItem('lo-2', 'Credit scoring engine integration', 'Adira Digital Lending', 'Loan Origination', 'Workstream', '2026-05-18', '2026-06-05', 55, 'Rizky Pratama'),
      mkItem('lo-3', 'E-KYC & document capture', 'Adira Digital Lending', 'Loan Origination', 'Workstream', '2026-05-20', '2026-06-10', 40, 'Ayla Putri'),
      mkItem('lo-4', 'Pilot go-live', 'Adira Digital Lending', 'Loan Origination', 'Milestone', '2026-06-15', '2026-06-15', 0, 'Mina Aulia'),
      mkItem('lo-5', 'Nationwide rollout', 'Adira Digital Lending', 'Loan Origination', 'Phase', '2026-06-16', '2026-07-20', 10, 'Jonas Rahardian'),
    ],
  },
  {
    id: 'tl-customer360',
    name: 'Customer 360 Delivery',
    subtitle: 'Unified profile & analytics program',
    code: 'TL-CUSTOMER-360',
    scope: 'Governance',
    owner: 'Ayla Putri',
    status: 'In Review',
    progress: 89,
    taskCount: 9,
    milestoneCount: 2,
    spark: [12, 12, 13, 14, 13, 15, 16, 16],
    updatedLabel: '1 hour ago',
    workspaceOrder: ['Adira Finance WS'],
    items: [
      mkItem('c3-1', 'Data domain consolidation', 'Adira Finance WS', 'Customer 360', 'Phase', '2026-03-02', '2026-03-27', 95, 'Ayla Putri'),
      mkItem('c3-2', 'Golden record matching rules', 'Adira Finance WS', 'Customer 360', 'Workstream', '2026-03-16', '2026-04-03', 90, 'Rizky Pratama'),
      mkItem('c3-3', 'Consent & privacy controls', 'Adira Finance WS', 'Customer 360', 'Workstream', '2026-03-23', '2026-04-10', 85, 'Mina Aulia'),
      mkItem('c3-4', 'Analytics activation launch', 'Adira Finance WS', 'Customer 360', 'Milestone', '2026-04-15', '2026-04-15', 0, 'Ayla Putri'),
    ],
  },
  {
    id: 'tl-risk-datamart',
    name: 'Enterprise Risk Data Mart',
    subtitle: 'Regulatory reporting foundation',
    code: 'TL-RISK-DATAMART',
    scope: 'Risk',
    owner: 'Jonas Rahardian',
    status: 'Draft',
    progress: 18,
    taskCount: 7,
    milestoneCount: 1,
    spark: [3, 4, 4, 5, 5, 6, 6, 7],
    updatedLabel: 'Today, 08:10',
    workspaceOrder: ['Enterprise Risk Data Mart'],
    items: [
      mkItem('rd-1', 'Source system inventory', 'Enterprise Risk Data Mart', 'Risk Data Mart', 'Workstream', '2026-07-06', '2026-07-20', 30, 'Jonas Rahardian'),
      mkItem('rd-2', 'Regulatory data model draft', 'Enterprise Risk Data Mart', 'Risk Data Mart', 'Workstream', '2026-07-13', '2026-07-31', 15, 'Rizky Pratama'),
      mkItem('rd-3', 'OJK reporting schema baseline', 'Enterprise Risk Data Mart', 'Risk Data Mart', 'Milestone', '2026-08-03', '2026-08-03', 0, 'Jonas Rahardian'),
    ],
  },
]

function timelineStatusBadge(status: TimelineDocStatus): string {
  switch (status) {
    case 'Active': return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'In Review': return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'Draft': return 'border-slate-200 bg-slate-50 text-slate-500'
    default: return 'border-slate-200 bg-slate-100 text-slate-500'
  }
}

function statusAccentColor(status: TimelineDocStatus): string {
  if (status === 'Active') return '#10b981'
  if (status === 'In Review') return '#f59e0b'
  return '#94a3b8'
}

/** Progress bar / % colour — mirrors the workflow directory's success-rate tone ramp. */
function progressTone(value: number): string {
  if (value >= 70) return '#10b981'
  if (value >= 40) return '#f59e0b'
  return '#94a3b8'
}

// Deterministic per-owner color tone (avatar solid + name pill tint) — mirrors the Workflow Directory owner chips.
const OWNER_TONES = [
  { avatar: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { avatar: 'bg-pink-500', pill: 'bg-pink-50 text-pink-700 ring-pink-200' },
  { avatar: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { avatar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { avatar: 'bg-violet-500', pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { avatar: 'bg-cyan-500', pill: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
] as const

function ownerTone(name: string): (typeof OWNER_TONES)[number] {
  const seed = name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return OWNER_TONES[seed % OWNER_TONES.length]
}

function ownerInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '—'
}

/** Area sparkline — same recharts treatment as the Workflow directory Executions cell. */
function KpiSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))
  const gradId = `planning-tl-spark-${color.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} fill={`url(#${gradId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Header cell chrome — exact visual port of `EnterpriseSortableHeaderCell` (grip button, icon+label+sort, filter slot). */
function DirHead({ icon: Icon, label, withFilter }: { icon: React.ComponentType<{ className?: string }>; label: string; withFilter?: boolean }) {
  return (
    <th className="sticky top-0 z-10 select-none whitespace-nowrap border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 text-left font-semibold backdrop-blur">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-slate-100 hover:text-slate-900">
          <GripVertical className="h-4 w-4" />
        </span>
        <button type="button" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
          <span>{label}</span>
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
        {withFilter ? <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" /> : null}
      </div>
    </th>
  )
}

type DirColumnKey = 'scope' | 'owner' | 'status' | 'progress' | 'tasks' | 'updated'
const ALL_COLUMNS: DirColumnKey[] = ['scope', 'owner', 'status', 'progress', 'tasks', 'updated']
const COLUMN_LABELS: Record<DirColumnKey, string> = {
  scope: 'Scope', owner: 'Owner', status: 'Status', progress: 'Progress', tasks: 'Tasks', updated: 'Updated',
}
const COLUMN_VISIBILITY_OPTIONS = ALL_COLUMNS.map((key) => ({ key, label: COLUMN_LABELS[key] }))

type GroupKey = 'scope' | 'status' | 'owner'
const GROUP_BY_OPTIONS: Array<{ key: GroupKey; label: string }> = [
  { key: 'scope', label: 'Scope' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
]

function groupLabelFor(doc: PlanningTimelineDoc, key: GroupKey | null): string | null {
  if (!key) return null
  if (key === 'scope') return doc.scope
  if (key === 'status') return doc.status
  return doc.owner
}

/** Zoom icons/labels — matches the Project Timeline panel's `GANTT_ZOOM_OPTIONS` exactly. */
const GANTT_ZOOM_OPTIONS: Array<{ level: PlanningGanttZoomLevel; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { level: 'Day', label: 'Day', icon: CalendarDays },
  { level: 'Week', label: 'Week', icon: CalendarRange },
  { level: 'Month', label: 'Month', icon: Calendar },
  { level: 'Quarter', label: 'Quarter', icon: LayoutGrid },
]

const timelineToolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

function itemMatchesTimelineSearch(item: PlanningGanttItem, query: string): boolean {
  const haystack = [item.title, item.id, item.project, item.workspace, item.owner, item.team, item.sprint, item.type, item.workItemType, item.label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

/** Full-screen overlay hosting a single timeline's Gantt — same header/toolbar design as `ProjectTimelinePanel` ("Project Timeline"): bare icon + title, description, search, Select toggle, zoom group, work-item count. */
function TimelineGanttOverlay({ doc, onClose }: { doc: PlanningTimelineDoc; onClose: () => void }) {
  const [zoom, setZoom] = useState<PlanningGanttZoomLevel>('Week')
  const [selectedId, setSelectedId] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return doc.items
    return doc.items.filter((item) => itemMatchesTimelineSearch(item, query))
  }, [doc.items, deferredSearch])

  const schedulableCount = useMemo(
    () => filteredItems.filter((item) => item.startDate && item.endDate).length,
    [filteredItems],
  )

  const overlay = (
    <div
      className="liquid-glass-enterprise-panel fixed inset-x-0 top-12 bottom-0 z-50 flex flex-col overflow-hidden rounded-none border-0 bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={`${doc.name} timeline`}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2">
          <div className="shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <GanttChartSquare className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                <h2 className="truncate text-lg font-semibold text-foreground">{doc.name}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close timeline"
                title="Close (Esc)"
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                  timelineToolbarFocusClass,
                )}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-xl text-[11px] leading-snug text-muted-foreground">{doc.subtitle}</p>

              <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto px-1 py-1 text-xs text-muted-foreground scrollbar-hide lg:ml-auto">
                <div className="relative w-[168px] shrink-0">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => startTransition(() => setSearch(event.target.value))}
                    placeholder="Search tasks…"
                    aria-label="Search timeline tasks"
                    className={cn(
                      'h-8 w-full rounded-full border border-border bg-background/80 pl-8 pr-3 text-[11px] shadow-sm',
                      timelineToolbarFocusClass,
                    )}
                  />
                </div>
                <EnterpriseSelectionToggle checked={selectMode} onChange={setSelectMode} title="Enable multi-select on timeline rows" />
                <div
                  className="inline-flex shrink-0 items-center rounded-lg border border-border bg-background/80 p-0.5 shadow-sm"
                  role="group"
                  aria-label="Gantt zoom level"
                >
                  {GANTT_ZOOM_OPTIONS.map(({ level, label, icon: Icon }) => {
                    const active = zoom === level
                    return (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${label} view`}
                        onClick={() => setZoom(level)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition',
                          timelineToolbarFocusClass,
                          active ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {label}
                      </button>
                    )
                  })}
                </div>
                <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{schedulableCount}</span> work items
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl">
            <PlanningSvarGantt
              items={filteredItems}
              layout="project-tree"
              zoomLevel={zoom}
              selectedId={selectedId}
              onSelect={setSelectedId}
              multiSelect={selectMode}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
            />
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

/**
 * Shared state for the Timeline & Gantt directory, split so the toolbar can live in the page's
 * panel header row (next to the "Timeline & Gantt" title — same row, same as how the Workflow &
 * Automation Directory Panel places its toolbar beside its own title) while the table sits in the
 * panel body below, with NO extra nested card (avoids a card-within-a-card look).
 */
export function usePlanningTimelineDirectory(liveItems: PlanningGanttItem[], liveWorkspaceOrder: string[]) {
  const [openDoc, setOpenDoc] = useState<PlanningTimelineDoc | null>(null)
  const [groupBy, setGroupBy] = useState<GroupKey | null>(null)
  const [showSelection, setShowSelection] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hiddenColumns, setHiddenColumns] = useState<Set<DirColumnKey>>(new Set())
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const docs = useMemo<PlanningTimelineDoc[]>(() => {
    if (liveItems.length === 0) return MOCK_TIMELINE_DOCS
    const milestoneCount = liveItems.filter((i) => i.type === 'Milestone').length
    const progress = Math.round(liveItems.reduce((sum, i) => sum + (i.progress ?? 0), 0) / liveItems.length)
    const liveDoc: PlanningTimelineDoc = {
      id: 'tl-live-workitems',
      name: 'My Work Items Timeline',
      subtitle: 'Live schedule from your work management items',
      code: 'TL-LIVE-WORKITEMS',
      scope: 'Live',
      owner: 'You',
      status: 'Active',
      progress,
      taskCount: liveItems.length,
      milestoneCount,
      spark: [4, 6, 5, 8, 9, 11, 12, 14],
      updatedLabel: 'Just now',
      items: liveItems,
      workspaceOrder: liveWorkspaceOrder,
    }
    return [liveDoc, ...MOCK_TIMELINE_DOCS]
  }, [liveItems, liveWorkspaceOrder])

  const sortedDocs = useMemo(() => {
    if (!groupBy) return docs
    return [...docs].sort((a, b) => (groupLabelFor(a, groupBy) ?? '').localeCompare(groupLabelFor(b, groupBy) ?? ''))
  }, [docs, groupBy])

  const totalPages = Math.max(1, Math.ceil(sortedDocs.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const start = (pageSafe - 1) * pageSize
  const pagedDocs = sortedDocs.slice(start, start + pageSize)
  const rangeStart = sortedDocs.length === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + pageSize, sortedDocs.length)

  const visibleColumnOrder = ALL_COLUMNS.filter((key) => !hiddenColumns.has(key))
  const toggleColumn = (key: DirColumnKey) =>
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const showAllColumns = () => setHiddenColumns(new Set())

  const toggleRowSelection = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return {
    openDoc, setOpenDoc,
    groupBy, setGroupBy,
    showSelection, setShowSelection,
    selectedIds, setSelectedIds, toggleRowSelection,
    hiddenColumns, visibleColumnOrder, toggleColumn, showAllColumns,
    pageSize, setPageSize, page, setPage, pageSafe, totalPages,
    sortedDocs, pagedDocs, rangeStart, rangeEnd,
  }
}

export type PlanningTimelineDirectoryState = ReturnType<typeof usePlanningTimelineDirectory>

/** Toolbar row — rendered in the page panel's header `right` slot, beside the "Timeline & Gantt" title. */
export function PlanningTimelineDirectoryToolbar({ state }: { state: PlanningTimelineDirectoryState }) {
  const {
    groupBy, setGroupBy, showSelection, setShowSelection,
    hiddenColumns, visibleColumnOrder, toggleColumn, showAllColumns,
    rangeStart, rangeEnd, sortedDocs, pageSize, setPageSize, page: _page, setPage,
    pageSafe, totalPages,
  } = state

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 py-1 text-xs text-muted-foreground">
      <EnterpriseGroupByControl<GroupKey> options={GROUP_BY_OPTIONS} value={groupBy} onChange={setGroupBy} />
      <EnterpriseSelectionToggle checked={showSelection} onChange={setShowSelection} />
      <EnterpriseColumnVisibilityControl
        columns={COLUMN_VISIBILITY_OPTIONS}
        hidden={hiddenColumns}
        visibleCount={visibleColumnOrder.length}
        onToggle={toggleColumn}
        onShowAll={showAllColumns}
      />
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{rangeStart}</span>-<span className="font-semibold text-foreground">{rangeEnd}</span> of <span className="font-semibold text-foreground">{sortedDocs.length}</span>
      </p>
      <span className="text-xs text-muted-foreground">Rows:</span>
      <Select
        value={String(pageSize)}
        onChange={(e) => {
          setPageSize(parseInt(e.target.value, 10))
          setPage(1)
        }}
        className="h-10 w-[84px] text-sm"
      >
        <SelectItem value="5">5</SelectItem>
        <SelectItem value="10">10</SelectItem>
        <SelectItem value="15">15</SelectItem>
        <SelectItem value="25">25</SelectItem>
      </Select>
      <div className="flex h-10 items-stretch gap-0.5 rounded-lg border border-border bg-background/80 p-0.5 shadow-sm">
        <button
          type="button"
          className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={pageSafe <= 1}
        >
          Previous
        </button>
        <div className="flex items-center justify-center px-2 text-xs text-muted-foreground tabular-nums">{pageSafe} / {totalPages}</div>
        <button
          type="button"
          className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={pageSafe >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  )
}

/**
 * Table body — lists user-authored timelines in a Workflow-Directory-styled grid (owner chip,
 * accent-bordered name cell, progress bar, sparkline). Clicking a row opens that timeline's Gantt
 * as a full-screen overlay. Rendered directly inside the page's panel body (no extra card wrapper).
 */
export function PlanningTimelineDirectoryTable({ state }: { state: PlanningTimelineDirectoryState }) {
  const {
    openDoc, setOpenDoc, groupBy, showSelection, selectedIds, setSelectedIds, toggleRowSelection,
    visibleColumnOrder, pagedDocs,
  } = state

  return (
    <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl">
      <table className="w-full min-w-[1120px] border-collapse text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            {showSelection ? (
              <th className="w-10 select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 text-left font-semibold backdrop-blur">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === pagedDocs.length}
                  onChange={() =>
                    setSelectedIds(selectedIds.length === pagedDocs.length ? [] : pagedDocs.map((d) => d.id))
                  }
                  aria-label="Select all rows on this page"
                />
              </th>
            ) : null}
            <DirHead icon={CalendarRange} label="Timeline" />
            {visibleColumnOrder.includes('scope') ? <DirHead icon={Layers3} label="Scope" withFilter /> : null}
            {visibleColumnOrder.includes('owner') ? <DirHead icon={Users} label="Owner" withFilter /> : null}
            {visibleColumnOrder.includes('status') ? <DirHead icon={ShieldCheck} label="Status" withFilter /> : null}
            {visibleColumnOrder.includes('progress') ? <DirHead icon={Gauge} label="Progress" /> : null}
            {visibleColumnOrder.includes('tasks') ? <DirHead icon={Activity} label="Tasks" /> : null}
            {visibleColumnOrder.includes('updated') ? <DirHead icon={Clock3} label="Updated" /> : null}
          </tr>
        </thead>
        <tbody>
          {pagedDocs.length === 0 ? (
            <tr>
              <td colSpan={visibleColumnOrder.length + 1 + (showSelection ? 1 : 0)} className="px-4 py-10 text-center text-sm text-slate-400">
                No timelines match the current filters.
              </td>
            </tr>
          ) : (
            pagedDocs.map((doc, idx) => {
              const tone = ownerTone(doc.owner)
              const prevLabel = idx > 0 ? groupLabelFor(pagedDocs[idx - 1], groupBy) : null
              const label = groupLabelFor(doc, groupBy)
              const showGroupHeader = groupBy && label !== prevLabel
              const isSelected = showSelection && selectedIds.includes(doc.id)
              const colCount = visibleColumnOrder.length + 1 + (showSelection ? 1 : 0)
              const cellClass = cn(
                'border-b border-slate-200/60 px-3 py-3.5 align-middle transition-colors',
                isSelected ? 'bg-primary/10' : 'group-hover:bg-sky-50/40',
              )
              return (
                <Fragment key={doc.id}>
                  {showGroupHeader ? (
                    <tr>
                      <td colSpan={colCount} className="bg-slate-50/60 px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {GROUP_BY_OPTIONS.find((o) => o.key === groupBy)?.label}: {label}
                      </td>
                    </tr>
                  ) : null}
                  <tr onClick={() => setOpenDoc(doc)} className="group cursor-pointer transition-colors">
                    {showSelection ? (
                      <td className={cn(cellClass, 'w-10')} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(doc.id)}
                          onChange={() => toggleRowSelection(doc.id)}
                          aria-label={`Select ${doc.name}`}
                        />
                      </td>
                    ) : null}
                    {/* Timeline — accent is an inset box-shadow flush at the cell's left edge, full row height */}
                    <td className={cellClass} style={{ boxShadow: `inset 3px 0 0 ${statusAccentColor(doc.status)}` }}>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{doc.name}</div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500">{doc.subtitle}</div>
                        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-slate-400">{doc.code}</div>
                      </div>
                    </td>
                    {visibleColumnOrder.includes('scope') ? (
                      <td className={cn(cellClass, 'whitespace-nowrap')}>
                        <span className="text-slate-600">{doc.scope}</span>
                      </td>
                    ) : null}
                    {visibleColumnOrder.includes('owner') ? (
                      <td className={cn(cellClass, 'whitespace-nowrap')}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', tone.avatar)}>
                            {ownerInitials(doc.owner)}
                          </span>
                          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1', tone.pill)}>{doc.owner}</span>
                        </span>
                      </td>
                    ) : null}
                    {visibleColumnOrder.includes('status') ? (
                      <td className={cn(cellClass, 'whitespace-nowrap')}>
                        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', timelineStatusBadge(doc.status))}>{doc.status}</span>
                      </td>
                    ) : null}
                    {visibleColumnOrder.includes('progress') ? (
                      <td className={cn(cellClass, 'whitespace-nowrap')}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${doc.progress}%`, background: progressTone(doc.progress) }} />
                          </div>
                          <span className="w-8 tabular-nums font-semibold" style={{ color: progressTone(doc.progress) }}>{doc.progress}%</span>
                        </div>
                      </td>
                    ) : null}
                    {visibleColumnOrder.includes('tasks') ? (
                      <td className={cn(cellClass, 'whitespace-nowrap')}>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-slate-700">{doc.taskCount}</span>
                          <div className="h-6 w-16"><KpiSparkline data={doc.spark} color={statusAccentColor(doc.status)} /></div>
                        </div>
                      </td>
                    ) : null}
                    {visibleColumnOrder.includes('updated') ? (
                      <td className={cn(cellClass, 'whitespace-nowrap')}>
                        <span className="text-slate-500">{doc.updatedLabel}</span>
                      </td>
                    ) : null}
                  </tr>
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>

      {openDoc ? <TimelineGanttOverlay doc={openDoc} onClose={() => setOpenDoc(null)} /> : null}
    </div>
  )
}
