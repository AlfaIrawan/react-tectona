import { Fragment, startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Activity,
  Archive,
  ArrowRight,
  ClipboardPaste,
  Copy,
  Trash2,
  Type,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightLeft,
  ArrowRightToLine,
  ArrowUpDown,
  BarChart3,
  Briefcase,
  Bug,
  CalendarClock,
  CheckCircle2,
  CheckSquare2,
  ChevronDown,
  ClipboardList,
  CornerDownRight,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Circle,
  Clock3,
  Columns2,
  Eye,
  EyeOff,
  Filter,
  FolderKanban,
  GanttChartSquare,
  GitBranch,
  GripVertical,
  History,
  Inbox,
  Layers3,
  LayoutGrid,
  LayoutList,
  Link2,
  ListChecks,
  MoreHorizontal,
  PanelLeft,
  Pin,
  Plug,
  Plus,
  RefreshCw,
  RotateCcw,
  Ruler,
  Save,
  Search,
  ShieldCheck,
  Signal,
  Sparkles,
  Tag,
  Timer,
  Trello,
  TrendingUp,
  UnfoldHorizontal,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EnterpriseDeleteConfirmModal } from '@/components/enterprise/EnterpriseDeleteConfirmModal'
import { EnterpriseColumnWidthModal } from '@/components/enterprise/EnterpriseColumnWidthModal'
import { useToast } from '@/components/ui/toast'
import { PlatformDataLoadingState } from '@/components/loading'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem } from '@/components/ui/select'
import { EnterpriseRichTextEditor } from '@/components/enterprise/EnterpriseRichTextEditor'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { normalizeRichHtmlForStorage } from '@/lib/richHtmlEditor'
import { notifyEvent } from '@/lib/api/notificationApi'
import {
  batchPatchWorkItems,
  createWorkItemOffline as createWorkItem,
  deleteWorkItemOffline as deleteWorkItem,
  getIntegrationProfile,
  loadWorkItemsWithCache,
  mapApiWorkItemToPage,
  moveWorkItemWorkspace,
  patchWorkItemOffline as patchWorkItem,
  readCachedWorkItems,
  refreshWorkItemsCache,
  getWorkOfflineStatusSnapshot,
  WorkItemVersionConflictError,
} from '@/lib/api/workApiOffline'
import type { IntegrationProfileResponse, WorkItemApiModel } from '@/lib/api/workApi'
import { syncMondayAll, syncJiraAll } from '@/lib/api/workIntegrationApi'
import { fetchAllWorkspaceOrgWorkspaces, type WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import {
  fetchOperationalTeams,
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
} from '@/lib/api/workspaceAccessControlApi'
import { getSession } from '@/auth/authService'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { useUserWorkspaceOptions } from '@/modules/core-shell/hooks/useUserWorkspaceOptions'
import {
  DEFAULT_OPERATIONAL_TEAM_VALUE,
  mapWacOperationalTeamDto,
  operationalTeamLabelForValue,
  type OperationalTeamOption,
} from '@/lib/workspaceOperationalTeams'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
  registerServicePrimaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { usePreferencesStore } from '@/stores/preferences-store'
import { useWorkItemsRealtimeScope } from '@/lib/work/offline/useWorkItemsRealtimeScope'
import {
  WORK_SYNC_DATA_CHANGED_EVENT,
  type WorkSyncDataChangedDetail,
} from '@/lib/work/offline/workSyncEvents'
import {
  resolveWorkStatusDisplayLabel,
  useBoardColumnLabels,
  WORK_STATUS_VALUES,
} from '@/lib/work/kanbanBoardColumnLabels'
import {
  computeWorkspaceMainPanelViewportHeightPx,
  isWorkspaceNavDocked,
  measureEnterpriseNavHeightFromMainPanel,
  resolveWorkspacePanelHeightStyle,
  workspaceAsideClass,
  workspaceDockedContentInsetClass,
  workspaceMainColumnClass,
  workspaceMainPanelViewportHeightStyle,
  workspaceNavInnerClass,
  workspaceNavMenuScrollClass,
  workspaceOuterGridClass,
} from '@/lib/workspaceNavLayout'

type WorkItemType = 'Task' | 'Subtask' | 'Checklist' | 'Epic' | 'Feature' | 'Bug'
type WorkStatus = 'Backlog' | 'To Do' | 'In Progress' | 'In Review' | 'Done'
type Priority = 'Critical' | 'High' | 'Medium' | 'Low'
type DependencyState = 'Clear' | 'Blocked' | 'At Risk'
type GroupByKey = 'project' | 'assignee' | 'priority' | 'status' | 'workspace' | 'label' | 'type' | null
type SortKey =
  | 'title'
  | 'id'
  | 'type'
  | 'project'
  | 'board'
  | 'label'
  | 'workspace'
  | 'assignee'
  | 'priority'
  | 'status'
  | 'dueDate'
  | 'progress'
  | 'lastUpdated'
  | 'manual'

type DirectoryTableColumnKey =
  | 'title'
  | 'type'
  | 'project'
  | 'workspace'
  | 'board'
  | 'label'
  | 'assignee'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'progress'
  | 'dependency'

const DEFAULT_DIRECTORY_COLUMN_ORDER: DirectoryTableColumnKey[] = [
  'title',
  'type',
  'workspace',
  'project',
  'label',
  'priority',
  'status',
  'assignee',
  'progress',
  'dueDate',
  'dependency',
]

/** First column stays fixed — tree/title column cannot be rearranged. */
const DIRECTORY_PINNED_FIRST_COLUMN: DirectoryTableColumnKey = 'title'

const DIRECTORY_FIRST_COLUMN_TINT_HEADER_CLASS = 'bg-slate-50/95 dark:bg-slate-800/55'
const DIRECTORY_FIRST_COLUMN_TINT_BODY_CLASS = 'bg-slate-50/70 dark:bg-slate-800/35'

const DIRECTORY_COLUMN_WIDTH_MIN_PX = 80
const DIRECTORY_COLUMN_WIDTH_MAX_PX = 520

function clampDirectoryColumnWidthPx(px: number): number {
  return Math.max(
    DIRECTORY_COLUMN_WIDTH_MIN_PX,
    Math.min(DIRECTORY_COLUMN_WIDTH_MAX_PX, Math.round(px))
  )
}

/** `YYYY-MM-DD` in local timezone — matches HTML date input & calendar "Today". */
function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultWorkItemAddFormDates(): { startDate: string; dueDate: string } {
  const today = new Date()
  const due = new Date(today)
  due.setDate(due.getDate() + 14)
  return { startDate: localDateInputValue(today), dueDate: localDateInputValue(due) }
}

function defaultOperationalTeamLabel(options: OperationalTeamOption[]): string {
  if (options.length === 0) return ''
  return (
    operationalTeamLabelForValue(options, DEFAULT_OPERATIONAL_TEAM_VALUE)
    ?? options[0]?.label
    ?? ''
  )
}

function resolveWorkItemTeamLabel(team: string, options: OperationalTeamOption[]): string {
  const trimmed = team.trim()
  if (!trimmed) return ''
  if (options.some((entry) => entry.label === trimmed)) return trimmed
  const byCode = options.find((entry) => entry.value === trimmed)
  return byCode?.label ?? trimmed
}

function buildWorkItemTeamPickerOptions(
  options: OperationalTeamOption[],
  workItems: WorkItem[],
): string[] {
  const labels = options.map((entry) => entry.label).filter(Boolean)
  const legacy = workItems
    .map((item) => resolveWorkItemTeamLabel(item.team, options))
    .filter(Boolean)
  return Array.from(new Set([...labels, ...legacy])).sort((left, right) =>
    left.localeCompare(right, 'id-ID'),
  )
}

function directoryColumnLabel(key: DirectoryTableColumnKey): string {
  const labels: Record<DirectoryTableColumnKey, string> = {
    title: 'Task title',
    type: 'Type',
    project: 'Project',
    workspace: 'Workspace',
    board: 'Board',
    label: 'Label',
    assignee: 'Assignee',
    status: 'Status',
    priority: 'Priority',
    dueDate: 'Due date',
    progress: 'Progress',
    dependency: 'Dependency',
  }
  return labels[key]
}

const DIRECTORY_COLUMN_HEADER_ICON_CLASS = 'text-slate-500 dark:text-slate-400'

const DIRECTORY_COLUMN_HEADER_META: Record<DirectoryTableColumnKey, { icon: LucideIcon }> = {
  title: { icon: ListChecks },
  type: { icon: Layers3 },
  project: { icon: Briefcase },
  workspace: { icon: LayoutGrid },
  board: { icon: Trello },
  label: { icon: Tag },
  assignee: { icon: Users },
  status: { icon: Workflow },
  priority: { icon: Signal },
  dueDate: { icon: CalendarClock },
  progress: { icon: BarChart3 },
  dependency: { icon: Link2 },
}

function DirectoryColumnHeaderLabel({ columnKey, label }: { columnKey: DirectoryTableColumnKey; label: string }) {
  const meta = DIRECTORY_COLUMN_HEADER_META[columnKey]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', DIRECTORY_COLUMN_HEADER_ICON_CLASS)} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

function directoryColumnSortKey(key: DirectoryTableColumnKey): SortKey | null {
  if (key === 'dependency' || key === 'label') return null
  return key
}

type DirectoryRowContextMenuState = {
  x: number
  y: number
  workItem: WorkItem
  rowIndex: number
}

function DirectoryContextMenuItem({
  disabled,
  onSelect,
  children,
  className,
}: {
  disabled?: boolean
  onSelect?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <ContextMenuItem
      className={cn(disabled && 'pointer-events-none opacity-50', className)}
      onSelect={disabled ? undefined : onSelect}
    >
      {children}
    </ContextMenuItem>
  )
}

interface ChecklistEntry {
  id: string
  label: string
  done: boolean
}

interface WorkItemExternalLink {
  provider: 'monday' | 'jira' | 'asana'
  external_id: string
  external_key?: string | null
  external_url?: string | null
  link_role: string
}

interface WorkItem {
  id: string
  title: string
  type: WorkItemType
  project: string
  workspace: string
  label?: string
  /** @deprecated Legacy field from board→label rename; use `label`. */
  board?: string
  assignee: string
  owner: string
  role: string
  team: string
  reporter?: string
  labels?: string[]
  priority: Priority
  status: WorkStatus
  startDate?: string
  dueDate: string
  dependencyStatus: DependencyState
  progress: number
  estimatedHours: number
  actualHours: number
  lastUpdated: string
  epicId?: string
  featureId?: string
  parentId?: string
  description: string
  checklist: ChecklistEntry[]
  externalLinks?: WorkItemExternalLink[]
  syncOrigin?: string
  version?: number
}

/** Singular directory label (ex Monday board name). Accepts legacy `board` during rollout. */
function resolveWorkItemDirectoryLabel(item: Pick<WorkItem, 'label' | 'board'>): string {
  return item.label?.trim() || item.board?.trim() || ''
}

import {
  buildWorkspacePickerGroups,
  defaultTectonaWorkspaceName,
  LEGACY_DEMO_WORKSPACE_NAMES,
  allWorkspacePickerNames,
  type WorkspacePickerGroups,
} from '@/lib/work/workspacePickerGroups'
import { DirectoryKanbanView } from '@/modules/task-work-management/components/DirectoryKanbanView'
import { EpicStructureTreePanel, canDetachStructureItem } from '@/modules/task-work-management/components/EpicStructureTreePanel'
import { DependencyManagementPanel } from '@/modules/task-work-management/components/DependencyManagementPanel'
import { OwnershipAssignmentPanel } from '@/modules/task-work-management/components/OwnershipAssignmentPanel'
import { DIRECTORY_GANTT_GRID_COLUMNS } from '@/modules/task-work-management/components/DirectoryGanttGridCells'
import {
  PlanningSvarGantt,
  type PlanningGanttZoomLevel,
} from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import { mapTaskWorkItemsToDirectoryGantt } from '@/modules/task-work-management/utils/mapTaskWorkItemsToDirectoryGantt'
import {
  applyDirectoryFlatRowOrder,
  applyDirectorySiblingOrder,
  reorderDirectoryFlatRowIds,
  resolveDirectoryFlatListScope,
  type DirectorySiblingOrderMap,
} from '@/modules/task-work-management/utils/directorySiblingOrder'
import {
  DirectoryInlineDateCell,
  DirectoryInlineSelectCell,
  DirectoryInlineTextCell,
} from '@/modules/task-work-management/components/DirectoryListInlineCell'
import {
  buildWorkspaceMemberAssigneeOptions,
  mapWorkspaceMembersToAssigneeNames,
  mergeWorkspaceAssigneeDirectory,
  registerWorkspaceAssigneeAliases,
} from '@/modules/task-work-management/utils/tectonaAssigneeOptions'

type DirectoryInlineField =
  | 'title'
  | 'type'
  | 'project'
  | 'workspace'
  | 'priority'
  | 'status'
  | 'assignee'
  | 'label'
  | 'dueDate'

type DirectoryViewMode = 'list' | 'kanban' | 'gantt'

const DIRECTORY_VIEW_OPTIONS: Array<{
  mode: DirectoryViewMode
  label: string
  icon: LucideIcon
}> = [
  { mode: 'list', label: 'List', icon: LayoutList },
  { mode: 'kanban', label: 'Board', icon: FolderKanban },
  { mode: 'gantt', label: 'Gantt', icon: GanttChartSquare },
]

interface WorklogRecord {
  id: string
  user: string
  date: string
  taskId: string
  hours: number
  note: string
}

interface ActivityRecord {
  id: string
  timestamp: string
  actor: string
  action: string
  objectRef: string
}

interface DrawerState {
  open: boolean
  workItemId: string | null
}

interface PanelItem {
  id: 'overview' | 'directory' | 'structure' | 'dependencies' | 'workflow' | 'ownership' | 'time' | 'activity'
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
  group: 'Command Center' | 'Control Library' | 'Assurance & Traceability'
}

function normalizeWorkItemLabelInput(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function parseWorkItemLabelTokens(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((token) => normalizeWorkItemLabelInput(token))
    .filter(Boolean)
}

function mergeWorkItemLabels(existing: string[], incoming: string[]): string[] {
  const next = [...existing]
  for (const token of incoming) {
    const normalized = normalizeWorkItemLabelInput(token)
    if (!normalized) continue
    if (next.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) continue
    next.push(normalized)
  }
  return next
}

const WORK_ITEM_LABEL_TAG_PALETTE = [
  'border-rose-200/80 bg-rose-100/90 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-100',
  'border-orange-200/80 bg-orange-100/90 text-orange-900 dark:border-orange-800/50 dark:bg-orange-950/60 dark:text-orange-100',
  'border-amber-200/80 bg-amber-100/90 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/60 dark:text-amber-100',
  'border-lime-200/80 bg-lime-100/90 text-lime-900 dark:border-lime-800/50 dark:bg-lime-950/60 dark:text-lime-100',
  'border-emerald-200/80 bg-emerald-100/90 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-100',
  'border-teal-200/80 bg-teal-100/90 text-teal-900 dark:border-teal-800/50 dark:bg-teal-950/60 dark:text-teal-100',
  'border-cyan-200/80 bg-cyan-100/90 text-cyan-900 dark:border-cyan-800/50 dark:bg-cyan-950/60 dark:text-cyan-100',
  'border-sky-200/80 bg-sky-100/90 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/60 dark:text-sky-100',
  'border-blue-200/80 bg-blue-100/90 text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/60 dark:text-blue-100',
  'border-indigo-200/80 bg-indigo-100/90 text-indigo-900 dark:border-indigo-800/50 dark:bg-indigo-950/60 dark:text-indigo-100',
  'border-violet-200/80 bg-violet-100/90 text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/60 dark:text-violet-100',
  'border-fuchsia-200/80 bg-fuchsia-100/90 text-fuchsia-900 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/60 dark:text-fuchsia-100',
  'border-pink-200/80 bg-pink-100/90 text-pink-900 dark:border-pink-800/50 dark:bg-pink-950/60 dark:text-pink-100',
] as const

function hashWorkItemLabel(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function workItemLabelTagClass(label: string): string {
  const paletteIndex = hashWorkItemLabel(label.toLowerCase()) % WORK_ITEM_LABEL_TAG_PALETTE.length
  return WORK_ITEM_LABEL_TAG_PALETTE[paletteIndex]
}

function WorkItemSourceBadges({
  links,
  syncOrigin,
}: {
  links?: WorkItemExternalLink[]
  syncOrigin?: string
}) {
  const providers = new Set(links?.map((link) => link.provider) ?? [])
  if (syncOrigin === 'monday') providers.add('monday')
  if (syncOrigin === 'jira') providers.add('jira')
  if (providers.size === 0) return null

  const meta: Record<string, { label: string; className: string }> = {
    monday: {
      label: 'Monday',
      className:
        'border-violet-200/80 bg-violet-100/90 text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/60 dark:text-violet-100',
    },
    jira: {
      label: 'Jira',
      className:
        'border-blue-200/80 bg-blue-100/90 text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/60 dark:text-blue-100',
    },
    asana: {
      label: 'Asana',
      className:
        'border-orange-200/80 bg-orange-100/90 text-orange-900 dark:border-orange-800/50 dark:bg-orange-950/60 dark:text-orange-100',
    },
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {Array.from(providers).map((provider) => (
        <span
          key={provider}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            meta[provider]?.className
          )}
        >
          <Plug className="h-2.5 w-2.5" aria-hidden />
          {meta[provider]?.label ?? provider}
        </span>
      ))}
    </div>
  )
}

const MONDAY_LOGO_SRC = '/images/logo-mondays.png'
const JIRA_LOGO_SRC = '/images/logo-jira.png'

function IntegrationBrandLogo({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('object-contain', className)}
    />
  )
}

function IntegrationSyncToolbarButton({
  mondaySyncing,
  jiraSyncing,
  onSyncMonday,
  onSyncJira,
}: {
  mondaySyncing: boolean
  jiraSyncing: boolean
  onSyncMonday: () => void
  onSyncJira: () => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)
  const syncing = mondaySyncing || jiraSyncing

  const updateAnchor = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setAnchor({ left: rect.left, top: rect.bottom + 6 })
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    updateAnchor()
    const onReposition = () => updateAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => {
          if (syncing) return
          if (open) {
            setOpen(false)
            return
          }
          updateAnchor()
          setOpen(true)
        }}
        disabled={syncing}
        className={cn(
          'group relative flex items-center justify-center rounded-xl p-2.5 text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
          open && 'bg-sky-50 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(37,99,235,0.18)] hover:bg-sky-50 hover:text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
        )}
        aria-label="Sync integrations"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Sync"
      >
        <RefreshCw className={cn('h-[18px] w-[18px]', syncing && 'animate-spin')} strokeWidth={1.8} />
      </button>

      {open && anchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label="Integration sync providers"
              className="fixed z-[1200] flex flex-col items-stretch gap-1 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/60 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/95 dark:ring-slate-700/40"
              style={{ left: anchor.left, top: anchor.top }}
            >
              <button
                type="button"
                role="menuitem"
                aria-label="Sync Monday"
                title="Sync Monday"
                disabled={mondaySyncing}
                className="flex h-10 w-full min-w-10 items-center justify-center rounded-lg transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:hover:bg-slate-800/80"
                onClick={() => {
                  setOpen(false)
                  onSyncMonday()
                }}
              >
                <IntegrationBrandLogo src={MONDAY_LOGO_SRC} className="h-7 w-7" />
              </button>
              <button
                type="button"
                role="menuitem"
                aria-label="Sync Jira"
                title="Sync Jira"
                disabled={jiraSyncing}
                className="flex h-10 w-full min-w-10 items-center justify-center rounded-lg transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:hover:bg-slate-800/80"
                onClick={() => {
                  setOpen(false)
                  onSyncJira()
                }}
              >
                <IntegrationBrandLogo src={JIRA_LOGO_SRC} className="h-7 w-7" />
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

const WORK_ITEM_PERSON_AVATAR_PALETTE = [
  'bg-rose-500 text-white',
  'bg-orange-500 text-white',
  'bg-amber-500 text-white',
  'bg-lime-600 text-white',
  'bg-emerald-500 text-white',
  'bg-teal-500 text-white',
  'bg-cyan-600 text-white',
  'bg-sky-500 text-white',
  'bg-blue-600 text-white',
  'bg-indigo-500 text-white',
  'bg-violet-500 text-white',
  'bg-fuchsia-500 text-white',
  'bg-pink-500 text-white',
] as const

function workItemPersonInitials(name: string): string {
  const normalized = name.trim()
  if (!normalized || normalized === 'Unassigned') return '?'
  if (normalized === 'System') return 'SY'
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function workItemPersonAvatarClass(name: string): string {
  const normalized = name.trim()
  if (!normalized || normalized === 'Unassigned') {
    return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
  }
  if (normalized === 'System') {
    return 'bg-slate-600 text-white'
  }
  const paletteIndex = hashWorkItemLabel(normalized.toLowerCase()) % WORK_ITEM_PERSON_AVATAR_PALETTE.length
  return WORK_ITEM_PERSON_AVATAR_PALETTE[paletteIndex]
}

function WorkItemPersonAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase',
        sizeClass,
        workItemPersonAvatarClass(name)
      )}
      aria-hidden
    >
      {workItemPersonInitials(name)}
    </span>
  )
}

function WorkItemPersonSelect({
  id,
  label,
  value,
  options,
  onChange,
  containmentOpen = true,
  disabled = false,
}: {
  id: string
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  containmentOpen?: boolean
  disabled?: boolean
}) {
  const labelId = `${id}-label`
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const updateAnchor = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setAnchor({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    })
  }

  useEffect(() => {
    if (containmentOpen) return
    setOpen(false)
  }, [containmentOpen])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    updateAnchor()

    const onReposition = () => updateAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  return (
    <div className="space-y-1.5">
      <Label id={labelId} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <button
          type="button"
          ref={triggerRef}
          id={id}
          aria-labelledby={labelId}
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            'inline-flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition',
            'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          onClick={() => {
            if (disabled) return
            if (open) {
              setOpen(false)
              return
            }
            updateAnchor()
            setOpen(true)
          }}
        >
          <WorkItemPersonAvatar name={value} />
          <span className="min-w-0 flex-1 truncate text-left">{value}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>

        {open && anchor && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={panelRef}
                className="fixed z-[1200] max-h-64 overflow-auto rounded-xl border border-border bg-popover shadow-lg"
                style={{
                  left: anchor.left,
                  top: anchor.top,
                  width: anchor.width,
                }}
                role="listbox"
                aria-label={`${label} options`}
              >
                <div className="py-1 text-sm">
                  {options.map((person) => (
                    <button
                      key={person}
                      type="button"
                      role="option"
                      aria-selected={value === person}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-muted/50',
                        value === person && 'bg-muted/40'
                      )}
                      onClick={() => {
                        onChange(person)
                        setOpen(false)
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <WorkItemPersonAvatar name={person} />
                        <span className="truncate">{person}</span>
                      </span>
                      {value === person ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    </div>
  )
}


const WORK_MANAGEMENT_UNAVAILABLE_MESSAGE =
  'Work Management API is unavailable. Start python-work-management-service-fastapi (port 8432), ensure PostgreSQL is running, then try again.'

const WORKLOGS: WorklogRecord[] = []

const ACTIVITIES: ActivityRecord[] = []

const PANEL_ITEMS: PanelItem[] = [
  {
    id: 'overview',
    label: 'Execution Overview',
    description: 'Command posture for delivery health, backlog pressure, and KPI signal.',
    icon: Sparkles,
    badge: 'Command',
    group: 'Command Center',
  },
  {
    id: 'directory',
    label: 'Work Directory',
    description: 'Operational execution table with inline controls and grouping.',
    icon: LayoutList,
    badge: 'Core',
    group: 'Control Library',
  },
  {
    id: 'structure',
    label: 'Epic Structure',
    description: 'Hierarchy control from epic down to checklist traceability.',
    icon: Layers3,
    badge: 'Model',
    group: 'Control Library',
  },
  {
    id: 'dependencies',
    label: 'Dependencies',
    description: 'Blocking chain and sequencing confidence across execution flow.',
    icon: GitBranch,
    badge: 'Signal',
    group: 'Control Library',
  },
  {
    id: 'workflow',
    label: 'Workflow Status',
    description: 'State throughput and bottleneck management for delivery teams.',
    icon: Workflow,
    badge: 'Flow',
    group: 'Assurance & Traceability',
  },
  {
    id: 'ownership',
    label: 'Ownership',
    description: 'Assignment balance, overload pressure, and role-level coverage.',
    icon: Users,
    badge: 'People',
    group: 'Assurance & Traceability',
  },
  {
    id: 'time',
    label: 'Time Tracking',
    description: 'Effort variance, burn visibility, and capacity timeline posture.',
    icon: Timer,
    badge: 'Time',
    group: 'Assurance & Traceability',
  },
  {
    id: 'activity',
    label: 'Activity Log',
    description: 'Audit-ready stream for updates, escalation, and decision trace.',
    icon: History,
    badge: 'Audit',
    group: 'Assurance & Traceability',
  },
]

const PANEL_GROUPS: Array<{ group: PanelItem['group']; items: PanelItem[] }> = [
  { group: 'Command Center', items: PANEL_ITEMS.filter((item) => item.group === 'Command Center') },
  { group: 'Control Library', items: PANEL_ITEMS.filter((item) => item.group === 'Control Library') },
  { group: 'Assurance & Traceability', items: PANEL_ITEMS.filter((item) => item.group === 'Assurance & Traceability') },
]

const PRIORITY_ORDER: Record<Priority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
}

const PRIORITY_META: Record<Priority, { dot: string; chip: string }> = {
  Critical: {
    dot: 'bg-rose-500',
    chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/50 dark:text-rose-100',
  },
  High: {
    dot: 'bg-orange-500',
    chip: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/50 dark:text-orange-100',
  },
  Medium: {
    dot: 'bg-amber-500',
    chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-100',
  },
  Low: {
    dot: 'bg-slate-400',
    chip: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-100',
  },
}

const PRIORITY_OPTIONS: Priority[] = ['Critical', 'High', 'Medium', 'Low']

const DIRECTORY_PAGE_SIZE_OPTIONS = [5, 10, 15, 25] as const

function priorityChipClass(priority: Priority): string {
  return PRIORITY_META[priority].chip
}

const STATUS_ORDER: Record<WorkStatus, number> = {
  Backlog: 0,
  'To Do': 1,
  'In Progress': 2,
  'In Review': 3,
  Done: 4,
}

const STATUS_META: Record<
  WorkStatus,
  { dot: string; chip: string; icon: LucideIcon; iconClass: string }
> = {
  Backlog: {
    dot: 'bg-violet-500',
    chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-100',
    icon: Inbox,
    iconClass: 'text-violet-600',
  },
  'To Do': {
    dot: 'bg-slate-400',
    chip: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-100',
    icon: Circle,
    iconClass: 'text-slate-500',
  },
  'In Progress': {
    dot: 'bg-blue-500',
    chip: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-100',
    icon: Activity,
    iconClass: 'text-blue-600',
  },
  'In Review': {
    dot: 'bg-amber-500',
    chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-100',
    icon: Eye,
    iconClass: 'text-amber-600',
  },
  Done: {
    dot: 'bg-emerald-500',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-100',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
  },
}

const STATUS_OPTIONS: WorkStatus[] = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']

function statusChipClass(status: WorkStatus): string {
  return STATUS_META[status].chip
}

function WorkItemStatusIcon({ status, className }: { status: WorkStatus; className?: string }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return <Icon className={cn('h-4 w-4 shrink-0', meta.iconClass, className)} aria-hidden />
}

const PIE_COLORS = ['#1d4ed8', '#2563eb', '#60a5fa', '#93c5fd', '#cbd5e1']

// ──────────────────────────────────────────────────────────────────────────
// Work Execution Overview Panel — telemetry derived from live work items.
// ──────────────────────────────────────────────────────────────────────────
const OVERVIEW_TYPE_ORDER: WorkItemType[] = ['Epic', 'Feature', 'Task', 'Subtask', 'Bug', 'Checklist']
const OVERVIEW_WORKFLOW_STAGES: WorkStatus[] = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']
const OVERVIEW_AGING_COLUMNS = ['0–7d', '8–14d', '15–30d', '>30d'] as const

type DepStatus = 'Healthy' | 'Warning' | 'Blocked'
const DEP_STATUS_COLOR: Record<DepStatus, string> = {
  Healthy: '#10b981',
  Warning: '#f59e0b',
  Blocked: '#f43f5e',
}

function agingCellTone(value: number): string {
  if (value >= 10) return 'bg-rose-500/90 text-white'
  if (value >= 6) return 'bg-rose-400/80 text-white'
  if (value >= 3) return 'bg-amber-300/80 text-amber-900'
  if (value >= 1) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-400'
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseWorkItemDate(value?: string | null): Date | null {
  if (!value?.trim()) return null
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / 86_400_000)
}

function classifyOpenItemHealth(item: WorkItem, today: Date): DepStatus {
  const due = parseWorkItemDate(item.dueDate)
  const overdue = due != null && due < today
  if (item.dependencyStatus === 'Blocked' || overdue || item.priority === 'Critical') return 'Blocked'
  if (item.dependencyStatus === 'At Risk' || item.priority === 'High') return 'Warning'
  if (due != null && daysBetween(today, due) <= 7) return 'Warning'
  return 'Healthy'
}

function depStatusFromItem(item: WorkItem): DepStatus {
  if (item.dependencyStatus === 'Blocked') return 'Blocked'
  if (item.dependencyStatus === 'At Risk') return 'Warning'
  return 'Healthy'
}

function truncateOverviewLabel(value: string, max = 14): string {
  const trimmed = value.trim() || 'Untitled'
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

function buildOverviewDependencyGraph(items: WorkItem[]): {
  nodes: Array<{ id: string; label: string; x: number; y: number; col: number }>
  edges: Array<{ from: string; to: string; status: DepStatus }>
} {
  const byId = new Map(items.map((item) => [item.id, item]))
  const childrenByParent = new Map<string, WorkItem[]>()
  for (const item of items) {
    const parentId = item.parentId || item.featureId || item.epicId
    if (!parentId || !byId.has(parentId) || parentId === item.id) continue
    const siblings = childrenByParent.get(parentId) ?? []
    siblings.push(item)
    childrenByParent.set(parentId, siblings)
  }

  const roots = items
    .filter((item) => {
      const parentId = item.parentId || item.featureId || item.epicId
      return !parentId || !byId.has(parentId)
    })
    .sort((left, right) => left.title.localeCompare(right.title))
    .slice(0, 3)

  const selected = new Map<string, { item: WorkItem; col: number }>()
  for (const root of roots) {
    selected.set(root.id, { item: root, col: 0 })
    const mid = (childrenByParent.get(root.id) ?? []).slice(0, 2)
    for (const child of mid) {
      selected.set(child.id, { item: child, col: 1 })
      for (const leaf of (childrenByParent.get(child.id) ?? []).slice(0, 1)) {
        selected.set(leaf.id, { item: leaf, col: 2 })
      }
    }
  }

  const colBuckets: WorkItem[][] = [[], [], []]
  for (const entry of selected.values()) {
    colBuckets[entry.col]?.push(entry.item)
  }

  const nodes: Array<{ id: string; label: string; x: number; y: number; col: number }> = []
  const colX = [6, 133, 260]
  for (let col = 0; col < 3; col += 1) {
    const bucket = colBuckets[col] ?? []
    const gap = bucket.length <= 1 ? 0 : 100 / Math.max(1, bucket.length - 1)
    bucket.forEach((item, index) => {
      const y = bucket.length === 1 ? 63 : 14 + index * Math.min(52, gap)
      nodes.push({
        id: item.id,
        label: truncateOverviewLabel(item.title),
        x: colX[col] ?? 6,
        y,
        col,
      })
    })
  }

  const edges: Array<{ from: string; to: string; status: DepStatus }> = []
  for (const node of nodes) {
    const item = byId.get(node.id)
    if (!item) continue
    const parentId = item.parentId || item.featureId || item.epicId
    if (!parentId || !selected.has(parentId)) continue
    edges.push({ from: parentId, to: item.id, status: depStatusFromItem(item) })
  }

  return { nodes, edges }
}

function withPct(rows: Array<{ name: string; value: number }>): Array<{ name: string; value: number; pct: string }> {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1
  return rows.map((row) => ({ ...row, pct: `${Math.round((row.value / total) * 100)}%` }))
}

function buildOverviewTelemetry(items: WorkItem[], todayInput = new Date()) {
  const today = startOfLocalDay(todayInput)
  const openItems = items.filter((item) => item.status !== 'Done')

  const healthCounts = { Healthy: 0, 'At Risk': 0, Critical: 0 }
  for (const item of openItems) {
    const band = classifyOpenItemHealth(item, today)
    if (band === 'Blocked') healthCounts.Critical += 1
    else if (band === 'Warning') healthCounts['At Risk'] += 1
    else healthCounts.Healthy += 1
  }

  const workflow = OVERVIEW_WORKFLOW_STAGES.map((stage) => ({
    stage,
    count: items.filter((item) => item.status === stage).length,
  }))

  const typeCounts = new Map<string, number>()
  for (const item of items) {
    typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1)
  }
  const distribution = OVERVIEW_TYPE_ORDER.map((type) => {
    const value = typeCounts.get(type) ?? 0
    const pct = items.length === 0 ? 0 : Math.round((value / items.length) * 100)
    return { name: type, value, pct }
  })

  const deliveryTrend = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (29 - index))
    const key = localDateInputValue(day)
    let created = 0
    let completed = 0
    let closed = 0
    for (const item of items) {
      const startDate = parseWorkItemDate(item.startDate)
      const startKey = startDate ? localDateInputValue(startDate) : null
      const updated = parseWorkItemDate(item.lastUpdated)
      const updatedKey = updated ? localDateInputValue(updated) : null
      if (startKey === key) created += 1
      if (item.status === 'Done' && updatedKey === key) {
        completed += 1
        closed += 1
      }
    }
    return { day: `D${index + 1}`, created, completed, closed }
  })

  const createdPrev = deliveryTrend.slice(0, 15).reduce((sum, row) => sum + row.created, 0)
  const createdCurr = deliveryTrend.slice(15).reduce((sum, row) => sum + row.created, 0)
  const deliveryTrendDeltaPct =
    createdPrev === 0
      ? createdCurr > 0
        ? 100
        : 0
      : Math.round(((createdCurr - createdPrev) / createdPrev) * 100)

  const assigneeCounts = new Map<string, number>()
  for (const item of openItems) {
    const name = item.assignee?.trim() || 'Unassigned'
    assigneeCounts.set(name, (assigneeCounts.get(name) ?? 0) + 1)
  }
  const ownershipCapacity = 5
  const ownership = Array.from(assigneeCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      util: Math.round((count / ownershipCapacity) * 100),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)

  let onTrack = 0
  let atRisk = 0
  let overdue = 0
  for (const item of openItems) {
    const due = parseWorkItemDate(item.dueDate)
    if (!due) {
      atRisk += 1
      continue
    }
    if (due < today) overdue += 1
    else if (daysBetween(today, due) <= 7 || item.dependencyStatus !== 'Clear') atRisk += 1
    else onTrack += 1
  }
  const slaTotal = Math.max(1, onTrack + atRisk + overdue)
  const sla = [
    { label: 'On Track', value: onTrack, pct: Math.round((onTrack / slaTotal) * 100), color: '#10b981' },
    { label: 'At Risk', value: atRisk, pct: Math.round((atRisk / slaTotal) * 100), color: '#f59e0b' },
    { label: 'Overdue', value: overdue, pct: Math.round((overdue / slaTotal) * 100), color: '#f43f5e' },
  ]

  const velocity = Array.from({ length: 4 }, (_, weekIndex) => {
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() - (3 - weekIndex) * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekEnd.getDate() - 6)
    const weekEndEod = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59)
    const doneHours = items
      .filter((item) => {
        if (item.status !== 'Done') return false
        const updated = parseWorkItemDate(item.lastUpdated)
        if (!updated) return false
        return updated >= weekStart && updated <= weekEndEod
      })
      .reduce((sum, item) => sum + Math.max(0, item.estimatedHours || item.actualHours || 1), 0)
    return { sprint: `W${weekIndex + 1}`, sp: doneHours }
  })
  const velocityAvg = velocity.length
    ? Math.round(velocity.reduce((sum, row) => sum + row.sp, 0) / velocity.length)
    : 0
  const velocityBest = velocity.length ? Math.max(...velocity.map((row) => row.sp)) : 0
  const velocityPrev = velocity[2]?.sp ?? 0
  const velocityCurr = velocity[3]?.sp ?? 0
  const velocityDeltaPct =
    velocityPrev === 0 ? (velocityCurr > 0 ? 100 : 0) : Math.round(((velocityCurr - velocityPrev) / velocityPrev) * 100)

  const aging = OVERVIEW_TYPE_ORDER.map((type) => {
    const buckets: [number, number, number, number] = [0, 0, 0, 0]
    for (const item of openItems.filter((entry) => entry.type === type)) {
      const anchor = parseWorkItemDate(item.startDate) ?? parseWorkItemDate(item.lastUpdated) ?? today
      const age = Math.max(0, daysBetween(anchor, today))
      if (age <= 7) buckets[0] += 1
      else if (age <= 14) buckets[1] += 1
      else if (age <= 30) buckets[2] += 1
      else buckets[3] += 1
    }
    return { type, buckets }
  })
  const agingTotals = aging.reduce(
    (acc, row) => {
      acc.d7 += row.buckets[0]
      acc.d14 += row.buckets[1]
      acc.d30 += row.buckets[2]
      acc.over += row.buckets[3]
      return acc
    },
    { d7: 0, d14: 0, d30: 0, over: 0 }
  )
  const agingOpen = Math.max(1, openItems.length)
  const agingSummary = [
    { label: '>30 Days', value: agingTotals.over, pct: Math.round((agingTotals.over / agingOpen) * 100), tone: 'text-rose-600' },
    { label: '15–30 Days', value: agingTotals.d30, pct: Math.round((agingTotals.d30 / agingOpen) * 100), tone: 'text-amber-600' },
    {
      label: '≤14 Days',
      value: agingTotals.d7 + agingTotals.d14,
      pct: Math.round(((agingTotals.d7 + agingTotals.d14) / agingOpen) * 100),
      tone: 'text-emerald-600',
    },
  ]

  const { nodes: depNodes, edges: depEdges } = buildOverviewDependencyGraph(items)

  const insights: string[] = []
  if (overdue > 0) insights.push(`${overdue} open work item${overdue === 1 ? '' : 's'} are past due date.`)
  const unassigned = openItems.filter((item) => !item.assignee || item.assignee === 'Unassigned').length
  if (unassigned > 0) insights.push(`${unassigned} open item${unassigned === 1 ? '' : 's'} remain unassigned.`)
  const backlog = workflow.find((row) => row.stage === 'Backlog')?.count ?? 0
  const inReview = workflow.find((row) => row.stage === 'In Review')?.count ?? 0
  if (backlog > 0 && backlog >= Math.max(1, openItems.length * 0.35)) {
    insights.push(`Backlog holds ${backlog} items — consider pulling work into active flow.`)
  }
  if (inReview > 0 && inReview >= Math.max(1, openItems.length * 0.25)) {
    insights.push(`In Review has ${inReview} items and may be a bottleneck.`)
  }
  const overloaded = ownership.filter((row) => row.util > 120 || row.count >= 5)
  for (const owner of overloaded.slice(0, 2)) {
    if (owner.name === 'Unassigned') continue
    insights.push(`${owner.name} currently owns ${owner.count} open items.`)
  }
  if (healthCounts.Critical > 0) {
    insights.push(`${healthCounts.Critical} item${healthCounts.Critical === 1 ? '' : 's'} classified as critical delivery exposure.`)
  }
  if (insights.length === 0) {
    insights.push(
      items.length > 0
        ? 'No elevated delivery risks detected in the current workspace scope.'
        : 'No work items in scope yet — charts stay at zero until memberships or backlog data appear.',
    )
  }

  return {
    hasData: items.length > 0,
    healthDonut: withPct([
      { name: 'Healthy', value: healthCounts.Healthy },
      { name: 'At Risk', value: healthCounts['At Risk'] },
      { name: 'Critical', value: healthCounts.Critical },
    ]),
    workflow,
    workflowDonut: withPct(workflow.map((row) => ({ name: row.stage, value: row.count }))),
    typeDonut: withPct(distribution.map((row) => ({ name: row.name, value: row.value }))),
    deliveryTrend,
    deliveryTrendDeltaPct,
    ownership,
    sla,
    velocity,
    velocityAvg,
    velocityBest,
    velocityDeltaPct,
    aging,
    agingSummary,
    depNodes,
    depEdges,
    insights,
    backlogCount: backlog,
  }
}


// ──────────────────────────────────────────────────────────────────────────
// Intelligence Control Tower design system (mirrors Workspace Management's
// Workspace Intelligence Control Tower): Pastel/Vivid palette, glass chart
// panels with accent bar + icon chip, executive donut, and intelligence donut.
// ──────────────────────────────────────────────────────────────────────────
type OverviewPaletteMode = 'pastel' | 'vivid'

interface OverviewPalette {
  shellAccent: string
  cardBg: string
  cardBorder: string
  healthSeg: { healthy: [string, string]; risk: [string, string]; critical: [string, string] }
  typePieColors: string[]
  workflowPieColors: string[]
}

const OVERVIEW_PALETTES: Record<OverviewPaletteMode, OverviewPalette> = {
  pastel: {
    shellAccent: 'from-sky-200 via-cyan-200 to-emerald-200',
    cardBg: 'bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(248,250,252,0.90))]',
    cardBorder: 'border-slate-200/90',
    healthSeg: { healthy: ['#34d399', '#10b981'], risk: ['#fbbf24', '#f59e0b'], critical: ['#fb7185', '#f43f5e'] },
    typePieColors: ['#a78bfa', '#7dd3fc', '#60a5fa', '#86efac', '#fbbf24', '#94a3b8'],
    workflowPieColors: ['#94a3b8', '#38bdf8', '#fbbf24', '#fb7185', '#34d399'],
  },
  vivid: {
    shellAccent: 'from-cyan-400 via-blue-500 to-indigo-500',
    cardBg: 'bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95))]',
    cardBorder: 'border-slate-300/80',
    healthSeg: { healthy: ['#10b981', '#059669'], risk: ['#f59e0b', '#d97706'], critical: ['#f43f5e', '#e11d48'] },
    typePieColors: ['#6366f1', '#0ea5e9', '#2563eb', '#10b981', '#f59e0b', '#64748b'],
    workflowPieColors: ['#64748b', '#0ea5e9', '#f59e0b', '#f43f5e', '#10b981'],
  },
}

const OVERVIEW_PANEL_TONES = {
  emerald: { accent: 'from-emerald-300 via-emerald-400 to-teal-400', iconBg: 'bg-emerald-50 ring-1 ring-emerald-100', iconColor: 'text-emerald-500' },
  sky: { accent: 'from-sky-300 via-blue-400 to-indigo-400', iconBg: 'bg-sky-50 ring-1 ring-sky-100', iconColor: 'text-sky-500' },
  violet: { accent: 'from-indigo-300 via-violet-400 to-fuchsia-400', iconBg: 'bg-violet-50 ring-1 ring-violet-100', iconColor: 'text-violet-500' },
  amber: { accent: 'from-amber-300 via-orange-400 to-rose-400', iconBg: 'bg-amber-50 ring-1 ring-amber-100', iconColor: 'text-amber-500' },
  rose: { accent: 'from-rose-300 via-pink-400 to-red-400', iconBg: 'bg-rose-50 ring-1 ring-rose-100', iconColor: 'text-rose-500' },
  cyan: { accent: 'from-cyan-300 via-sky-400 to-blue-400', iconBg: 'bg-cyan-50 ring-1 ring-cyan-100', iconColor: 'text-cyan-500' },
  indigo: { accent: 'from-indigo-300 via-blue-400 to-violet-400', iconBg: 'bg-indigo-50 ring-1 ring-indigo-100', iconColor: 'text-indigo-500' },
} as const
type OverviewTone = keyof typeof OVERVIEW_PANEL_TONES

function OverviewChartPanel({
  title,
  description,
  icon: Icon,
  tone,
  palette,
  right,
  style,
  children,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  tone: OverviewTone
  palette: OverviewPalette
  right?: React.ReactNode
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const t = OVERVIEW_PANEL_TONES[tone]
  return (
    <Card
      style={style}
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)]',
        palette.cardBg,
        palette.cardBorder
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r opacity-85', t.accent)} />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
              <Icon className={cn('h-4 w-4', t.iconColor)} />
            </span>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        {right}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  )
}

/** Donut + legend rows with progress bars (mirrors Workspace IntelligenceDonut). */
function OverviewDonut({
  data,
  centerLabel,
  pieColors,
  isVivid,
  selectedSlice,
  onSliceClick,
}: {
  data: Array<{ name: string; value: number; pct: string }>
  centerLabel: string
  pieColors: string[]
  isVivid: boolean
  selectedSlice?: string | null
  onSliceClick?: (name: string) => void
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const donutIdBase = useMemo(() => centerLabel.toLowerCase().replace(/\s+/g, '-'), [centerLabel])

  return (
    <>
      <style>{`
        @keyframes tw-sheen-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tw-counter-spin { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        .tw-sheen-ring { animation: tw-sheen-spin 16s linear infinite; }
        .tw-counter-ring { animation: tw-counter-spin 30s linear infinite; }
      `}</style>
      <div className="grid items-center gap-5 lg:grid-cols-[200px,1fr]">
        <div className="relative mx-auto h-52 w-52 shrink-0">
          {isVivid && (
            <div className="pointer-events-none absolute -inset-6 rounded-full" style={{ background: 'radial-gradient(ellipse 78% 78% at 50% 50%, rgba(99,102,241,0.26) 0%, rgba(14,165,233,0.16) 42%, transparent 70%)', filter: 'blur(6px)' }} />
          )}
          <div className="pointer-events-none absolute -inset-3 rounded-full" style={{
            background: isVivid
              ? 'conic-gradient(from 220deg, rgba(99,102,241,0.52), rgba(14,165,233,0.40), rgba(245,158,11,0.36), rgba(99,102,241,0.52))'
              : 'conic-gradient(from 220deg, rgba(99,102,241,0.15), rgba(14,165,233,0.11), rgba(16,185,129,0.13), rgba(99,102,241,0.15))',
            filter: isVivid ? 'blur(5px)' : 'blur(1px)',
          }} />
          {isVivid && (
            <div className="tw-counter-ring pointer-events-none absolute -inset-2 rounded-full" style={{ background: 'conic-gradient(from 60deg, rgba(99,102,241,0.22), rgba(14,165,233,0.28), rgba(245,158,11,0.20), rgba(99,102,241,0.22))', filter: 'blur(2.5px)', opacity: 0.7 }} />
          )}
          <div className={cn('pointer-events-none absolute inset-2 rounded-full border bg-gradient-to-br from-white/95 via-slate-50/95 to-slate-100/85', isVivid ? 'border-white/75 shadow-[0_22px_52px_rgba(15,23,42,0.20)]' : 'border-white/90 shadow-[0_14px_32px_rgba(15,23,42,0.10)]')} />
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {data.map((entry, index) => {
                    const sc = pieColors[index % pieColors.length]
                    return (
                      <linearGradient key={entry.name} id={`${donutIdBase}-seg-${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={sc} stopOpacity={1} />
                        <stop offset="100%" stopColor={sc} stopOpacity={isVivid ? 0.7 : 0.8} />
                      </linearGradient>
                    )
                  })}
                </defs>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={80}
                  cornerRadius={isVivid ? 9 : 6}
                  paddingAngle={isVivid ? 3.5 : 2.5}
                  dataKey="value"
                  stroke="white"
                  strokeWidth={isVivid ? 2.5 : 1.5}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(_, index) => {
                    const name = data[index]?.name
                    if (name) onSliceClick?.(name)
                  }}
                  style={{ outline: 'none' }}
                >
                  {data.map((entry, index) => {
                    const selectedDim = selectedSlice != null && selectedSlice !== '' && entry.name !== selectedSlice
                    const dimmed = selectedDim || (activeIndex !== null && activeIndex !== index)
                    return (
                      <Cell
                        key={entry.name}
                        fill={`url(#${donutIdBase}-seg-${index})`}
                        fillOpacity={!dimmed ? 1 : isVivid ? 0.28 : 0.4}
                        style={{ cursor: onSliceClick ? 'pointer' : 'default', outline: 'none' }}
                      />
                    )
                  })}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} items`, name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="rounded-2xl border border-white/90 px-4 py-2 text-center backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.88)', boxShadow: '0 8px 22px rgba(15,23,42,0.10)' }}>
              <div className="text-3xl font-bold leading-none tracking-tight text-slate-900">{total}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{centerLabel}</div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {data.map((item, idx) => {
            const sc = pieColors[idx % pieColors.length]
            const ratio = total > 0 ? Math.max(0, Math.min(100, Math.round((item.value / total) * 100))) : 0
            const isActive = activeIndex === idx
            const rowSelected = selectedSlice === item.name
            return (
              <div
                key={item.name}
                role={onSliceClick ? 'button' : undefined}
                tabIndex={onSliceClick ? 0 : undefined}
                onClick={onSliceClick ? () => onSliceClick(item.name) : undefined}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className={cn(
                  onSliceClick ? 'cursor-pointer' : 'cursor-default',
                  'rounded-xl border px-3 py-2 transition-all duration-200',
                  isActive || rowSelected
                    ? 'border-slate-300 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]'
                    : 'border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sc }} />
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 tabular-nums">{item.value}</span>
                    <span className="w-10 text-right text-xs font-semibold" style={{ color: sc }}>{item.pct}</span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ratio}%`, background: `linear-gradient(90deg, ${sc}, ${sc}bb)`, boxShadow: isVivid ? `0 0 8px ${sc}60` : undefined }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

/** Executive donut with center index + resilience/stability pills + signal tiles. */
function OverviewExecutiveDonut({
  data,
  palette,
  selectedBand,
  onBandClick,
}: {
  data: Array<{ name: string; value: number; pct: string }>
  palette: OverviewPalette
  selectedBand?: string | null
  onBandClick?: (band: string) => void
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const healthy = data.find((d) => d.name === 'Healthy')?.value ?? 0
  const atRisk = data.find((d) => d.name === 'At Risk')?.value ?? 0
  const critical = data.find((d) => d.name === 'Critical')?.value ?? 0
  const executionIndex = total > 0 ? Math.round(((healthy * 1 + atRisk * 0.55 + critical * 0.2) / total) * 100) : 0
  const criticalPct = total > 0 ? Math.round((critical / total) * 100) : 0
  const stabilityScore = Math.max(0, Math.min(100, executionIndex + Math.round((healthy / Math.max(1, total)) * 14) - Math.round((critical / Math.max(1, total)) * 18)))
  const segOf = (name: string): [string, string] =>
    name === 'Healthy' ? palette.healthSeg.healthy : name === 'At Risk' ? palette.healthSeg.risk : palette.healthSeg.critical
  const statusTrends: Record<string, number[]> = {
    Healthy: Array.from({ length: 6 }, () => healthy),
    'At Risk': Array.from({ length: 6 }, () => atRisk),
    Critical: Array.from({ length: 6 }, () => critical),
  }

  return (
    <>
      <style>{`
        @keyframes twh-sheen-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .twh-sheen-ring { animation: twh-sheen-spin 14s linear infinite; }
      `}</style>
      <div className="grid gap-5 lg:grid-cols-[220px,1fr] lg:items-center">
        <div className="relative mx-auto h-56 w-56">
          <div className="pointer-events-none absolute -inset-4 rounded-full" style={{ background: 'radial-gradient(ellipse 90% 90% at 50% 50%, rgba(16,185,129,0.15) 0%, rgba(14,165,233,0.10) 40%, transparent 72%)' }} />
          <div className="twh-sheen-ring pointer-events-none absolute -inset-1 rounded-full" style={{
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.55) 12%, transparent 25%, transparent 50%, rgba(255,255,255,0.28) 62%, transparent 75%, transparent 100%)',
            maskImage: 'radial-gradient(circle, transparent 44%, black 52%, black 56%, transparent 62%)',
            WebkitMaskImage: 'radial-gradient(circle, transparent 44%, black 52%, black 56%, transparent 62%)',
          }} />
          <div className="pointer-events-none absolute -inset-2 rounded-full" style={{ background: 'conic-gradient(from 180deg, rgba(16,185,129,0.28), rgba(14,165,233,0.22), rgba(244,63,94,0.18), rgba(16,185,129,0.28))', filter: 'blur(2px)', opacity: 0.6 }} />
          <div className="pointer-events-none absolute inset-3 rounded-full border border-white/80 bg-gradient-to-br from-slate-50/90 via-white/95 to-slate-100/85 shadow-[0_22px_52px_rgba(15,23,42,0.14)]" />
          <div className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-200/80 bg-emerald-50/95 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
            Delivery Resilience
          </div>
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <linearGradient id="tw-health-healthy" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={palette.healthSeg.healthy[0]} /><stop offset="100%" stopColor={palette.healthSeg.healthy[1]} /></linearGradient>
                  <linearGradient id="tw-health-risk" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={palette.healthSeg.risk[0]} /><stop offset="100%" stopColor={palette.healthSeg.risk[1]} /></linearGradient>
                  <linearGradient id="tw-health-critical" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={palette.healthSeg.critical[0]} /><stop offset="100%" stopColor={palette.healthSeg.critical[1]} /></linearGradient>
                </defs>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  cornerRadius={8}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={3}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(_, index) => {
                    const name = data[index]?.name
                    if (name) onBandClick?.(name)
                  }}
                >
                  {data.map((entry, index) => {
                    const gradientId = entry.name === 'Healthy' ? 'tw-health-healthy' : entry.name === 'At Risk' ? 'tw-health-risk' : 'tw-health-critical'
                    const selectedDim = selectedBand != null && selectedBand !== '' && entry.name !== selectedBand
                    const dimmed = selectedDim || (activeIndex !== null && activeIndex !== index)
                    return <Cell key={entry.name} fill={`url(#${gradientId})`} fillOpacity={dimmed ? 0.35 : 1} style={{ cursor: onBandClick ? 'pointer' : 'default' }} />
                  })}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} items`, name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold leading-none tracking-tight text-slate-900">{total}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-500">Work Items</div>
            <div className="mt-2 rounded-full border border-slate-300 bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">Execution Index {executionIndex}</div>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200/80 bg-white/95 px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
            Stability Score {stabilityScore}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/75 to-slate-100/80 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Executive Signal</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{executionIndex >= 80 ? 'Stable Delivery' : executionIndex >= 65 ? 'Watchlist Required' : 'Immediate Intervention'}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(16,185,129,0.10)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500">Healthy Coverage</div>
              <div className="mt-1 text-sm font-semibold text-emerald-700">{total > 0 ? Math.round((healthy / total) * 100) : 0}% of backlog</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(244,63,94,0.10)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-500">Critical Exposure</div>
              <div className="mt-1 text-sm font-semibold text-rose-700">{criticalPct}% of backlog</div>
            </div>
          </div>

          <div className="space-y-1.5">
            {data.map((item, idx) => {
              const [c0, c1] = segOf(item.name)
              return (
                <div
                  key={item.name}
                  role={onBandClick ? 'button' : undefined}
                  tabIndex={onBandClick ? 0 : undefined}
                  onClick={onBandClick ? () => onBandClick(item.name) : undefined}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={cn(
                    onBandClick ? 'cursor-pointer' : '',
                    'flex items-center justify-between rounded-xl border px-3 py-2 transition-all duration-200',
                    activeIndex === idx || selectedBand === item.name
                      ? 'border-slate-300 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]'
                      : 'border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg,${c0},${c1})` }} />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      <div className="mt-1 flex items-end gap-1">
                        {(statusTrends[item.name] ?? [0, 0, 0, 0, 0, 0]).map((v, i, arr) => {
                          const max = Math.max(...arr)
                          const h = Math.round(3 + (v / Math.max(1, max)) * 11)
                          return <span key={`${item.name}-${i}`} className="inline-block w-[4px] rounded-sm" style={{ height: `${h}px`, background: `linear-gradient(180deg,${c0},${c1})`, opacity: 0.5 + (i / arr.length) * 0.5 }} />
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="w-6 text-right text-sm font-semibold text-slate-900">{item.value}</span>
                    <span className="w-11 text-right text-xs font-semibold text-slate-500">{item.pct}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

function groupLabel(item: WorkItem, groupBy: Exclude<GroupByKey, null>) {
  if (groupBy === 'project') return item.project?.trim() || '—'
  if (groupBy === 'assignee') return item.assignee
  if (groupBy === 'priority') return item.priority
  if (groupBy === 'status') return item.status
  if (groupBy === 'workspace') return item.workspace
  if (groupBy === 'label') return resolveWorkItemDirectoryLabel(item) || '—'
  return item.type
}

const DIRECTORY_GROUP_TINTS = [
  { row: 'bg-violet-50/75 dark:bg-violet-950/30', first: 'bg-violet-100/90 dark:bg-violet-900/50' },
  { row: 'bg-sky-50/75 dark:bg-sky-950/30', first: 'bg-sky-100/90 dark:bg-sky-900/50' },
  { row: 'bg-emerald-50/75 dark:bg-emerald-950/30', first: 'bg-emerald-100/90 dark:bg-emerald-900/50' },
  { row: 'bg-amber-50/75 dark:bg-amber-950/30', first: 'bg-amber-100/90 dark:bg-amber-900/50' },
  { row: 'bg-rose-50/75 dark:bg-rose-950/30', first: 'bg-rose-100/90 dark:bg-rose-900/50' },
  { row: 'bg-cyan-50/75 dark:bg-cyan-950/30', first: 'bg-cyan-100/90 dark:bg-cyan-900/50' },
  { row: 'bg-fuchsia-50/75 dark:bg-fuchsia-950/30', first: 'bg-fuchsia-100/90 dark:bg-fuchsia-900/50' },
  { row: 'bg-lime-50/75 dark:bg-lime-950/30', first: 'bg-lime-100/90 dark:bg-lime-900/50' },
  { row: 'bg-orange-50/75 dark:bg-orange-950/30', first: 'bg-orange-100/90 dark:bg-orange-900/50' },
  { row: 'bg-indigo-50/75 dark:bg-indigo-950/30', first: 'bg-indigo-100/90 dark:bg-indigo-900/50' },
] as const

function stableDirectoryGroupTintIndex(groupBy: Exclude<GroupByKey, null>, label: string): number {
  const seed = `${groupBy}:${label}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % DIRECTORY_GROUP_TINTS.length
}

function getDirectoryGroupTint(groupBy: Exclude<GroupByKey, null>, label: string) {
  return DIRECTORY_GROUP_TINTS[stableDirectoryGroupTintIndex(groupBy, label)]
}

const DIRECTORY_TREE_MAX_DEPTH = 6

const DIRECTORY_ALLOWED_CHILDREN: Record<WorkItemType, WorkItemType[]> = {
  Epic: ['Feature'],
  Feature: ['Task'],
  Task: ['Subtask', 'Checklist'],
  Subtask: ['Subtask', 'Checklist'],
  Checklist: [],
  Bug: ['Subtask', 'Checklist'],
}

const DIRECTORY_ALLOWED_PARENTS: Record<WorkItemType, WorkItemType[]> = {
  Epic: [],
  Feature: ['Epic'],
  Bug: ['Epic', 'Feature'],
  Task: ['Epic', 'Feature'],
  Subtask: ['Task', 'Subtask'],
  Checklist: ['Task', 'Subtask'],
}

const WORK_ITEM_TYPE_OPTIONS: Array<{
  type: WorkItemType
  label: string
  icon: LucideIcon
  iconClass: string
}> = [
  { type: 'Epic', label: 'Epic', icon: Layers3, iconClass: 'text-violet-600' },
  { type: 'Feature', label: 'Feature', icon: GitBranch, iconClass: 'text-sky-600' },
  { type: 'Task', label: 'Task', icon: CheckSquare2, iconClass: 'text-blue-600' },
  { type: 'Subtask', label: 'Subtask', icon: CornerDownRight, iconClass: 'text-amber-600' },
  { type: 'Checklist', label: 'Checklist', icon: ClipboardList, iconClass: 'text-emerald-600' },
  { type: 'Bug', label: 'Bug', icon: Bug, iconClass: 'text-rose-600' },
]

const WORK_ITEM_TYPE_META = Object.fromEntries(
  WORK_ITEM_TYPE_OPTIONS.map((option) => [option.type, option])
) as Record<WorkItemType, (typeof WORK_ITEM_TYPE_OPTIONS)[number]>

function WorkItemTypeIcon({ type, className }: { type: WorkItemType; className?: string }) {
  const meta = WORK_ITEM_TYPE_META[type]
  const Icon = meta.icon
  return <Icon className={cn('h-4 w-4 shrink-0', meta.iconClass, className)} aria-hidden />
}

type ReparentValidationCode =
  | 'valid'
  | 'same_item'
  | 'descendant_cycle'
  | 'max_depth'
  | 'child_cannot_reparent'
  | 'parent_cannot_have_children'
  | 'invalid_parent_child_types'

interface ReparentValidationResult {
  valid: boolean
  code: ReparentValidationCode
  message: string
}

function formatWorkItemTypes(types: WorkItemType[]): string {
  if (types.length === 0) return 'none (root level only)'
  return types.join(', ')
}

function canWorkItemBeDraggedAsChild(item: WorkItem): boolean {
  return DIRECTORY_ALLOWED_PARENTS[item.type].length > 0
}

function canWorkItemAcceptChildren(item: WorkItem): boolean {
  return DIRECTORY_ALLOWED_CHILDREN[item.type].length > 0
}

interface DirectoryTreeNode {
  item: WorkItem
  depth: number
  children: DirectoryTreeNode[]
}

interface DirectoryFlatTreeRow {
  item: WorkItem
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  groupLabel: string | null
}

type DirectoryRowDropTarget = {
  itemId: string
  side: 'before' | 'after'
}

function resolveDirectoryInsertSide(
  activeCenterY: number | null,
  overTop: number,
  overHeight: number
): 'before' | 'after' {
  if (activeCenterY === null) return 'before'
  const overMidY = overTop + overHeight / 2
  return activeCenterY > overMidY ? 'after' : 'before'
}

function DirectoryInsertIndicator() {
  return (
    <div className="pointer-events-none relative px-1 py-0.5" aria-hidden>
      <div className="h-0.5 rounded-full bg-primary/70" />
      <div className="absolute left-4 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
    </div>
  )
}

type DirectorySortableRowShellProps = {
  rowId: string
  disabled?: boolean
  className?: string
  onClick?: (event: MouseEvent<HTMLTableRowElement>) => void
  onContextMenu?: (event: MouseEvent<HTMLTableRowElement>) => void
  children: (props: {
    dragHandleProps: HTMLAttributes<HTMLButtonElement>
    isDragging: boolean
  }) => ReactNode
}

function DirectorySortableRowShell({
  rowId,
  disabled = false,
  className,
  onClick,
  onContextMenu,
  children,
}: DirectorySortableRowShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rowId,
    disabled,
  })
  const style: CSSProperties = isDragging
    ? { opacity: 0.25 }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(className, isDragging && 'relative z-10')}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children({
        dragHandleProps: {
          ...attributes,
          ...listeners,
          onClick: (event) => {
            listeners.onClick?.(event)
            event.stopPropagation()
          },
        },
        isDragging,
      })}
    </tr>
  )
}

function resolveWorkItemParentId(item: WorkItem, itemIds: Set<string>): string | null {
  if (item.parentId && itemIds.has(item.parentId)) return item.parentId
  if (item.featureId && itemIds.has(item.featureId)) return item.featureId
  if (item.epicId && itemIds.has(item.epicId)) return item.epicId
  return null
}

function buildWorkItemTree(items: WorkItem[]): DirectoryTreeNode[] {
  const itemIds = new Set(items.map((entry) => entry.id))
  const childrenByParent = new Map<string, WorkItem[]>()
  const roots: WorkItem[] = []
  const itemOrder = new Map(items.map((entry, index) => [entry.id, index]))

  for (const item of items) {
    const parentId = resolveWorkItemParentId(item, itemIds)
    if (parentId) {
      const siblings = childrenByParent.get(parentId) ?? []
      siblings.push(item)
      childrenByParent.set(parentId, siblings)
    } else {
      roots.push(item)
    }
  }

  const sortByListOrder = (left: WorkItem, right: WorkItem) =>
    (itemOrder.get(left.id) ?? 0) - (itemOrder.get(right.id) ?? 0)

  const buildNodes = (list: WorkItem[], depth: number): DirectoryTreeNode[] => {
    if (depth >= DIRECTORY_TREE_MAX_DEPTH) return []
    return [...list].sort(sortByListOrder).map((item) => {
      const childItems = childrenByParent.get(item.id) ?? []
      const children = buildNodes(childItems, depth + 1)
      return { item, depth, children }
    })
  }

  return buildNodes(roots, 0)
}

function collectExpandableWorkItemIds(nodes: DirectoryTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (list: DirectoryTreeNode[]) => {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.push(node.item.id)
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return ids
}

function flattenDirectoryTree(
  nodes: DirectoryTreeNode[],
  expandedIds: Set<string>,
  groupLabelValue: string | null
): DirectoryFlatTreeRow[] {
  const rows: DirectoryFlatTreeRow[] = []

  const walk = (list: DirectoryTreeNode[]) => {
    for (const node of list) {
      const hasChildren = node.children.length > 0
      const isExpanded = expandedIds.has(node.item.id)
      rows.push({
        item: node.item,
        depth: node.depth,
        hasChildren,
        isExpanded,
        groupLabel: groupLabelValue,
      })
      if (hasChildren && isExpanded) walk(node.children)
    }
  }

  walk(nodes)
  return rows
}

function collectDescendantIds(rootId: string, items: WorkItem[]): Set<string> {
  const itemIds = new Set(items.map((entry) => entry.id))
  const childrenByParent = new Map<string, string[]>()

  for (const item of items) {
    const parentId = resolveWorkItemParentId(item, itemIds)
    if (!parentId) continue
    const siblings = childrenByParent.get(parentId) ?? []
    siblings.push(item.id)
    childrenByParent.set(parentId, siblings)
  }

  const descendants = new Set<string>()
  const walk = (id: string) => {
    for (const childId of childrenByParent.get(id) ?? []) {
      descendants.add(childId)
      walk(childId)
    }
  }
  walk(rootId)
  return descendants
}

function computeWorkItemDepth(itemId: string, items: WorkItem[]): number {
  const itemMap = new Map(items.map((entry) => [entry.id, entry]))
  const itemIds = new Set(items.map((entry) => entry.id))
  let depth = 0
  let current = itemMap.get(itemId)

  while (current) {
    const parentId = resolveWorkItemParentId(current, itemIds)
    if (!parentId) break
    depth += 1
    current = itemMap.get(parentId)
  }

  return depth
}

function getWorkItemSubtreeHeight(itemId: string, items: WorkItem[]): number {
  const forest = buildWorkItemTree(items)

  const findNode = (nodes: DirectoryTreeNode[]): DirectoryTreeNode | null => {
    for (const node of nodes) {
      if (node.item.id === itemId) return node
      const found = findNode(node.children)
      if (found) return found
    }
    return null
  }

  const node = findNode(forest)
  if (!node) return 1

  const height = (entry: DirectoryTreeNode): number => {
    if (entry.children.length === 0) return 1
    return 1 + Math.max(...entry.children.map(height))
  }

  return height(node)
}

function validateWorkItemReparent(
  draggedId: string,
  newParentId: string,
  items: WorkItem[]
): ReparentValidationResult {
  const child = items.find((entry) => entry.id === draggedId)
  const parent = items.find((entry) => entry.id === newParentId)

  if (!child || !parent) {
    return { valid: false, code: 'same_item', message: 'Work item not found.' }
  }

  if (draggedId === newParentId) {
    return { valid: false, code: 'same_item', message: 'Cannot drop a work item onto itself.' }
  }

  if (collectDescendantIds(draggedId, items).has(newParentId)) {
    return {
      valid: false,
      code: 'descendant_cycle',
      message: 'Cannot drop a work item onto its own descendant.',
    }
  }

  if (!canWorkItemBeDraggedAsChild(child)) {
    return {
      valid: false,
      code: 'child_cannot_reparent',
      message: `${child.type} cannot be nested under another item. ${child.type} must remain at root level.`,
    }
  }

  if (!canWorkItemAcceptChildren(parent)) {
    return {
      valid: false,
      code: 'parent_cannot_have_children',
      message: `${parent.type} cannot be a parent. Checklist items are always leaf nodes.`,
    }
  }

  if (!DIRECTORY_ALLOWED_CHILDREN[parent.type].includes(child.type)) {
    return {
      valid: false,
      code: 'invalid_parent_child_types',
      message: `${child.type} cannot be a child of ${parent.type}. ${parent.type} may only contain: ${formatWorkItemTypes(DIRECTORY_ALLOWED_CHILDREN[parent.type])}.`,
    }
  }

  if (!DIRECTORY_ALLOWED_PARENTS[child.type].includes(parent.type)) {
    return {
      valid: false,
      code: 'invalid_parent_child_types',
      message: `${child.type} may only be placed under: ${formatWorkItemTypes(DIRECTORY_ALLOWED_PARENTS[child.type])}.`,
    }
  }

  const parentDepth = computeWorkItemDepth(newParentId, items)
  const subtreeHeight = getWorkItemSubtreeHeight(draggedId, items)
  if (parentDepth + subtreeHeight > DIRECTORY_TREE_MAX_DEPTH) {
    return {
      valid: false,
      code: 'max_depth',
      message: `Nesting limit reached (maximum ${DIRECTORY_TREE_MAX_DEPTH} levels).`,
    }
  }

  return { valid: true, code: 'valid', message: '' }
}

function canReparentWorkItem(draggedId: string, newParentId: string, items: WorkItem[]): boolean {
  return validateWorkItemReparent(draggedId, newParentId, items).valid
}

function reparentWorkItem(child: WorkItem, newParent: WorkItem): WorkItem {
  return {
    ...child,
    parentId: newParent.id,
    epicId: newParent.type === 'Epic' ? newParent.id : newParent.epicId ?? child.epicId,
    featureId: newParent.type === 'Feature' ? newParent.id : newParent.featureId,
    project: newParent.project,
    workspace: newParent.workspace,
    lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
}

function isValidWorkItemParentChild(parent: WorkItem, childType: WorkItemType): boolean {
  return DIRECTORY_ALLOWED_CHILDREN[parent.type].includes(childType)
}

function sortItems(items: WorkItem[], sortKey: SortKey, direction: 'asc' | 'desc') {
  if (sortKey === 'manual') return items
  return [...items].sort((left, right) => {
    let compareValue = 0

    if (sortKey === 'priority') {
      compareValue = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
    } else if (sortKey === 'status') {
      compareValue = STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
    } else if (sortKey === 'progress') {
      compareValue = left.progress - right.progress
    } else if (sortKey === 'dueDate') {
      compareValue = new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
    } else if (sortKey === 'lastUpdated') {
      compareValue = new Date(left.lastUpdated).getTime() - new Date(right.lastUpdated).getTime()
    } else {
      compareValue = String(left[sortKey]).localeCompare(String(right[sortKey]))
    }

    if (compareValue === 0) {
      compareValue = left.id.localeCompare(right.id)
    }

    return direction === 'asc' ? compareValue : -compareValue
  })
}

function workItemRowSnapshot(item: WorkItem): string {
  return JSON.stringify({
    id: item.id,
    title: item.title,
    type: item.type,
    project: item.project,
    workspace: item.workspace,
    label: resolveWorkItemDirectoryLabel(item),
    assignee: item.assignee,
    priority: item.priority,
    status: item.status,
    dueDate: item.dueDate,
    progress: item.progress,
    lastUpdated: item.lastUpdated,
    parentId: item.parentId ?? null,
    externalLinks: item.externalLinks ?? [],
  })
}

function patchWorkItemsFromSyncDelta(
  prev: WorkItem[],
  deltaItems: WorkItemApiModel[],
  deletedIds?: string[],
  fullRefresh?: boolean,
): WorkItem[] {
  const deleted = new Set(deletedIds ?? [])
  const deltaMap = new Map(
    deltaItems.map((item) => [item.id, mapApiWorkItemToPage(item) as WorkItem]),
  )

  if (fullRefresh && deltaMap.size === 0 && deleted.size === 0) {
    return prev
  }

  let changed = false
  const next: WorkItem[] = []

  for (const item of prev) {
    if (deleted.has(item.id)) {
      changed = true
      continue
    }
    const patch = deltaMap.get(item.id)
    if (!patch) {
      next.push(item)
      continue
    }
    deltaMap.delete(item.id)
    if (workItemRowSnapshot(item) === workItemRowSnapshot(patch)) {
      next.push(item)
    } else {
      next.push(patch)
      changed = true
    }
  }

  for (const patch of deltaMap.values()) {
    next.push(patch)
    changed = true
  }

  return changed ? next : prev
}

function StatusBadge({ status }: { status: WorkStatus }) {
  const boardColumnLabels = useBoardColumnLabels()
  const displayLabel = resolveWorkStatusDisplayLabel(status, boardColumnLabels)

  return (
    <Badge
      variant="outline"
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', statusChipClass(status))}
    >
      <WorkItemStatusIcon status={status} className="h-3 w-3" />
      {displayLabel}
    </Badge>
  )
}

function formatDirectoryGroupLabel(groupBy: Exclude<GroupByKey, null>, label: string, boardColumnLabels: ReturnType<typeof useBoardColumnLabels>): string {
  if (groupBy === 'status') return resolveWorkStatusDisplayLabel(label as WorkStatus, boardColumnLabels)
  return label
}

function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', priorityChipClass(priority))}
    >
      {priority}
    </Badge>
  )
}

function DependencyBadge({ status }: { status: DependencyState }) {
  const tone =
    status === 'Blocked'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : status === 'At Risk'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  return <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', tone)}>{status}</Badge>
}

function Panel({
  id,
  title,
  description,
  highlight,
  right,
  outerRef,
  style,
  className,
  scrollBody = false,
  headerIcon,
  showDivider = true,
  children,
}: {
  id: string
  title: string
  description: string
  highlight: boolean
  right?: React.ReactNode
  outerRef?: React.Ref<HTMLElement>
  style?: React.CSSProperties
  className?: string
  scrollBody?: boolean
  headerIcon?: React.ReactNode
  showDivider?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      ref={outerRef}
      style={style}
      className={cn(
        'w-full min-w-0 rounded-3xl border bg-white/90 shadow-[0_16px_50px_rgba(15,23,42,0.08)] transition-all',
        highlight ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200/80',
        scrollBody && 'flex min-h-0 flex-col overflow-hidden',
        className
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-start justify-between gap-4',
          headerIcon ? 'p-4 pb-0 lg:p-5 lg:pb-0' : 'px-5 py-4',
          showDivider && 'border-b border-slate-200/80'
        )}
      >
        <div className="min-w-0 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {headerIcon ? <span className="shrink-0 text-slate-900">{headerIcon}</span> : null}
            <h2 className={cn('min-w-0 truncate font-semibold text-slate-900', headerIcon ? 'text-lg' : 'text-sm')}>{title}</h2>
          </div>
          <p className={cn('text-slate-600', headerIcon ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs')}>{description}</p>
        </div>
        {right}
      </div>
      <div
        className={cn(
          headerIcon ? 'px-4 pb-4 pt-3 lg:px-5 lg:pb-5' : 'p-5',
          scrollBody &&
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        {children}
      </div>
    </section>
  )
}

function kpiCardChrome(cardId: string): string {
  const base =
    'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden group border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 hover:shadow-[0_18px_56px_rgba(15,23,42,0.14)]'

  if (cardId === 'total') return cn(base, 'bg-gradient-to-br from-slate-50/85 via-white/90 to-sky-50/75')
  if (cardId === 'open') return cn(base, 'bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/70')
  if (cardId === 'health') return cn(base, 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70')
  if (cardId === 'blocked') return cn(base, 'bg-gradient-to-br from-rose-50/70 via-white/90 to-amber-50/70')
  if (cardId === 'overdue') return cn(base, 'bg-gradient-to-br from-orange-50/70 via-white/90 to-yellow-50/70')
  return cn(base, 'bg-gradient-to-br from-cyan-50/70 via-white/90 to-blue-50/70')
}

function KpiSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`tectona-kpi-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#tectona-kpi-${color.replace('#', '')})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

type WorkActionToastVariant = 'default' | 'success' | 'error'

function publishWorkActionFeedback(
  addToast: (toast: { variant?: WorkActionToastVariant; title: string; description?: string }) => void,
  params: {
    variant: WorkActionToastVariant
    title: string
    description?: string
    persistToNotifications?: boolean
    action?: string
    metadata?: Record<string, unknown>
  }
) {
  addToast({ variant: params.variant, title: params.title, description: params.description })
  if (params.persistToNotifications && params.variant !== 'error') {
    notifyEvent({
      type_code: 'project',
      title: params.title,
      body: params.description ?? null,
      metadata: {
        module: 'task-work-management',
        action: params.action ?? 'work_action',
        ...params.metadata,
      },
    })
  }
}

export function TaskWorkManagementPage() {
  const { addToast } = useToast()
  const boardColumnLabels = useBoardColumnLabels()
  const session = getSession()
  const sessionRoles = session?.user.roles?.length
    ? session.user.roles
    : session?.user.role === 'root'
      ? ['tectona_root']
      : session?.user.role === 'admin'
        ? ['tectona_admin']
        : []
  const isPlatformAdmin = hasPlatformAdminAccess(sessionRoles, session?.user.role)
  const { options: userWorkspaceOptions, loading: userWorkspacesLoading } = useUserWorkspaceOptions()
  const [shellReady, setShellReady] = useState(false)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [priorityFilter, setPriorityFilter] = useState<string>('All')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All')
  const [projectFilter, setProjectFilter] = useState<string>('All')
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('All')
  useWorkItemsRealtimeScope(workspaceFilter === 'All' ? null : workspaceFilter)
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [dueFilter, setDueFilter] = useState<string>('All')
  const [dependencyFilter, setDependencyFilter] = useState<string>('All')
  const [groupBy, setGroupBy] = useState<GroupByKey>(null)
  const [directoryViewMode, setDirectoryViewMode] = useState<DirectoryViewMode>('list')
  const [directoryGanttZoomLevel, setDirectoryGanttZoomLevel] = useState<PlanningGanttZoomLevel>('Week')
  const [directoryGanttSelectedId, setDirectoryGanttSelectedId] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [directoryPageSize, setDirectoryPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showDirectorySelection, setShowDirectorySelection] = useState(false)
  const [directoryHiddenColumns, setDirectoryHiddenColumns] = useState<Set<DirectoryTableColumnKey>>(
    () => new Set<DirectoryTableColumnKey>(['label', 'dueDate', 'dependency'])
  )
  const [directoryColumnOrder, setDirectoryColumnOrder] = useState<DirectoryTableColumnKey[]>(
    () => [...DEFAULT_DIRECTORY_COLUMN_ORDER]
  )
  const [directoryColumnWidthsPx, setDirectoryColumnWidthsPx] = useState<
    Partial<Record<DirectoryTableColumnKey, number>>
  >({})
  const [freezeDirectoryFirstColumn, setFreezeDirectoryFirstColumn] = useState(false)
  const [directoryHeaderContextMenu, setDirectoryHeaderContextMenu] = useState<{
    x: number
    y: number
    columnKey: DirectoryTableColumnKey
  } | null>(null)
  const [directoryColumnWidthDialog, setDirectoryColumnWidthDialog] = useState<{
    open: boolean
    columnKey: DirectoryTableColumnKey
    valuePx: string
  } | null>(null)
  const [directoryColumnResizingKey, setDirectoryColumnResizingKey] = useState<DirectoryTableColumnKey | null>(null)
  const directoryColumnResizeRef = useRef<{
    columnKey: DirectoryTableColumnKey
    startX: number
    startWidth: number
  } | null>(null)
  const [directoryColumnsMenuOpen, setDirectoryColumnsMenuOpen] = useState(false)
  const [directoryColumnsMenuSearch, setDirectoryColumnsMenuSearch] = useState('')
  const [directoryColumnsMenuAnchor, setDirectoryColumnsMenuAnchor] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const directoryColumnsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const directoryColumnsMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const [directoryRowContextMenu, setDirectoryRowContextMenu] = useState<DirectoryRowContextMenuState | null>(null)
  const [directoryClipboardTitle, setDirectoryClipboardTitle] = useState<string | null>(null)
  const [directoryExpandedIds, setDirectoryExpandedIds] = useState<Set<string>>(() => new Set())
  const [directorySiblingOrder, setDirectorySiblingOrder] = useState<DirectorySiblingOrderMap>(() => ({}))
  const [directoryRowDragId, setDirectoryRowDragId] = useState<string | null>(null)
  const [directoryRowDragWidthPx, setDirectoryRowDragWidthPx] = useState(640)
  const [directoryRowDropTarget, setDirectoryRowDropTarget] = useState<DirectoryRowDropTarget | null>(null)
  const [directoryReparentHint, setDirectoryReparentHint] = useState<string | null>(null)
  const directoryDragJustEndedRef = useRef(false)
  const [groupByMenuOpen, setGroupByMenuOpen] = useState(false)
  const [groupByMenuSearch, setGroupByMenuSearch] = useState('')
  const [groupByMenuAnchor, setGroupByMenuAnchor] = useState<{ left: number; top: number; width: number } | null>(null)
  const [directoryPageSizeMenuOpen, setDirectoryPageSizeMenuOpen] = useState(false)
  const [directoryPageSizeMenuAnchor, setDirectoryPageSizeMenuAnchor] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, workItemId: null })
  const [dependencyAddOpenToken, setDependencyAddOpenToken] = useState(0)
  const [workItemAddOpen, setWorkItemAddOpen] = useState(false)
  const [workItemAddSaving, setWorkItemAddSaving] = useState(false)
  const [workItemFormError, setWorkItemFormError] = useState<string | null>(null)
  const [workItemFormType, setWorkItemFormType] = useState<WorkItemType>('Task')
  const [workItemFormTitle, setWorkItemFormTitle] = useState('')
  const [workItemFormDescription, setWorkItemFormDescription] = useState('')
  const [workItemFormProject, setWorkItemFormProject] = useState('')
  const [workItemFormWorkspace, setWorkItemFormWorkspace] = useState('')
  const [tectonaOrgWorkspaces, setTectonaOrgWorkspaces] = useState<WorkspaceOrgWorkspaceDto[]>([])
  const [tectonaIdentityUsers, setTectonaIdentityUsers] = useState<IdentityUserDto[]>([])
  const [operationalTeamOptions, setOperationalTeamOptions] = useState<OperationalTeamOption[]>([])
  const [operationalTeamsLoading, setOperationalTeamsLoading] = useState(true)
  const [workspaceAssigneesByName, setWorkspaceAssigneesByName] = useState<Record<string, string[]>>({})
  const [workItemFormAssignee, setWorkItemFormAssignee] = useState('Unassigned')
  const [workItemFormTeam, setWorkItemFormTeam] = useState('')
  const [workItemFormReporter, setWorkItemFormReporter] = useState('Unassigned')
  const [workItemFormLabels, setWorkItemFormLabels] = useState<string[]>([])
  const [workItemFormLabelInput, setWorkItemFormLabelInput] = useState('')
  const [workItemFormPriority, setWorkItemFormPriority] = useState<Priority>('Medium')
  const [workItemFormStatus, setWorkItemFormStatus] = useState<WorkStatus>('To Do')
  const defaultAddFormDates = defaultWorkItemAddFormDates()
  const [workItemFormStartDate, setWorkItemFormStartDate] = useState(defaultAddFormDates.startDate)
  const [workItemFormDueDate, setWorkItemFormDueDate] = useState(defaultAddFormDates.dueDate)
  const [workItemFormParentId, setWorkItemFormParentId] = useState('')
  const [workItemFormEstimatedHours, setWorkItemFormEstimatedHours] = useState('8')
  const workItemAddScrollRef = useRef<HTMLDivElement | null>(null)
  const workItemTitleInputRef = useRef<HTMLInputElement | null>(null)
  const [workItemTypeMenuOpen, setWorkItemTypeMenuOpen] = useState(false)
  const [workItemTypeMenuAnchor, setWorkItemTypeMenuAnchor] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const workItemTypeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const workItemTypeMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const [workItemPriorityMenuOpen, setWorkItemPriorityMenuOpen] = useState(false)
  const [workItemPriorityMenuAnchor, setWorkItemPriorityMenuAnchor] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const workItemPriorityTriggerRef = useRef<HTMLButtonElement | null>(null)
  const workItemPriorityMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const [workItemStatusMenuOpen, setWorkItemStatusMenuOpen] = useState(false)
  const [workItemStatusMenuAnchor, setWorkItemStatusMenuAnchor] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const workItemStatusTriggerRef = useRef<HTMLButtonElement | null>(null)
  const workItemStatusMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const [activePanel, setActivePanel] = useState<(typeof PANEL_ITEMS)[number]['id']>('overview')
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [showKpiCards, setShowKpiCards] = useState(true)
  const [showEnterpriseNavPanel, setShowEnterpriseNavPanel] = useState(true)
  const [focusBlocked, setFocusBlocked] = useState(false)
  const overviewPalette: OverviewPaletteMode = 'pastel'
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [workItemsLoading, setWorkItemsLoading] = useState(true)
  const [workItemsLoadError, setWorkItemsLoadError] = useState<string | null>(null)
  const [mondaySyncing, setMondaySyncing] = useState(false)
  const [jiraSyncing, setJiraSyncing] = useState(false)
  const [drawerEditStatus, setDrawerEditStatus] = useState<WorkStatus>('To Do')
  const [drawerEditPriority, setDrawerEditPriority] = useState<Priority>('Medium')
  const [drawerSaving, setDrawerSaving] = useState(false)
  const [drawerPatchError, setDrawerPatchError] = useState<string | null>(null)
  const [drawerIntegrationProfile, setDrawerIntegrationProfile] = useState<IntegrationProfileResponse | null>(null)
  const [bulkActionMode, setBulkActionMode] = useState<'status' | 'assignee' | null>(null)
  const [bulkStatusValue, setBulkStatusValue] = useState<WorkStatus>('In Progress')
  const [bulkAssigneeValue, setBulkAssigneeValue] = useState('Unassigned')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [confirmDeleteWorkItemOpen, setConfirmDeleteWorkItemOpen] = useState(false)
  const [confirmDeleteWorkItemTarget, setConfirmDeleteWorkItemTarget] = useState<WorkItem | null>(null)
  const [moveWorkspaceState, setMoveWorkspaceState] = useState<{ item: WorkItem; mode: 'existing' | 'new'; workspace: string } | null>(null)
  const [moveWorkspaceSaving, setMoveWorkspaceSaving] = useState(false)

  useEffect(() => {
    if (!moveWorkspaceState) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || moveWorkspaceSaving) return
      event.preventDefault()
      event.stopPropagation()
      setMoveWorkspaceState(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [moveWorkspaceState, moveWorkspaceSaving])

  const [isDeletingWorkItem, setIsDeletingWorkItem] = useState(false)
  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  // Match Document & Knowledge Management Enterprise Navigation: 260px panel, rounded-2xl typography.
  const enterpriseNavLayoutVariant = 'compact' as const
  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const activeMainPanelRef = useRef<HTMLElement | null>(null)
  const directoryPanelRef = useRef<HTMLElement | null>(null)
  const groupByTriggerRef = useRef<HTMLButtonElement | null>(null)
  const groupByMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const directoryPageSizeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const directoryPageSizeMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const taskMainFiltersRef = useRef<HTMLDivElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)
  const [mainPanelViewportHeightPx, setMainPanelViewportHeightPx] = useState<number | null>(null)
  const [directoryPanelMaxHeightPx, setDirectoryPanelMaxHeightPx] = useState<number | null>(null)
  const [directoryPanelAlignedHeightPx, setDirectoryPanelAlignedHeightPx] = useState<number | null>(null)
  const isOverviewSectionActive = activePanel === 'overview'
  const isDirectorySectionGroupActive = ['directory', 'workflow', 'ownership'].includes(activePanel)
  const isStructureSectionGroupActive = ['structure', 'dependencies', 'time', 'activity'].includes(activePanel)
  const supportsTaskSearchAndFilter = !isOverviewSectionActive
  const directoryPanelHeightStyle = resolveWorkspacePanelHeightStyle(
    activePanel === 'directory' ? mainPanelViewportHeightPx : null,
    directoryPanelAlignedHeightPx,
    directoryPanelMaxHeightPx,
    navDocked
  )
  const directoryPanelHeightLocked = directoryPanelHeightStyle != null

  useEffect(() => {
    if (!showDirectorySelection && selectedIds.length > 0) setSelectedIds([])
  }, [selectedIds.length, showDirectorySelection])

  useEffect(() => {
    if (!directoryReparentHint) return
    const timer = window.setTimeout(() => setDirectoryReparentHint(null), 5000)
    return () => window.clearTimeout(timer)
  }, [directoryReparentHint])

  const updateGroupByMenuAnchor = () => {
    const trigger = groupByTriggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setGroupByMenuAnchor({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    })
  }

  const updateDirectoryPageSizeMenuAnchor = () => {
    const trigger = directoryPageSizeTriggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setDirectoryPageSizeMenuAnchor({
      left: rect.left,
      top: rect.bottom + 8,
      width: Math.max(rect.width, 160),
    })
  }

  function updateWorkItemTypeMenuAnchor() {
    const trigger = workItemTypeTriggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setWorkItemTypeMenuAnchor({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    })
  }

  function updateWorkItemPriorityMenuAnchor() {
    const trigger = workItemPriorityTriggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setWorkItemPriorityMenuAnchor({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    })
  }

  function updateWorkItemStatusMenuAnchor() {
    const trigger = workItemStatusTriggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setWorkItemStatusMenuAnchor({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    })
  }

  useEffect(() => {
    if (!groupByMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (groupByTriggerRef.current?.contains(target)) return
      if (groupByMenuPanelRef.current?.contains(target)) return
      setGroupByMenuOpen(false)
      setGroupByMenuSearch('')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setGroupByMenuOpen(false)
      setGroupByMenuSearch('')
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [groupByMenuOpen])

  useEffect(() => {
    if (!directoryPageSizeMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (directoryPageSizeTriggerRef.current?.contains(target)) return
      if (directoryPageSizeMenuPanelRef.current?.contains(target)) return
      setDirectoryPageSizeMenuOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDirectoryPageSizeMenuOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [directoryPageSizeMenuOpen])

  useEffect(() => {
    if (!workItemTypeMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (workItemTypeTriggerRef.current?.contains(target)) return
      if (workItemTypeMenuPanelRef.current?.contains(target)) return
      setWorkItemTypeMenuOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setWorkItemTypeMenuOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [workItemTypeMenuOpen])

  useLayoutEffect(() => {
    if (!workItemTypeMenuOpen) return
    updateWorkItemTypeMenuAnchor()

    const onReposition = () => updateWorkItemTypeMenuAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [workItemTypeMenuOpen])

  useEffect(() => {
    if (!workItemPriorityMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (workItemPriorityTriggerRef.current?.contains(target)) return
      if (workItemPriorityMenuPanelRef.current?.contains(target)) return
      setWorkItemPriorityMenuOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setWorkItemPriorityMenuOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [workItemPriorityMenuOpen])

  useLayoutEffect(() => {
    if (!workItemPriorityMenuOpen) return
    updateWorkItemPriorityMenuAnchor()

    const onReposition = () => updateWorkItemPriorityMenuAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [workItemPriorityMenuOpen])

  useEffect(() => {
    if (!workItemStatusMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (workItemStatusTriggerRef.current?.contains(target)) return
      if (workItemStatusMenuPanelRef.current?.contains(target)) return
      setWorkItemStatusMenuOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setWorkItemStatusMenuOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [workItemStatusMenuOpen])

  useLayoutEffect(() => {
    if (!workItemStatusMenuOpen) return
    updateWorkItemStatusMenuAnchor()

    const onReposition = () => updateWorkItemStatusMenuAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [workItemStatusMenuOpen])

  async function reloadWorkItemsFromApi() {
    setWorkItemsLoading(true)
    setWorkItemsLoadError(null)
    try {
      const items = await refreshWorkItemsCache()
      setWorkItems(items.map((item) => mapApiWorkItemToPage(item) as WorkItem))
      setWorkItemsLoadError(null)
    } catch {
      setWorkItems([])
      setWorkItemsLoadError(WORK_MANAGEMENT_UNAVAILABLE_MESSAGE)
    } finally {
      setWorkItemsLoading(false)
    }
  }

  const applyWorkItemsFromCacheSilently = useCallback(async () => {
    try {
      const items = await readCachedWorkItems()
      startTransition(() => {
        setWorkItems(items.map((item) => mapApiWorkItemToPage(item) as WorkItem))
      })
    } catch {
      // Background merge is best-effort.
    }
  }, [])

  function applyWorkItemConflictToState(error: WorkItemVersionConflictError) {
    startTransition(() => upsertWorkItemInState(mapApiWorkItemToPage(error.current) as WorkItem))
  }

  async function handleSyncMonday() {
    if (mondaySyncing) return
    setMondaySyncing(true)
    try {
      const result = await syncMondayAll()
      const count = result.synced ?? 0
      const boards = result.boards?.length ?? 0
      await reloadWorkItemsFromApi()
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Monday sync complete',
        description: `Synced ${count} item${count === 1 ? '' : 's'} from ${boards} Monday board${boards === 1 ? '' : 's'}.`,
        persistToNotifications: true,
        action: 'monday_sync',
        metadata: { synced: count, boards },
      })
    } catch {
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Monday sync failed',
        description: 'Check the Work Integration Hub (port 8433) and the Monday API token.',
      })
    } finally {
      setMondaySyncing(false)
    }
  }

  async function handleSyncJira() {
    if (jiraSyncing) return
    setJiraSyncing(true)
    try {
      const result = await syncJiraAll()
      const count = result.synced ?? 0
      const projects = result.projects?.length ?? (result.project_key ? 1 : 0)
      await reloadWorkItemsFromApi()
      if (count > 0) {
        publishWorkActionFeedback(addToast, {
          variant: 'success',
          title: 'Jira sync complete',
          description: `Synced ${count} item${count === 1 ? '' : 's'} from ${projects} Jira project${projects === 1 ? '' : 's'}.`,
          persistToNotifications: true,
          action: 'jira_sync',
          metadata: { synced: count, projects },
        })
      } else {
        publishWorkActionFeedback(addToast, {
          variant: 'default',
          title: 'Jira sync complete',
          description: 'Pull completed with 0 items. Check WORK_INTEGRATION_JIRA_* credentials and project access.',
          persistToNotifications: true,
          action: 'jira_sync_empty',
        })
      }
    } catch {
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Jira sync failed',
        description: 'Set WORK_INTEGRATION_JIRA_BASE_URL + JIRA_API_TOKEN on Integration Hub (8433), or configure Jira webhook.',
      })
    } finally {
      setJiraSyncing(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void fetchIdentityUsers({ limit: 500, offset: 0 })
      .then((response) => {
        if (!cancelled) setTectonaIdentityUsers(response.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setTectonaIdentityUsers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setOperationalTeamsLoading(true)
    void fetchOperationalTeams(TECTONA_WAC_APP_ID)
      .then((response) => {
        if (!cancelled) {
          setOperationalTeamOptions(response.items.map(mapWacOperationalTeamDto))
        }
      })
      .catch(() => {
        if (!cancelled) setOperationalTeamOptions([])
      })
      .finally(() => {
        if (!cancelled) setOperationalTeamsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (operationalTeamOptions.length === 0) return
    setWorkItemFormTeam((current) => {
      if (!current.trim()) return defaultOperationalTeamLabel(operationalTeamOptions)
      return resolveWorkItemTeamLabel(current, operationalTeamOptions)
    })
  }, [operationalTeamOptions])

  useEffect(() => {
    if (userWorkspacesLoading) return
    let cancelled = false
    void fetchAllWorkspaceOrgWorkspaces({ status: 'active' })
      .then((rows) => {
        if (cancelled) return
        if (isPlatformAdmin) {
          setTectonaOrgWorkspaces(rows)
          return
        }
        const allowedIds = new Set(userWorkspaceOptions.map((option) => option.workspaceId))
        setTectonaOrgWorkspaces(rows.filter((row) => allowedIds.has(row.id)))
      })
      .catch(() => {
        if (!cancelled) setTectonaOrgWorkspaces([])
      })
    return () => {
      cancelled = true
    }
  }, [isPlatformAdmin, userWorkspaceOptions, userWorkspacesLoading])

  const accessibleWorkspaceKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const workspace of tectonaOrgWorkspaces) {
      const name = workspace.name?.trim()
      const key = workspace.workspace_key?.trim()
      if (name) keys.add(name)
      if (key) keys.add(key)
    }
    for (const option of userWorkspaceOptions) {
      const name = option.workspaceName?.trim()
      if (name) keys.add(name)
    }
    return keys
  }, [tectonaOrgWorkspaces, userWorkspaceOptions])

  /** Work items visible to the signed-in user (membership-scoped; platform admins see all). */
  const visibleWorkItems = useMemo(() => {
    if (isPlatformAdmin) return workItems
    if (userWorkspacesLoading) return []
    if (accessibleWorkspaceKeys.size === 0) return []
    return workItems.filter((item) => {
      const workspace = item.workspace?.trim()
      return Boolean(workspace && accessibleWorkspaceKeys.has(workspace))
    })
  }, [accessibleWorkspaceKeys, isPlatformAdmin, userWorkspacesLoading, workItems])

  const directoryDataLoading = workItemsLoading || userWorkspacesLoading

  useEffect(() => {
    if (tectonaOrgWorkspaces.length === 0) {
      setWorkspaceAssigneesByName({})
      return
    }

    let cancelled = false
    void (async () => {
      const directory: Record<string, string[]> = {}
      await Promise.all(
        tectonaOrgWorkspaces.map(async (workspace) => {
          try {
            const response = await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, workspace.id)
            const memberNames = mapWorkspaceMembersToAssigneeNames(response.items, tectonaIdentityUsers)
            registerWorkspaceAssigneeAliases(
              directory,
              workspace.name,
              workspace.workspace_key,
              memberNames.filter((name) => name !== 'Unassigned')
            )
          } catch {
            // Workspace may not have WAC membership catalog yet — skip silently.
          }
        })
      )
      if (!cancelled) setWorkspaceAssigneesByName(directory)
    })()

    return () => {
      cancelled = true
    }
  }, [tectonaIdentityUsers, tectonaOrgWorkspaces])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { items, fromCache } = await loadWorkItemsWithCache()
        if (cancelled) return
        setWorkItems(items.map((item) => mapApiWorkItemToPage(item) as WorkItem))
        setWorkItemsLoadError(items.length === 0 && fromCache ? WORK_MANAGEMENT_UNAVAILABLE_MESSAGE : null)
      } catch {
        if (!cancelled) {
          setWorkItems([])
          setWorkItemsLoadError(WORK_MANAGEMENT_UNAVAILABLE_MESSAGE)
        }
      } finally {
        if (!cancelled) setWorkItemsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onSyncDataChanged = (event: Event) => {
      const detail = (event as CustomEvent<WorkSyncDataChangedDetail>).detail
      if (!detail?.silent) return
      if (detail.items?.length) {
        startTransition(() => {
          setWorkItems((prev) =>
            patchWorkItemsFromSyncDelta(prev, detail.items!, detail.deletedIds, detail.fullRefresh),
          )
        })
        return
      }
      if (detail.fullRefresh) {
        void applyWorkItemsFromCacheSilently()
      }
    }
    window.addEventListener(WORK_SYNC_DATA_CHANGED_EVENT, onSyncDataChanged)
    return () => window.removeEventListener(WORK_SYNC_DATA_CHANGED_EVENT, onSyncDataChanged)
  }, [applyWorkItemsFromCacheSilently])

  useEffect(() => {
    const groups = buildWorkspacePickerGroups(tectonaOrgWorkspaces, visibleWorkItems)
    const fallback = defaultTectonaWorkspaceName(groups)
    if (!fallback) return
    setWorkItemFormWorkspace((current) => {
      if (current && !LEGACY_DEMO_WORKSPACE_NAMES.has(current) && allWorkspacePickerNames(groups).includes(current)) {
        return current
      }
      return fallback
    })
  }, [tectonaOrgWorkspaces, visibleWorkItems])

  useEffect(() => {
    if (!workItemAddOpen) {
      setWorkItemTypeMenuOpen(false)
      setWorkItemPriorityMenuOpen(false)
      setWorkItemStatusMenuOpen(false)
    }
  }, [workItemAddOpen])

  useLayoutEffect(() => {
    if (!groupByMenuOpen) return
    updateGroupByMenuAnchor()

    const onReposition = () => updateGroupByMenuAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [groupByMenuOpen])

  useLayoutEffect(() => {
    if (!directoryPageSizeMenuOpen) return
    updateDirectoryPageSizeMenuAnchor()

    const onReposition = () => updateDirectoryPageSizeMenuAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [directoryPageSizeMenuOpen])

  const directoryVisibleColumnOrder = useMemo(
    () => directoryColumnOrder.filter((key) => !directoryHiddenColumns.has(key)),
    [directoryColumnOrder, directoryHiddenColumns]
  )

  const directoryColumnDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const directoryRowDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDirectoryColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return
    const activeId = active.id as DirectoryTableColumnKey
    const overId = over.id as DirectoryTableColumnKey
    if (activeId === DIRECTORY_PINNED_FIRST_COLUMN) return
    setDirectoryColumnOrder((prev) => {
      const oldIndex = prev.indexOf(activeId)
      const newIndex = prev.indexOf(overId)
      if (oldIndex < 0 || newIndex < 0) return prev
      if (newIndex === 0 || overId === DIRECTORY_PINNED_FIRST_COLUMN) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      const pinnedIndex = next.indexOf(DIRECTORY_PINNED_FIRST_COLUMN)
      if (pinnedIndex !== 0) {
        const rest = next.filter((key) => key !== DIRECTORY_PINNED_FIRST_COLUMN)
        return [DIRECTORY_PINNED_FIRST_COLUMN, ...rest]
      }
      return next
    })
  }, [])

  const updateDirectoryColumnsMenuAnchor = useCallback(() => {
    const trigger = directoryColumnsTriggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setDirectoryColumnsMenuAnchor({
      left: rect.right - 260,
      top: rect.bottom + 12,
      width: 260,
    })
  }, [])

  useEffect(() => {
    if (!directoryColumnsMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (directoryColumnsTriggerRef.current?.contains(target)) return
      if (directoryColumnsMenuPanelRef.current?.contains(target)) return
      setDirectoryColumnsMenuOpen(false)
      setDirectoryColumnsMenuSearch('')
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDirectoryColumnsMenuOpen(false)
      setDirectoryColumnsMenuSearch('')
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [directoryColumnsMenuOpen])

  useLayoutEffect(() => {
    if (!directoryColumnsMenuOpen) return
    updateDirectoryColumnsMenuAnchor()
    const onReposition = () => updateDirectoryColumnsMenuAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [directoryColumnsMenuOpen, updateDirectoryColumnsMenuAnchor])

  const toggleDirectoryColumnVisibility = useCallback(
    (key: DirectoryTableColumnKey) => {
      const isHidden = directoryHiddenColumns.has(key)
      if (!isHidden) {
        const visibleCount = directoryColumnOrder.filter((col) => !directoryHiddenColumns.has(col)).length
        if (visibleCount <= 1) return
        if (groupBy === key) setGroupBy(null)
      }
      setDirectoryHiddenColumns((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    [directoryColumnOrder, directoryHiddenColumns, groupBy]
  )

  useEffect(() => {
    // First completed work-items fetch unlocks the page shell (data loader, not fake skeleton).
    if (!directoryDataLoading) setShellReady(true)
  }, [directoryDataLoading])

  useLayoutEffect(() => {
    if (!shellReady) return
    if (activePanel !== 'overview' && activePanel !== 'directory') {
      setMainPanelViewportHeightPx(null)
      return
    }

    const compute = () => {
      const el =
        activePanel === 'overview' ? activeMainPanelRef.current : directoryPanelRef.current
      if (!el) return
      setMainPanelViewportHeightPx(computeWorkspaceMainPanelViewportHeightPx(el.getBoundingClientRect().top))
    }

    compute()
    const raf = window.requestAnimationFrame(() => {
      compute()
      window.requestAnimationFrame(compute)
    })
    const t1 = window.setTimeout(compute, 80)
    const t2 = window.setTimeout(compute, 360)
    window.addEventListener('resize', compute, { passive: true })

    const ro = new ResizeObserver(compute)
    if (activeMainPanelRef.current) ro.observe(activeMainPanelRef.current)
    if (directoryPanelRef.current) ro.observe(directoryPanelRef.current)
    if (navPanelRef.current) ro.observe(navPanelRef.current)
    if (taskMainFiltersRef.current) ro.observe(taskMainFiltersRef.current)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [
    activePanel,
    shellReady,
    isWorkspaceCollapsed,
    showFiltersPanel,
    showKpiCards,
    sidebarFixed,
    showEnterpriseNavPanel,
  ])

  useLayoutEffect(() => {
    if (!shellReady) return
    if (navDocked || !showEnterpriseNavPanel) {
      setNavPanelHeightPx(null)
      return
    }

    const compute = () => {
      const navEl = navPanelRef.current
      if (!navEl) return

      const mainPanelEl =
        activePanel === 'overview'
          ? activeMainPanelRef.current
          : activePanel === 'directory'
            ? directoryPanelRef.current
            : null
      const viewportCap = computeWorkspaceMainPanelViewportHeightPx(navEl.getBoundingClientRect().top)

      if (mainPanelEl) {
        const aligned = measureEnterpriseNavHeightFromMainPanel(navEl, mainPanelEl)
        setNavPanelHeightPx(Math.min(aligned, viewportCap))
        return
      }

      setNavPanelHeightPx(viewportCap)
    }

    compute()
    const raf = window.requestAnimationFrame(() => {
      compute()
      window.requestAnimationFrame(compute)
    })
    const t1 = window.setTimeout(compute, 80)
    const t2 = window.setTimeout(compute, 360)
    window.addEventListener('resize', compute, { passive: true })

    const ro = new ResizeObserver(compute)
    if (navPanelRef.current) ro.observe(navPanelRef.current)
    if (activeMainPanelRef.current) ro.observe(activeMainPanelRef.current)
    if (directoryPanelRef.current) ro.observe(directoryPanelRef.current)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [
    activePanel,
    shellReady,
    isWorkspaceCollapsed,
    mainPanelViewportHeightPx,
    navDocked,
    showFiltersPanel,
    showKpiCards,
    showEnterpriseNavPanel,
    sidebarFixed,
    visibleWorkItems.length,
  ])

  useLayoutEffect(() => {
    if (navDocked || activePanel !== 'directory' || !navPanelHeightPx) {
      setDirectoryPanelMaxHeightPx(null)
      return
    }

    const gapBelowFiltersPx = showFiltersPanel && supportsTaskSearchAndFilter ? 16 : 0

    const measure = () => {
      const filterEl = taskMainFiltersRef.current
      const filterH =
        showFiltersPanel && supportsTaskSearchAndFilter && filterEl
          ? filterEl.getBoundingClientRect().height
          : 0
      setDirectoryPanelMaxHeightPx(Math.max(220, navPanelHeightPx - filterH - gapBelowFiltersPx))
    }

    measure()
    const ro = new ResizeObserver(() => measure())
    if (taskMainFiltersRef.current) ro.observe(taskMainFiltersRef.current)
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [navDocked, activePanel, navPanelHeightPx, showFiltersPanel, supportsTaskSearchAndFilter])

  useLayoutEffect(() => {
    if (activePanel !== 'directory') {
      setDirectoryPanelAlignedHeightPx(null)
      return
    }

    const measure = () => {
      const navEl = navPanelRef.current
      const panelEl = directoryPanelRef.current
      if (!navEl || !panelEl) return
      const navBottom = navEl.getBoundingClientRect().bottom
      const panelTop = panelEl.getBoundingClientRect().top
      setDirectoryPanelAlignedHeightPx(Math.max(220, Math.floor(navBottom - panelTop)))
    }

    measure()
    const rafA = window.requestAnimationFrame(measure)
    const rafB = window.requestAnimationFrame(measure)
    const ro = new ResizeObserver(() => measure())
    if (navPanelRef.current) ro.observe(navPanelRef.current)
    if (directoryPanelRef.current) ro.observe(directoryPanelRef.current)
    if (taskMainFiltersRef.current) ro.observe(taskMainFiltersRef.current)
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      window.cancelAnimationFrame(rafA)
      window.cancelAnimationFrame(rafB)
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [activePanel, navDocked, showFiltersPanel, showKpiCards, isWorkspaceCollapsed, showEnterpriseNavPanel])

  const workspacePickerGroups = useMemo(
    () => buildWorkspacePickerGroups(tectonaOrgWorkspaces, visibleWorkItems),
    [tectonaOrgWorkspaces, visibleWorkItems]
  )

  const confirmDeleteWorkItemImpact = useMemo(() => {
    if (!confirmDeleteWorkItemTarget) return null
    const descendantIds = collectDescendantIds(confirmDeleteWorkItemTarget.id, workItems)
    const subitemCount = descendantIds.size
    const removedIds = new Set([confirmDeleteWorkItemTarget.id, ...descendantIds])
    const hasMondayLinked = workItems.some(
      (entry) =>
        removedIds.has(entry.id) &&
        (entry.syncOrigin === 'monday' ||
          (entry.externalLinks ?? []).some((link) => link.provider === 'monday' && link.external_id))
    )
    return { subitemCount, removedIds, hasMondayLinked }
  }, [confirmDeleteWorkItemTarget, workItems])

  const filterOptions = useMemo(() => {
    const workItemAssignees = visibleWorkItems.map((item) => item.assignee).filter(Boolean)
    const assignees = mergeWorkspaceAssigneeDirectory(workspaceAssigneesByName, workItemAssignees)
    const reporters = Array.from(
      new Set([
        ...visibleWorkItems.map((item) => item.reporter ?? item.owner),
        ...assignees,
        'Unassigned',
        'System',
      ])
    )
    const teams = buildWorkItemTeamPickerOptions(operationalTeamOptions, visibleWorkItems)

    return {
      assignees,
      reporters,
      teams,
      projects: Array.from(new Set(visibleWorkItems.map((item) => item.project))),
      workspaces: allWorkspacePickerNames(workspacePickerGroups),
    }
  }, [workspaceAssigneesByName, visibleWorkItems, workspacePickerGroups, operationalTeamOptions])

  const resolveWorkspaceAssigneeOptions = useCallback(
    (workspaceName: string, currentAssignee?: string | null) =>
      buildWorkspaceMemberAssigneeOptions(
        workspaceAssigneesByName[workspaceName.trim()] ?? [],
        currentAssignee
      ),
    [workspaceAssigneesByName]
  )

  const directoryMoveTargets = useMemo(() => {
    const labels = visibleWorkItems
      .map((item) => resolveWorkItemDirectoryLabel(item))
      .filter((label): label is string => Boolean(label))
    return {
      workspaces: allWorkspacePickerNames(workspacePickerGroups),
      labels: Array.from(new Set(labels)).sort(),
    }
  }, [visibleWorkItems, workspacePickerGroups])

  const workItemParentOptions = useMemo(() => {
    const allowedParentTypes = DIRECTORY_ALLOWED_PARENTS[workItemFormType]
    return visibleWorkItems.filter((item) => allowedParentTypes.includes(item.type))
  }, [workItemFormType, visibleWorkItems])

  useEffect(() => {
    if (!workItemFormParentId) return
    const parent = visibleWorkItems.find((item) => item.id === workItemFormParentId)
    if (!parent || !isValidWorkItemParentChild(parent, workItemFormType)) {
      setWorkItemFormParentId('')
    }
  }, [workItemFormParentId, workItemFormType, visibleWorkItems])

  useEffect(() => {
    if (userWorkspacesLoading || workspaceFilter === 'All') return
    if (!filterOptions.workspaces.includes(workspaceFilter)) {
      setWorkspaceFilter('All')
    }
  }, [filterOptions.workspaces, userWorkspacesLoading, workspaceFilter])

  const filteredItems = useMemo(() => {
    const today = startOfLocalDay(new Date())
    return visibleWorkItems.filter((item) => {
      const matchesSearch =
        deferredSearch.length === 0 ||
        [item.title, item.id, item.project, item.workspace, item.assignee, item.type]
          .join(' ')
          .toLowerCase()
          .includes(deferredSearch.toLowerCase())

      const matchesStatus = statusFilter === 'All' || item.status === statusFilter
      const matchesPriority = priorityFilter === 'All' || item.priority === priorityFilter
      const matchesAssignee = assigneeFilter === 'All' || item.assignee === assigneeFilter
      const matchesProject = projectFilter === 'All' || item.project === projectFilter
      const matchesWorkspace = workspaceFilter === 'All' || item.workspace === workspaceFilter
      const matchesType = typeFilter === 'All' || item.type === typeFilter
      const matchesDependency = dependencyFilter === 'All' || item.dependencyStatus === dependencyFilter

      const dueDate = parseWorkItemDate(item.dueDate)
      const weekEnd = new Date(today)
      weekEnd.setDate(today.getDate() + 7)
      weekEnd.setHours(23, 59, 59, 999)
      const matchesDue =
        dueFilter === 'All' ||
        (dueFilter === 'Overdue' && dueDate != null && dueDate < today && item.status !== 'Done') ||
        (dueFilter === 'This Week' && dueDate != null && dueDate >= today && dueDate <= weekEnd) ||
        (dueFilter === 'No Date' && dueDate == null)

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAssignee &&
        matchesProject &&
        matchesWorkspace &&
        matchesType &&
        matchesDependency &&
        matchesDue
      )
    })
  }, [
    assigneeFilter,
    deferredSearch,
    dependencyFilter,
    dueFilter,
    priorityFilter,
    projectFilter,
    statusFilter,
    typeFilter,
    visibleWorkItems,
    workspaceFilter,
  ])

  const sortedItems = useMemo(() => {
    const columnSorted = sortItems(filteredItems, sortKey, sortDirection)
    if (sortKey !== 'manual' && Object.keys(directorySiblingOrder).length === 0) {
      return columnSorted
    }
    if (groupBy) {
      const grouped = columnSorted.reduce<Record<string, WorkItem[]>>((groups, item) => {
        const label = groupLabel(item, groupBy)
        ;(groups[label] ??= []).push(item)
        return groups
      }, {})
      if (sortKey === 'manual') {
        return Object.entries(grouped).flatMap(([, itemsInGroup]) => itemsInGroup)
      }
      return Object.entries(grouped).flatMap(([label, itemsInGroup]) =>
        applyDirectorySiblingOrder(itemsInGroup, directorySiblingOrder, label)
      )
    }
    if (sortKey === 'manual') {
      return columnSorted
    }
    return columnSorted
  }, [directorySiblingOrder, filteredItems, groupBy, sortDirection, sortKey])

  const directoryTreeForest = useMemo(() => buildWorkItemTree(sortedItems), [sortedItems])

  useEffect(() => {
    setDirectoryExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of collectExpandableWorkItemIds(directoryTreeForest)) {
        next.add(id)
      }
      return next
    })
  }, [directoryTreeForest])

  const directoryFlatTreeRows = useMemo(() => {
    if (!groupBy) {
      const rows = flattenDirectoryTree(directoryTreeForest, directoryExpandedIds, null)
      return sortKey === 'manual'
        ? applyDirectoryFlatRowOrder(rows, directorySiblingOrder, null)
        : rows
    }

    const groupedRoots = directoryTreeForest.reduce<Record<string, DirectoryTreeNode[]>>((groups, node) => {
      const label = groupLabel(node.item, groupBy)
      ;(groups[label] ??= []).push(node)
      return groups
    }, {})

    return Object.entries(groupedRoots).flatMap(([label, forest]) => {
      const rows = flattenDirectoryTree(forest, directoryExpandedIds, label)
      return sortKey === 'manual'
        ? applyDirectoryFlatRowOrder(rows, directorySiblingOrder, label)
        : rows
    })
  }, [directoryExpandedIds, directorySiblingOrder, directoryTreeForest, groupBy, sortKey])

  const directoryTotalPages = Math.max(1, Math.ceil(directoryFlatTreeRows.length / directoryPageSize))
  const directoryPageSafe = Math.min(page, directoryTotalPages)
  const directoryTableStart =
    directoryFlatTreeRows.length === 0 ? 0 : (directoryPageSafe - 1) * directoryPageSize + 1
  const directoryTableEnd = Math.min(directoryFlatTreeRows.length, directoryPageSafe * directoryPageSize)
  const directoryTableRows = useMemo(() => {
    if (directoryFlatTreeRows.length <= 100) return directoryFlatTreeRows
    const start = (directoryPageSafe - 1) * directoryPageSize
    return directoryFlatTreeRows.slice(start, start + directoryPageSize)
  }, [directoryFlatTreeRows, directoryPageSafe, directoryPageSize])

  const directoryRowSortableIds = useMemo(
    () => directoryTableRows.map((row) => row.item.id),
    [directoryTableRows]
  )

  const directoryRowCollisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const activeId = String(args.active.id)

      if (directoryRowSortableIds.includes(activeId)) {
        const rowContainers = args.droppableContainers.filter((container) =>
          directoryRowSortableIds.includes(String(container.id))
        )
        const pointerHits = pointerWithin({ ...args, droppableContainers: rowContainers })
        if (pointerHits.length > 0) return pointerHits
        return closestCenter({ ...args, droppableContainers: rowContainers })
      }

      const columnIds = directoryVisibleColumnOrder.map(String)
      if (columnIds.includes(activeId)) {
        const columnContainers = args.droppableContainers.filter((container) =>
          columnIds.includes(String(container.id))
        )
        return closestCenter({ ...args, droppableContainers: columnContainers })
      }

      return closestCenter(args)
    },
    [directoryRowSortableIds, directoryVisibleColumnOrder]
  )

  const handleDirectoryRowDragStart = useCallback((event: DragStartEvent) => {
    setDirectoryRowDragId(String(event.active.id))
    setDirectoryRowDropTarget(null)
    setDirectoryReparentHint(null)
    const measuredWidth = event.active.rect.current.initial?.width
    setDirectoryRowDragWidthPx(measuredWidth && measuredWidth > 0 ? measuredWidth : 640)
  }, [])

  const handleDirectoryRowDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) {
        setDirectoryRowDropTarget(null)
        return
      }

      const activeId = String(active.id)
      const overId = String(over.id)
      const activeRow = directoryFlatTreeRows.find((row) => row.item.id === activeId)
      const overRow = directoryFlatTreeRows.find((row) => row.item.id === overId)
      if (!activeRow || !overRow) {
        setDirectoryRowDropTarget(null)
        return
      }

      if (activeRow.groupLabel !== overRow.groupLabel) {
        setDirectoryRowDropTarget(null)
        setDirectoryReparentHint('Drag within the same group to reorder rows.')
        return
      }

      setDirectoryReparentHint(null)

      const activeTranslated = active.rect.current.translated
      const activeCenterY =
        activeTranslated !== null ? activeTranslated.top + activeTranslated.height / 2 : null
      const side = resolveDirectoryInsertSide(activeCenterY, over.rect.top, over.rect.height)

      setDirectoryRowDropTarget({ itemId: overId, side })

      const flatRows = directoryFlatTreeRows.filter((row) => row.groupLabel === activeRow.groupLabel)
      const flatIds = flatRows.map((row) => row.item.id)
      const flatScope = resolveDirectoryFlatListScope(activeRow.groupLabel)
      const nextIds = reorderDirectoryFlatRowIds(flatIds, activeId, overId, side)
      if (!nextIds) return

      setDirectorySiblingOrder((previous) => {
        const current = previous[flatScope]
        if (current?.length === nextIds.length && current.every((id, index) => id === nextIds[index])) {
          return previous
        }
        const next = { ...previous, [flatScope]: nextIds }
        return next
      })
      setSortKey('manual')
      setSortDirection('asc')
    },
    [directoryFlatTreeRows]
  )

  const handleDirectoryRowDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const dropTarget = directoryRowDropTarget
      setDirectoryRowDragId(null)
      setDirectoryRowDragWidthPx(640)
      setDirectoryRowDropTarget(null)
      directoryDragJustEndedRef.current = true
      window.setTimeout(() => {
        directoryDragJustEndedRef.current = false
      }, 0)

      if (!over) return

      const activeRow = directoryFlatTreeRows.find((row) => row.item.id === active.id)
      const overRow = directoryFlatTreeRows.find((row) => row.item.id === over.id)
      if (!activeRow || !overRow) return

      if (activeRow.groupLabel !== overRow.groupLabel) {
        setDirectoryReparentHint('Drag within the same group to reorder rows.')
        return
      }

      const flatRows = directoryFlatTreeRows.filter((row) => row.groupLabel === activeRow.groupLabel)
      const flatIds = flatRows.map((row) => row.item.id)
      const flatScope = resolveDirectoryFlatListScope(activeRow.groupLabel)
      const activeId = String(active.id)
      const overId = String(over.id)

      const activeTranslated = active.rect.current.translated
      const activeCenterY =
        activeTranslated !== null ? activeTranslated.top + activeTranslated.height / 2 : null
      const side =
        dropTarget?.itemId === overId
          ? dropTarget.side
          : resolveDirectoryInsertSide(activeCenterY, over.rect.top, over.rect.height)

      const nextIds = reorderDirectoryFlatRowIds(flatIds, activeId, overId, side)
      if (!nextIds) {
        setDirectoryReparentHint(null)
        return
      }

      setDirectorySiblingOrder((prev) => {
        const next = { ...prev, [flatScope]: nextIds }
        return next
      })
      setSortKey('manual')
      setSortDirection('asc')
      setDirectoryReparentHint(null)
    },
    [directoryFlatTreeRows, directoryRowDropTarget]
  )

  const handleDirectoryRowDragCancel = useCallback(() => {
    setDirectoryRowDragId(null)
    setDirectoryRowDragWidthPx(640)
    setDirectoryRowDropTarget(null)
  }, [])

  const directoryRowDragOverlayItem = useMemo(
    () =>
      directoryRowDragId
        ? directoryFlatTreeRows.find((row) => row.item.id === directoryRowDragId)?.item ?? null
        : null,
    [directoryFlatTreeRows, directoryRowDragId]
  )

  const directoryKanbanItems = useMemo(
    () =>
      filteredItems.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        priority: item.priority,
        assignee: item.assignee,
        workspace: item.workspace,
        project: item.project,
        label: resolveWorkItemDirectoryLabel(item),
        dueDate: item.dueDate,
        progress: item.progress,
        syncOrigin: item.syncOrigin,
        externalLinks: item.externalLinks,
      })),
    [filteredItems]
  )

  const directoryGanttItems = useMemo(
    () => mapTaskWorkItemsToDirectoryGantt(filteredItems),
    [filteredItems]
  )

  useEffect(() => {
    if (directoryGanttSelectedId && !directoryGanttItems.some((item) => item.id === directoryGanttSelectedId)) {
      setDirectoryGanttSelectedId('')
    }
  }, [directoryGanttItems, directoryGanttSelectedId])

  const workMap = useMemo(() => {
    return visibleWorkItems.reduce<Record<string, WorkItem>>((map, item) => {
      map[item.id] = item
      return map
    }, {})
  }, [visibleWorkItems])

  const drawerItem = useMemo(
    () => (drawer.workItemId ? visibleWorkItems.find((item) => item.id === drawer.workItemId) ?? null : null),
    [drawer.workItemId, visibleWorkItems]
  )

  function upsertWorkItemInState(updated: WorkItem) {
    setWorkItems((current) => current.map((item) => (item.id === updated.id ? updated : item)))
  }

  useEffect(() => {
    if (!drawerItem) {
      setDrawerIntegrationProfile(null)
      setDrawerPatchError(null)
      return
    }
    setDrawerEditStatus(drawerItem.status)
    setDrawerEditPriority(drawerItem.priority)
    setDrawerPatchError(null)

    let cancelled = false
    ;(async () => {
      try {
        const profile = await getIntegrationProfile(drawerItem.workspace)
        if (!cancelled) setDrawerIntegrationProfile(profile)
      } catch {
        if (!cancelled) setDrawerIntegrationProfile(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [drawerItem])

  const summary = useMemo(() => {
    const today = startOfLocalDay(new Date())
    const overdue = visibleWorkItems.filter((item) => {
      if (item.status === 'Done') return false
      const due = parseWorkItemDate(item.dueDate)
      return due != null && due < today
    }).length
    const completed = visibleWorkItems.filter((item) => item.status === 'Done').length
    const inProgress = visibleWorkItems.filter((item) => item.status === 'In Progress').length
    const backlog = visibleWorkItems.filter((item) => item.status === 'Backlog').length
    const openTasks = visibleWorkItems.filter((item) => item.status !== 'Done').length
    const executionHealth =
      visibleWorkItems.length === 0
        ? 100
        : Math.max(0, Math.min(100, Math.round(100 - backlog * 6 - overdue * 4 + completed * 2)))

    return {
      total: visibleWorkItems.length,
      openTasks,
      inProgress,
      backlog,
      completed,
      overdue,
      executionHealth,
    }
  }, [visibleWorkItems])

  const kpiCards = useMemo(
    () => [
      {
        id: 'total',
        label: 'Total Work Items',
        value: String(summary.total),
        subtext: 'All active execution records in scope',
        trend: '—',
        icon: LayoutList,
        trendColor: '#0ea5e9',
        trendSeries: Array.from({ length: 8 }, () => summary.total),
      },
      {
        id: 'open',
        label: 'Open Tasks',
        value: String(summary.openTasks),
        subtext: 'Operational items not yet done',
        trend: '—',
        icon: Briefcase,
        trendColor: '#6366f1',
        trendSeries: Array.from({ length: 8 }, () => summary.openTasks),
      },
      {
        id: 'health',
        label: 'Execution Health',
        value: `${summary.executionHealth}%`,
        subtext: 'Composite health across flow and blockers',
        trend: '—',
        icon: Signal,
        trendColor: '#10b981',
        trendSeries: Array.from({ length: 8 }, () => summary.executionHealth),
      },
      {
        id: 'backlog',
        label: 'Backlog Items',
        value: String(summary.backlog),
        subtext: 'Queued work not yet in active flow',
        trend: '—',
        icon: Inbox,
        trendColor: '#8b5cf6',
        trendSeries: Array.from({ length: 8 }, () => summary.backlog),
      },
      {
        id: 'overdue',
        label: 'Overdue Items',
        value: String(summary.overdue),
        subtext: 'Due-date breach requiring escalation',
        trend: '—',
        icon: CalendarClock,
        trendColor: '#f97316',
        trendSeries: Array.from({ length: 8 }, () => summary.overdue),
      },
      {
        id: 'done',
        label: 'Completed',
        value: String(summary.completed),
        subtext: 'Delivery outcomes logged to history',
        trend: '—',
        icon: CheckCircle2,
        trendColor: '#06b6d4',
        trendSeries: Array.from({ length: 8 }, () => summary.completed),
      },
    ],
    [summary]
  )

  const workflowDistribution = useMemo(() => {
    return ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'].map((status) => ({
      stage: status,
      count: visibleWorkItems.filter((item) => item.status === status).length,
    }))
  }, [visibleWorkItems])

  const overviewTelemetry = useMemo(
    () => buildOverviewTelemetry(visibleWorkItems),
    [visibleWorkItems]
  )

  /** Structure tree respects search while keeping ancestor nodes for matched descendants. */
  const structureBrowseItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return visibleWorkItems

    const byId = new Map(visibleWorkItems.map((item) => [item.id, item]))
    const itemIds = new Set(visibleWorkItems.map((item) => item.id))
    const matched = new Set<string>()

    for (const item of visibleWorkItems) {
      const haystack = [item.title, item.id, item.project, item.workspace, item.assignee, item.type]
        .join(' ')
        .toLowerCase()
      if (haystack.includes(query)) matched.add(item.id)
    }

    const keep = new Set(matched)
    for (const id of matched) {
      let current = byId.get(id)
      while (current) {
        const parentId = resolveWorkItemParentId(current, itemIds)
        if (!parentId) break
        keep.add(parentId)
        current = byId.get(parentId)
      }
    }

    return visibleWorkItems.filter((item) => keep.has(item.id))
  }, [deferredSearch, visibleWorkItems])

  const timeSummary = useMemo(() => {
    const estimated = visibleWorkItems.reduce((sum, item) => sum + item.estimatedHours, 0)
    const actual = visibleWorkItems.reduce((sum, item) => sum + item.actualHours, 0)
    return {
      estimated,
      actual,
      remaining: Math.max(0, estimated - actual),
      variance: actual - estimated,
    }
  }, [visibleWorkItems])

  async function handleDirectoryFieldUpdate(id: string, field: DirectoryInlineField, rawValue: string) {
    const previous = workItems.find((item) => item.id === id)
    if (!previous) return

    if (field === 'workspace') {
      const workspace = rawValue.trim()
      if (!workspace || workspace === previous.workspace) return

      const previousItems = workItems
      startTransition(() => {
        setWorkItems((current) =>
          current.map((item) => (item.id === id ? { ...item, workspace } : item))
        )
      })

      try {
        await moveWorkItemWorkspace(id, workspace)
        await reloadWorkItemsFromApi()
        setDirectoryReparentHint(null)
      } catch {
        startTransition(() => setWorkItems(previousItems))
        setDirectoryReparentHint('Failed to update workspace — reverted to previous value.')
      }
      return
    }

    const value =
      field === 'title' || field === 'project' || field === 'label' || field === 'assignee'
        ? rawValue.trim()
        : rawValue

    if (field === 'title' && !value) return

    const optimistic: WorkItem = {
      ...previous,
      ...(field === 'type' ? { type: value as WorkItemType } : { [field]: value }),
      lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }
    startTransition(() => upsertWorkItemInState(optimistic))

    const patchBody: Parameters<typeof patchWorkItem>[1] = {}
    switch (field) {
      case 'title':
        patchBody.title = value
        break
      case 'type':
        patchBody.type = value as WorkItemType
        break
      case 'project':
        patchBody.project = value
        break
      case 'priority':
        patchBody.priority = value as Priority
        break
      case 'status':
        patchBody.status = value as WorkStatus
        break
      case 'assignee':
        patchBody.assignee = value || 'Unassigned'
        break
      case 'label':
        patchBody.label = value
        break
      case 'dueDate':
        patchBody.dueDate = value
        break
      default:
        return
    }

    try {
      const updated = await patchWorkItem(id, patchBody)
      startTransition(() => upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem))
      const offlineStatus = await getWorkOfflineStatusSnapshot()
      if (!offlineStatus.isOnline || offlineStatus.pendingCount > 0) {
        setDirectoryReparentHint('Saved locally — will sync when the service is back.')
      } else {
        setDirectoryReparentHint(null)
      }
    } catch (error) {
      if (error instanceof WorkItemVersionConflictError) {
        applyWorkItemConflictToState(error)
        return
      }
      startTransition(() => upsertWorkItemInState(previous))
      setDirectoryReparentHint(`Failed to update ${field} — reverted to previous value.`)
    }
  }

  async function handleDirectoryReparent(draggedId: string, parentId: string) {
    const validation = validateWorkItemReparent(draggedId, parentId, workItems)
    if (!validation.valid) {
      setDirectoryReparentHint(validation.message)
      return
    }

    const parent = workItems.find((item) => item.id === parentId)
    if (!parent) return

    const previousItems = workItems
    startTransition(() => {
      setWorkItems((current) => {
        const dragged = current.find((item) => item.id === draggedId)
        if (!dragged) return current

        const reparented = reparentWorkItem(dragged, parent)
        const descendantIds = collectDescendantIds(draggedId, current)

        return current.map((item) => {
          if (item.id === draggedId) return reparented
          if (descendantIds.has(item.id)) {
            return { ...item, project: reparented.project, workspace: reparented.workspace }
          }
          return item
        })
      })
      setDirectoryExpandedIds((prev) => new Set([...prev, parentId]))
      setDirectoryReparentHint(null)
    })

    try {
      const updated = await patchWorkItem(draggedId, { parentId })
      startTransition(() => {
        upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem)
      })
    } catch (error) {
      if (error instanceof WorkItemVersionConflictError) {
        applyWorkItemConflictToState(error)
        return
      }
      startTransition(() => setWorkItems(previousItems))
      setDirectoryReparentHint('Failed to save reparent — reverted to previous state.')
    }
  }

  async function handleStructureDetach(draggedId: string) {
    const dragged = workItems.find((item) => item.id === draggedId)
    if (!dragged) return
    if (!canDetachStructureItem(dragged, workItems)) {
      setDirectoryReparentHint('This item cannot be moved to Ungrouped.')
      return
    }

    const previousItems = workItems
    startTransition(() => {
      setWorkItems((current) =>
        current.map((item) => {
          if (item.id !== draggedId) return item
          return {
            ...item,
            parentId: undefined,
            epicId: undefined,
            featureId: undefined,
            lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
          }
        })
      )
      setDirectoryReparentHint(null)
    })

    try {
      const updated = await patchWorkItem(draggedId, { parentId: null })
      startTransition(() => {
        upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem)
      })
    } catch (error) {
      if (error instanceof WorkItemVersionConflictError) {
        applyWorkItemConflictToState(error)
        return
      }
      startTransition(() => setWorkItems(previousItems))
      setDirectoryReparentHint('Failed to detach work item — reverted to previous state.')
    }
  }

  async function handleDrawerQuickSave() {
    if (!drawerItem) return
    setDrawerSaving(true)
    setDrawerPatchError(null)

    try {
      const updated = await patchWorkItem(drawerItem.id, {
        status: drawerEditStatus,
        priority: drawerEditPriority,
      })
      upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem)
    } catch (error) {
      if (error instanceof WorkItemVersionConflictError) {
        applyWorkItemConflictToState(error)
        return
      }
      setDrawerPatchError('Failed to save changes. Check Work Management service.')
    } finally {
      setDrawerSaving(false)
    }
  }

  async function handleKanbanTitleChange(itemId: string, title: string) {
    const previousItems = workItems
    setWorkItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, title } : item))
    )
    setDirectoryReparentHint(null)

    try {
      const updated = await patchWorkItem(itemId, { title })
      upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem)
    } catch (error) {
      if (error instanceof WorkItemVersionConflictError) {
        applyWorkItemConflictToState(error)
        return
      }
      setWorkItems(previousItems)
      setDirectoryReparentHint('Failed to rename task — reverted to previous title.')
      throw new Error('kanban-title-change-failed')
    }
  }

  async function handleKanbanStatusChange(itemId: string, status: WorkStatus) {
    const previousItems = workItems
    setWorkItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status } : item))
    )
    setDirectoryReparentHint(null)

    try {
      const updated = await patchWorkItem(itemId, { status })
      upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem)
    } catch (error) {
      if (error instanceof WorkItemVersionConflictError) {
        applyWorkItemConflictToState(error)
        return
      }
      setWorkItems(previousItems)
      setDirectoryReparentHint('Failed to move task — reverted to previous status.')
      throw new Error('kanban-status-change-failed')
    }
  }

  async function handleBulkApply() {
    if (!bulkActionMode || selectedIds.length === 0) return
    setBulkSaving(true)
    setBulkError(null)

    try {
      const result = await batchPatchWorkItems(
        bulkActionMode === 'status'
          ? { ids: selectedIds, status: bulkStatusValue }
          : { ids: selectedIds, assignee: bulkAssigneeValue }
      )
      for (const item of result.updated) {
        upsertWorkItemInState(mapApiWorkItemToPage(item) as WorkItem)
      }
      if (result.failed.length > 0) {
        setBulkError(`${result.failed.length} of ${selectedIds.length} item(s) could not be updated.`)
      } else {
        setBulkActionMode(null)
        setSelectedIds([])
      }
    } catch {
      setBulkError('Bulk update failed. Check Work Management service (8432).')
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleOwnershipBulkAssign(itemIds: string[], assignee: string) {
    if (itemIds.length === 0) return
    const result = await batchPatchWorkItems({ ids: itemIds, assignee })
    for (const item of result.updated) {
      upsertWorkItemInState(mapApiWorkItemToPage(item) as WorkItem)
    }
    if (result.failed.length > 0) {
      setDirectoryReparentHint(
        `${result.failed.length} of ${itemIds.length} item(s) could not be reassigned.`,
      )
    }
  }

  function openBulkAction(mode: 'status' | 'assignee') {
    if (workItemsLoadError) return
    setBulkError(null)
    setBulkActionMode(mode)
    if (mode === 'status') setBulkStatusValue('In Progress')
    if (mode === 'assignee') setBulkAssigneeValue(filterOptions.assignees[0] ?? 'Unassigned')
  }

  function handleSort(column: SortKey) {
    if (sortKey === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(column)
    setSortDirection('asc')
  }

  const directoryColumnWidthStyle = useCallback((key: DirectoryTableColumnKey): CSSProperties | undefined => {
    const px = directoryColumnWidthsPx[key]
    if (!px || px <= 0) return undefined
    return { width: px, minWidth: px, maxWidth: px }
  }, [directoryColumnWidthsPx])

  const hasAnyDirectoryCustomColumnWidth = useMemo(
    () => Object.values(directoryColumnWidthsPx).some((px) => typeof px === 'number' && px > 0),
    [directoryColumnWidthsPx]
  )

  const resetAllDirectoryColumnWidths = useCallback(() => {
    setDirectoryColumnWidthsPx({})
  }, [])

  const isDirectoryFirstColumn = useCallback(
    (key: DirectoryTableColumnKey) => directoryVisibleColumnOrder[0] === key,
    [directoryVisibleColumnOrder]
  )

  const isDirectorySecondColumn = useCallback(
    (key: DirectoryTableColumnKey) => directoryVisibleColumnOrder[1] === key,
    [directoryVisibleColumnOrder]
  )

  const isDirectoryThirdColumnOrLater = useCallback(
    (key: DirectoryTableColumnKey) => directoryVisibleColumnOrder.indexOf(key) >= 2,
    [directoryVisibleColumnOrder]
  )

  const isDirectoryLastColumn = useCallback(
    (key: DirectoryTableColumnKey) =>
      directoryVisibleColumnOrder[directoryVisibleColumnOrder.length - 1] === key,
    [directoryVisibleColumnOrder]
  )

  const getDirectoryColumnIndex = useCallback(
    (key: DirectoryTableColumnKey) => directoryColumnOrder.indexOf(key),
    [directoryColumnOrder]
  )

  const moveDirectoryColumnToFirst = useCallback((key: DirectoryTableColumnKey) => {
    setDirectoryColumnOrder((prev) => {
      const index = prev.indexOf(key)
      if (index <= 1) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(1, 0, item)
      if (next[0] === DIRECTORY_PINNED_FIRST_COLUMN) return next
      const rest = next.filter((col) => col !== DIRECTORY_PINNED_FIRST_COLUMN)
      return [DIRECTORY_PINNED_FIRST_COLUMN, ...rest]
    })
  }, [])

  const moveDirectoryColumnLeft = useCallback((key: DirectoryTableColumnKey) => {
    setDirectoryColumnOrder((prev) => {
      const index = prev.indexOf(key)
      if (index <= 1) return prev
      return arrayMove(prev, index, index - 1)
    })
  }, [])

  const moveDirectoryColumnRight = useCallback((key: DirectoryTableColumnKey) => {
    setDirectoryColumnOrder((prev) => {
      const index = prev.indexOf(key)
      if (index < 0 || index >= prev.length - 1) return prev
      return arrayMove(prev, index, index + 1)
    })
  }, [])

  const moveDirectoryColumnToLast = useCallback((key: DirectoryTableColumnKey) => {
    setDirectoryColumnOrder((prev) => {
      const index = prev.indexOf(key)
      if (index < 0 || index >= prev.length - 1) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.push(item)
      return next
    })
  }, [])

  const beginDirectoryColumnResize = useCallback(
    (columnKey: DirectoryTableColumnKey, startX: number, thElement: HTMLTableCellElement) => {
      const measuredWidth = Math.round(thElement.getBoundingClientRect().width)
      const startWidth = directoryColumnWidthsPx[columnKey] ?? measuredWidth
      setDirectoryColumnWidthsPx((prev) => ({
        ...prev,
        [columnKey]: clampDirectoryColumnWidthPx(prev[columnKey] ?? measuredWidth),
      }))
      directoryColumnResizeRef.current = { columnKey, startX, startWidth }
      setDirectoryColumnResizingKey(columnKey)
    },
    [directoryColumnWidthsPx]
  )

  useEffect(() => {
    if (!directoryColumnResizingKey) return
    const onMove = (event: MouseEvent) => {
      const active = directoryColumnResizeRef.current
      if (!active) return
      const next = clampDirectoryColumnWidthPx(active.startWidth + (event.clientX - active.startX))
      setDirectoryColumnWidthsPx((prev) => ({ ...prev, [active.columnKey]: next }))
    }
    const onUp = () => {
      directoryColumnResizeRef.current = null
      setDirectoryColumnResizingKey(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [directoryColumnResizingKey])

  const directoryFrozenColumnClass = freezeDirectoryFirstColumn
    ? 'sticky left-0 z-20 bg-slate-50/95 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.12)] dark:bg-slate-800/55 dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]'
    : ''

  const directoryFrozenBodyCellClass = freezeDirectoryFirstColumn
    ? 'sticky left-0 z-10 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.35)]'
    : ''

  const autoResizeDirectoryColumn = useCallback(
    (key: DirectoryTableColumnKey) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const measureText = (text: string, fontWeight: 'normal' | 'semibold' = 'normal') => {
        if (!ctx) return text.length * 7
        ctx.font =
          fontWeight === 'semibold'
            ? '600 12px ui-sans-serif, system-ui, sans-serif'
            : '12px ui-sans-serif, system-ui, sans-serif'
        return ctx.measureText(text).width
      }

      const label = directoryColumnLabel(key)
      let maxContent = measureText(label, 'semibold')
      for (const item of sortedItems) {
        switch (key) {
          case 'title':
            maxContent = Math.max(maxContent, measureText(item.title, 'semibold'), measureText(item.id))
            break
          case 'type':
            maxContent = Math.max(maxContent, measureText(item.type))
            break
          case 'project':
            maxContent = Math.max(maxContent, measureText(item.project?.trim() || '—', 'semibold'))
            break
          case 'workspace':
            maxContent = Math.max(maxContent, measureText(item.workspace, 'semibold'))
            break
          case 'label':
            maxContent = Math.max(maxContent, measureText(resolveWorkItemDirectoryLabel(item) || '—'))
            break
          case 'assignee':
            maxContent = Math.max(maxContent, measureText(item.assignee, 'semibold'))
            break
          case 'status':
            maxContent = Math.max(maxContent, measureText(item.status))
            break
          case 'priority':
            maxContent = Math.max(maxContent, measureText(item.priority))
            break
          case 'dueDate':
            maxContent = Math.max(maxContent, measureText(item.dueDate))
            break
          case 'progress':
            maxContent = Math.max(maxContent, measureText(`${item.progress}%`))
            break
          case 'dependency':
            maxContent = Math.max(maxContent, measureText(item.dependencyStatus))
            break
        }
      }

      const headerChromePx =
        key === 'title' ? 132 : key === 'assignee' ? 104 : key === 'label' || key === 'type' ? 96 : 88
      const width = clampDirectoryColumnWidthPx(Math.ceil(maxContent + headerChromePx))
      setDirectoryColumnWidthsPx((prev) => ({ ...prev, [key]: width }))
    },
    [sortedItems]
  )

  function SortableDirectoryHeaderCell({ columnKey }: { columnKey: DirectoryTableColumnKey }) {
    const label = directoryColumnLabel(columnKey)
    const sortColumnKey = directoryColumnSortKey(columnKey)
    const isSorted = sortColumnKey != null && sortKey === sortColumnKey
    const isPinnedFirstColumn = columnKey === DIRECTORY_PINNED_FIRST_COLUMN
    const isFirstDirectoryColumn = isDirectoryFirstColumn(columnKey)
    const isLastDirectoryColumn = isDirectoryLastColumn(columnKey)
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: columnKey,
      disabled: isPinnedFirstColumn || Boolean(directoryRowDragId),
    })
    const style: CSSProperties = {
      transform: transform ? CSS.Transform.toString(transform) : undefined,
      transition,
      ...(directoryColumnWidthStyle(columnKey) ?? {}),
    }

    return (
      <th
        ref={setNodeRef}
        style={style}
        onContextMenu={(event) => {
          event.preventDefault()
          setDirectoryHeaderContextMenu({ x: event.clientX, y: event.clientY, columnKey })
        }}
        className={cn(
          'relative select-none border-b-[3px] border-double border-slate-300/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80',
          isPinnedFirstColumn
            ? DIRECTORY_FIRST_COLUMN_TINT_HEADER_CLASS
            : 'bg-white/90 dark:bg-slate-900/90',
          freezeDirectoryFirstColumn && isFirstDirectoryColumn && directoryFrozenColumnClass,
          isDragging && 'opacity-70'
        )}
      >
        <div className="flex items-center gap-1.5">
          {!isPinnedFirstColumn ? (
            <button
              type="button"
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500',
                'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                'cursor-grab active:cursor-grabbing'
              )}
              aria-label={`Arrange column: ${label}`}
              title="Drag to rearrange columns"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {sortColumnKey ? (
            <button
              type="button"
              onClick={() => handleSort(sortColumnKey)}
              className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground hover:text-foreground"
              title="Sort column"
            >
              <DirectoryColumnHeaderLabel columnKey={columnKey} label={label} />
              {isSorted ? (
                sortDirection === 'asc' ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )
              ) : (
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              )}
            </button>
          ) : (
            <DirectoryColumnHeaderLabel columnKey={columnKey} label={label} />
          )}
        </div>
        {!isLastDirectoryColumn ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${label} column`}
            title="Drag to resize column"
            className={cn(
              'absolute top-0 right-0 z-30 h-full w-3 translate-x-1/2 cursor-col-resize touch-none',
              'hover:bg-sky-400/15 active:bg-sky-400/25',
              directoryColumnResizingKey === columnKey && 'bg-sky-400/30'
            )}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const th = event.currentTarget.closest('th')
              if (!th) return
              beginDirectoryColumnResize(columnKey, event.clientX, th)
            }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
          />
        ) : null}
      </th>
    )
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function toggleDirectoryTreeExpand(id: string) {
    setDirectoryExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function closeDirectoryRowContextMenu() {
    setDirectoryRowContextMenu(null)
  }

  function getDirectorySiblingIndex(item: WorkItem): number {
    const parentId = item.parentId ?? null
    const siblingIds = directoryFlatTreeRows
      .filter((row) => (row.item.parentId ?? null) === parentId)
      .map((row) => row.item.id)
    return siblingIds.indexOf(item.id)
  }

  function openWorkItemAddDrawerForParent(
    parent: WorkItem,
    childType: WorkItemType,
    options?: { stayOnPanel?: boolean },
  ) {
    if (workItemsLoadError) return
    resetWorkItemAddForm()
    setWorkItemFormType(childType)
    setWorkItemFormParentId(parent.id)
    setWorkItemFormWorkspace(parent.workspace)
    setWorkItemFormProject(parent.project)
    setWorkItemFormTeam(
      resolveWorkItemTeamLabel(parent.team, operationalTeamOptions)
        || defaultOperationalTeamLabel(operationalTeamOptions),
    )
    setWorkItemFormAssignee(parent.assignee === 'Unassigned' ? 'Unassigned' : parent.assignee)
    if (!options?.stayOnPanel) setActivePanel('directory')
    setWorkItemAddOpen(true)
    window.requestAnimationFrame(() => workItemTitleInputRef.current?.focus())
  }

  function openCreateEpicFromStructure() {
    if (workItemsLoadError) return
    resetWorkItemAddForm()
    setWorkItemFormType('Epic')
    setWorkItemAddOpen(true)
    window.requestAnimationFrame(() => workItemTitleInputRef.current?.focus())
  }

  async function handleDirectoryCopyName(item: WorkItem) {
    try {
      await navigator.clipboard.writeText(item.title)
      setDirectoryClipboardTitle(item.title)
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Copied to clipboard',
        description: `"${item.title}" copied.`,
      })
    } catch {
      setDirectoryClipboardTitle(item.title)
      publishWorkActionFeedback(addToast, {
        variant: 'default',
        title: 'Copy failed',
        description: 'Title stored for paste in this session.',
      })
    }
    closeDirectoryRowContextMenu()
  }

  async function handleDirectoryPasteTitle(item: WorkItem) {
    if (!directoryClipboardTitle?.trim()) return
    closeDirectoryRowContextMenu()
    const previous = item
    try {
      const updated = await patchWorkItem(item.id, { title: directoryClipboardTitle.trim() })
      upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem)
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Title pasted',
        description: `Updated ${item.id}.`,
      })
    } catch {
      upsertWorkItemInState(previous)
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Paste failed',
        description: 'Check Work Management service (8432).',
      })
    }
  }

  async function handleDirectoryDuplicate(item: WorkItem) {
    closeDirectoryRowContextMenu()
    try {
      const created = await createWorkItem({
        title: `${item.title} (copy)`,
        type: item.type,
        project: item.project,
        workspace: item.workspace,
        assignee: item.assignee,
        team: item.team,
        reporter: item.reporter ?? item.owner,
        labels: [...item.labels],
        priority: item.priority,
        status: 'To Do',
        startDate: item.startDate,
        dueDate: item.dueDate,
        estimatedHours: item.estimatedHours,
        description: item.description,
        parentId: item.parentId ?? null,
      })
      upsertWorkItemInState(mapApiWorkItemToPage(created) as WorkItem)
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Work item duplicated',
        description: `"${item.title}" duplicated.`,
        persistToNotifications: true,
        action: 'work_item_duplicated',
        metadata: { work_item_id: item.id, work_item_title: item.title },
      })
    } catch {
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Duplicate failed',
        description: 'Check Work Management service (8432).',
      })
    }
  }

  async function handleDirectoryCreateTaskBelow(item: WorkItem) {
    closeDirectoryRowContextMenu()
    try {
      const created = await createWorkItem({
        title: 'New task',
        type: 'Task',
        project: item.project,
        workspace: item.workspace,
        assignee: 'Unassigned',
        team: item.team,
        priority: 'Medium',
        status: 'To Do',
        dueDate: item.dueDate,
        estimatedHours: 8,
        parentId: item.parentId ?? null,
      })
      upsertWorkItemInState(mapApiWorkItemToPage(created) as WorkItem)
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Task created',
        description: 'New task created below the selected row.',
        persistToNotifications: true,
        action: 'work_item_created',
      })
    } catch {
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Create task failed',
        description: 'Check Work Management service (8432).',
      })
    }
  }

  // Opens a confirmation dialog (always confirm — cascades to subitems).
  function handleDirectoryMoveWorkspace(item: WorkItem, workspace: string) {
    closeDirectoryRowContextMenu()
    setMoveWorkspaceState({ item, mode: 'existing', workspace })
  }

  async function confirmMoveWorkspace() {
    if (!moveWorkspaceState) return
    const { item } = moveWorkspaceState
    const name = moveWorkspaceState.workspace.trim()
    if (!name) return
    setMoveWorkspaceSaving(true)
    try {
      const result = await moveWorkItemWorkspace(item.id, name)
      await reloadWorkItemsFromApi()
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Moved to workspace',
        description: `"${item.title}"${result.count > 1 ? ` and ${result.count - 1} subitem(s)` : ''} moved to ${name}.`,
        persistToNotifications: true,
        action: 'work_item_moved_workspace',
        metadata: { work_item_id: item.id, workspace: name },
      })
      setMoveWorkspaceState(null)
    } catch {
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Move failed',
        description: 'Could not move to workspace. Check the Work Management & Integration Hub services.',
      })
    } finally {
      setMoveWorkspaceSaving(false)
    }
  }

  async function handleDirectoryMoveLabel(item: WorkItem, label: string) {
    closeDirectoryRowContextMenu()
    try {
      const updated = await patchWorkItem(item.id, { label })
      upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem)
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Moved to label',
        description: `"${item.title}" moved to ${label}.`,
        persistToNotifications: true,
        action: 'work_item_moved_label',
        metadata: { work_item_id: item.id, label },
      })
    } catch {
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Move failed',
        description: 'Could not move to label.',
      })
    }
  }

  async function handleDirectoryArchive(item: WorkItem) {
    closeDirectoryRowContextMenu()
    try {
      const updated = await patchWorkItem(item.id, { status: 'Done' })
      upsertWorkItemInState(mapApiWorkItemToPage(updated) as WorkItem)
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Work item archived',
        description: `"${item.title}" marked Done.`,
        persistToNotifications: true,
        action: 'work_item_archived',
        metadata: { work_item_id: item.id, work_item_title: item.title },
      })
    } catch {
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Archive failed',
        description: 'Check Work Management service (8432).',
      })
    }
  }

  function resolveDeleteWorkItemImpact(item: WorkItem) {
    const descendantIds = collectDescendantIds(item.id, workItems)
    const subitemCount = descendantIds.size
    const removedIds = new Set([item.id, ...descendantIds])
    const hasMondayLinked = workItems.some(
      (entry) =>
        removedIds.has(entry.id) &&
        (entry.syncOrigin === 'monday' ||
          (entry.externalLinks ?? []).some((link) => link.provider === 'monday' && link.external_id))
    )
    return { descendantIds, subitemCount, removedIds, hasMondayLinked }
  }

  function openDeleteWorkItemDialog(item: WorkItem) {
    closeDirectoryRowContextMenu()
    setConfirmDeleteWorkItemTarget(item)
    setConfirmDeleteWorkItemOpen(true)
  }

  function closeDeleteWorkItemDialog() {
    if (isDeletingWorkItem) return
    setConfirmDeleteWorkItemOpen(false)
    setConfirmDeleteWorkItemTarget(null)
  }

  async function submitDeleteWorkItem() {
    if (!confirmDeleteWorkItemTarget || isDeletingWorkItem) return
    const item = confirmDeleteWorkItemTarget
    const { removedIds, hasMondayLinked } = resolveDeleteWorkItemImpact(item)

    const previousItems = workItems
    startTransition(() => {
      setWorkItems((current) => current.filter((entry) => !removedIds.has(entry.id)))
      setSelectedIds((current) => current.filter((id) => !removedIds.has(id)))
      if (drawer.workItemId && removedIds.has(drawer.workItemId)) {
        setDrawer({ open: false, workItemId: '' })
      }
    })

    setIsDeletingWorkItem(true)
    try {
      const result = await deleteWorkItem(item.id)
      const subitemExtra =
        result.deleted > 1 ? ` (+${result.deleted - 1} subitem${result.deleted - 1 === 1 ? '' : 's'})` : ''
      const mondayNote = hasMondayLinked
        ? ' Monday outbound delete queued; item will not re-import on sync.'
        : ''
      publishWorkActionFeedback(addToast, {
        variant: 'success',
        title: 'Work item deleted',
        description: `"${item.title}"${subitemExtra} has been deleted.${mondayNote}`,
        persistToNotifications: true,
        action: 'work_item_deleted',
        metadata: {
          work_item_id: item.id,
          work_item_title: item.title,
          deleted_count: result.deleted,
          monday_outbound: hasMondayLinked,
        },
      })
      setConfirmDeleteWorkItemOpen(false)
      setConfirmDeleteWorkItemTarget(null)
    } catch {
      startTransition(() => setWorkItems(previousItems))
      publishWorkActionFeedback(addToast, {
        variant: 'error',
        title: 'Delete failed',
        description: 'Check Work Management service (8432).',
      })
    } finally {
      setIsDeletingWorkItem(false)
    }
  }

  function handleDirectoryDelete(item: WorkItem) {
    openDeleteWorkItemDialog(item)
  }

  async function handleDirectoryConvertToSubitem(item: WorkItem, rowIndex: number) {
    const previousRow = directoryTableRows[rowIndex - 1]?.item
    if (!previousRow) return
    const validation = validateWorkItemReparent(item.id, previousRow.id, workItems)
    if (!validation.valid) return
    closeDirectoryRowContextMenu()
    await handleDirectoryReparent(item.id, previousRow.id)
  }

  function resetWorkItemAddForm() {
    setWorkItemFormError(null)
    setWorkItemFormType('Task')
    setWorkItemFormTitle('')
    setWorkItemFormDescription('')
    setWorkItemFormProject('')
    setWorkItemFormWorkspace(defaultTectonaWorkspaceName(workspacePickerGroups))
    setWorkItemFormAssignee('Unassigned')
    setWorkItemFormTeam(defaultOperationalTeamLabel(operationalTeamOptions))
    setWorkItemFormReporter('Unassigned')
    setWorkItemFormLabels([])
    setWorkItemFormLabelInput('')
    setWorkItemFormPriority('Medium')
    setWorkItemFormStatus('To Do')
    const dates = defaultWorkItemAddFormDates()
    setWorkItemFormStartDate(dates.startDate)
    setWorkItemFormDueDate(dates.dueDate)
    setWorkItemFormParentId('')
    setWorkItemFormEstimatedHours('8')
    workItemAddScrollRef.current?.scrollTo({ top: 0 })
  }

  function closeWorkItemAddDrawer() {
    if (workItemAddSaving) return
    setWorkItemTypeMenuOpen(false)
    setWorkItemPriorityMenuOpen(false)
    setWorkItemStatusMenuOpen(false)
    setWorkItemAddOpen(false)
    resetWorkItemAddForm()
  }

  function openCreateWorkItemDrawer() {
    if (workItemsLoadError) return
    resetWorkItemAddForm()
    setActivePanel('directory')
    setWorkItemAddOpen(true)
    window.requestAnimationFrame(() => workItemTitleInputRef.current?.focus())
  }

  function commitWorkItemLabelDraft(raw?: string) {
    const tokens = parseWorkItemLabelTokens(raw ?? workItemFormLabelInput)
    if (tokens.length === 0) {
      setWorkItemFormLabelInput('')
      return
    }
    setWorkItemFormLabels((current) => mergeWorkItemLabels(current, tokens))
    setWorkItemFormLabelInput('')
  }

  function removeWorkItemLabel(label: string) {
    setWorkItemFormLabels((current) => current.filter((entry) => entry !== label))
  }

  async function handleWorkItemCreate(openDetailAfter = false) {
    const title = workItemFormTitle.trim()
    if (!title) {
      setWorkItemFormError('Title is required.')
      return
    }

    if (!workItemFormWorkspace.trim()) {
      setWorkItemFormError('Workspace is required.')
      return
    }

    const parent = workItemFormParentId
      ? workItems.find((item) => item.id === workItemFormParentId) ?? null
      : null
    const parentRequired = workItemFormType === 'Subtask' || workItemFormType === 'Checklist'

    if (parentRequired && !parent) {
      setWorkItemFormError(
        `Select a parent (${formatWorkItemTypes(DIRECTORY_ALLOWED_PARENTS[workItemFormType])}) for this ${workItemFormType}.`
      )
      return
    }

    if (parent && !isValidWorkItemParentChild(parent, workItemFormType)) {
      setWorkItemFormError(`${workItemFormType} cannot be nested under ${parent.type}.`)
      return
    }

    const estimatedHours = Number.parseFloat(workItemFormEstimatedHours)
    if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
      setWorkItemFormError('Estimated hours must be a valid number.')
      return
    }

    if (
      workItemFormStartDate &&
      workItemFormDueDate &&
      new Date(workItemFormStartDate) > new Date(workItemFormDueDate)
    ) {
      setWorkItemFormError('Start date cannot be after due date.')
      return
    }

    setWorkItemFormError(null)
    setWorkItemAddSaving(true)

    const labels = mergeWorkItemLabels(workItemFormLabels, parseWorkItemLabelTokens(workItemFormLabelInput))

    try {
      const created = await createWorkItem({
        title,
        type: workItemFormType,
        description: normalizeRichHtmlForStorage(workItemFormDescription),
        project: workItemFormProject.trim(),
        workspace: workItemFormWorkspace,
        assignee: workItemFormAssignee,
        team: workItemFormTeam,
        reporter: workItemFormReporter,
        labels,
        priority: workItemFormPriority,
        status: workItemFormStatus,
        startDate: workItemFormStartDate || undefined,
        dueDate: workItemFormDueDate,
        estimatedHours,
        parentId: parent?.id ?? undefined,
      })
      const newItem = mapApiWorkItemToPage(created) as WorkItem

      startTransition(() => {
        setWorkItems((current) => [newItem, ...current])
        if (parent) {
          setDirectoryExpandedIds((prev) => new Set([...prev, parent.id]))
        }
        setPage(1)
        setWorkItemAddOpen(false)
        resetWorkItemAddForm()
        if (openDetailAfter) {
          setDrawer({ open: true, workItemId: newItem.id })
        }
      })
      if (workspacePickerGroups.monday.includes(workItemFormWorkspace)) {
        window.setTimeout(() => void reloadWorkItemsFromApi(), 1200)
      }
    } catch {
      setWorkItemFormError('Failed to save work item. Ensure Work Management API (port 8432) is running.')
    } finally {
      setWorkItemAddSaving(false)
    }
  }

  useEffect(() => {
    if (!workItemAddOpen) return
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || workItemAddSaving) return
      setWorkItemAddOpen(false)
      resetWorkItemAddForm()
    }
    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [workItemAddOpen, workItemAddSaving, filterOptions.projects, workspacePickerGroups])

  function switchPanel(id: (typeof PANEL_ITEMS)[number]['id']) {
    setActivePanel(id)
  }

  if (!shellReady) {
    return (
      <div className="space-y-5">
        <Breadcrumb items={[{ label: 'Task & Work Management' }]} />
        <PlatformDataLoadingState
          title="Loading Task & Work data"
          description="Retrieving work items from Work Management."
        />
      </div>
    )
  }

  return (
    <div className="min-h-0 space-y-6 pb-0">
      <div
        className={cn(
          'space-y-6',
          workspaceDockedContentInsetClass(navDocked && showEnterpriseNavPanel, showEnterpriseNavPanel && isWorkspaceCollapsed, enterpriseNavLayoutVariant)
        )}
      >
      <Breadcrumb items={[{ label: 'Task & Work Management' }]} />

      <PageHeader
        title="Task & Work Management"
        description="Manage execution work items, ownership, dependencies, workflow, and delivery activity"
        right={(
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-px rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-[0_2px_12px_rgba(15,23,42,0.07)] ring-1 ring-white/60 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/70 dark:ring-slate-700/30">
              <button
                type="button"
                onClick={() => setShowKpiCards((value) => !value)}
                className={cn(
                  'group relative flex items-center justify-center rounded-xl p-2.5 text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
                  showKpiCards && 'bg-sky-50 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(37,99,235,0.18)] hover:bg-sky-50 hover:text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                )}
                aria-label={showKpiCards ? 'Hide KPI cards' : 'Show KPI cards'}
                title={showKpiCards ? 'Hide KPI cards' : 'Show KPI cards'}
              >
                <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <div className="h-5 w-px bg-slate-200/70 dark:bg-slate-700/60" aria-hidden />
              <IntegrationSyncToolbarButton
                mondaySyncing={mondaySyncing}
                jiraSyncing={jiraSyncing}
                onSyncMonday={() => void handleSyncMonday()}
                onSyncJira={() => void handleSyncJira()}
              />
              <div className="h-5 w-px bg-slate-200/70 dark:bg-slate-700/60" aria-hidden />
              <button
                type="button"
                className="group relative flex items-center justify-center rounded-xl p-2.5 text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200"
                aria-label="Export task snapshot"
                title="Export task snapshot"
              >
                <ArrowDownToLine className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <div className="h-5 w-px bg-slate-200/70 dark:bg-slate-700/60" aria-hidden />
              <button
                type="button"
                onClick={() => setShowEnterpriseNavPanel((visible) => !visible)}
                className={cn(
                  'group relative flex items-center justify-center rounded-xl p-2.5 text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
                  showEnterpriseNavPanel && 'bg-sky-50 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(37,99,235,0.18)] hover:bg-sky-50 hover:text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                )}
                aria-label={showEnterpriseNavPanel ? 'Hide enterprise navigation' : 'Show enterprise navigation'}
                title={showEnterpriseNavPanel ? 'Hide enterprise navigation' : 'Show enterprise navigation'}
              >
                <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              {!isOverviewSectionActive ? (
                <>
                  <div className="h-5 w-px bg-slate-200/70 dark:bg-slate-700/60" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setShowFiltersPanel((current) => !current)}
                    className={cn(
                      'group relative flex items-center justify-center rounded-xl p-2.5 text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
                      showFiltersPanel && 'bg-sky-50 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(37,99,235,0.18)] hover:bg-sky-50 hover:text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                    )}
                    aria-label={showFiltersPanel ? 'Hide filters' : 'Show filters'}
                    title={showFiltersPanel ? 'Hide filters' : 'Show filters'}
                  >
                    <Filter className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      />

      {directoryDataLoading && !workItemsLoadError ? (
        <div className="text-sm text-muted-foreground">Loading work items from Work Management API…</div>
      ) : null}

      {showKpiCards ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {kpiCards.map((item) => (
          <button key={item.label} type="button" className="group text-left">
            <Card className={kpiCardChrome(item.id)}>
              <div className="pointer-events-none absolute -right-3 -bottom-4 opacity-[0.08] transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.12]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-slate-700/80 ring-1 ring-white/50 backdrop-blur-sm">
                  <item.icon className="h-7 w-7" />
                </div>
              </div>

              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="shrink-0 text-2xl font-bold leading-none text-slate-950">{item.value}</div>
                <div className="h-10 min-w-0 flex-1">
                  <KpiSparkline data={item.trendSeries} color={item.trendColor} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <item.icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  <span className="truncate">{item.subtext}</span>
                </span>
                <span className={cn('shrink-0 font-semibold', item.trend.startsWith('-') ? 'text-rose-600' : 'text-emerald-600')}>
                  {item.trend}
                </span>
              </div>
            </Card>
          </button>
        ))}
      </div>
      ) : null}

      <div
        className={cn(
          showEnterpriseNavPanel
            ? workspaceOuterGridClass(sidebarFixed, isWorkspaceCollapsed, enterpriseNavLayoutVariant)
            : 'relative',
          showEnterpriseNavPanel && sidebarFixed ? 'items-stretch' : undefined
        )}
      >
        {showEnterpriseNavPanel ? (
        <aside className={cn(workspaceAsideClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant), sidebarFixed && 'self-stretch')}>
          <div
            ref={navPanelRef}
            className={cn(
              workspaceNavInnerClass(navDocked, sidebarFixed, isWorkspaceCollapsed),
              'rounded-2xl xl:rounded-r-2xl',
              !navDocked && 'h-full min-h-0 overflow-hidden'
            )}
            style={
              !navDocked && navPanelHeightPx
                ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx, minHeight: navPanelHeightPx }
                : undefined
            }
            aria-label="Task workspace navigation"
          >
            <div className="shrink-0">
              <div className={cn('flex items-center', isWorkspaceCollapsed ? 'mb-2 justify-center' : 'mb-3 justify-between')}>
                {!isWorkspaceCollapsed ? (
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Enterprise Navigation</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'shrink-0 rounded-xl border border-slate-200/70 bg-white/75 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900',
                    isWorkspaceCollapsed ? 'h-8 w-8 rounded-full' : 'h-9 w-9'
                  )}
                  aria-label={isWorkspaceCollapsed ? 'Expand task workspace navigation' : 'Collapse task workspace navigation'}
                  title={isWorkspaceCollapsed ? 'Expand task workspace navigation' : 'Collapse task workspace navigation'}
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
                >
                  {isWorkspaceCollapsed ? (
                    <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                  )}
                </Button>
              </div>

              {!isWorkspaceCollapsed ? (
                <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/80">Execution Workspace</div>
                  <div className="mt-1.5 text-sm font-semibold leading-snug">Control tower for task flow, assignment, and delivery traceability</div>
                </div>
              ) : null}
            </div>

            <div className={workspaceNavMenuScrollClass()}>
              <div className="space-y-4">
              {PANEL_GROUPS.map(({ group, items }) => (
                <div key={group} className="space-y-1.5">
                  {!isWorkspaceCollapsed ? <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</div> : null}
                  {items.map((panel) => {
                    const Icon = panel.icon
                    const active = activePanel === panel.id
                    return (
                      <button
                        key={panel.id}
                        type="button"
                        onClick={() => switchPanel(panel.id)}
                        className={cn(
                          'group relative flex w-full overflow-hidden border text-left transition-all duration-200',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30',
                          isWorkspaceCollapsed ? 'items-center justify-center rounded-2xl px-2 py-3' : 'items-start gap-3 rounded-[20px] px-3.5 py-3',
                          active
                            ? 'border-slate-300/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] text-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.10)]'
                            : 'border-transparent bg-white/55 text-slate-600 hover:border-slate-200/80 hover:bg-white/88 hover:text-slate-950'
                        )}
                        aria-label={panel.label}
                        title={panel.label}
                      >
                        {active ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-sky-500 via-blue-600 to-indigo-600" /> : null}
                        <span
                          className={cn(
                            'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors',
                            active
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-slate-200/80 bg-slate-50/90 text-slate-600 group-hover:border-slate-300 group-hover:bg-slate-100'
                          )}
                        >
                          <Icon className={cn('shrink-0', isWorkspaceCollapsed ? 'h-5 w-5' : 'h-4 w-4')} />
                        </span>
                        {!isWorkspaceCollapsed ? (
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="block truncate text-sm font-semibold text-slate-900">{panel.label}</span>
                              <span
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                  active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                                )}
                              >
                                {panel.badge}
                              </span>
                            </span>
                            <span className="mt-1 block text-[11px] leading-4 text-slate-500">{panel.description}</span>
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}
              </div>
            </div>

            <div className="shrink-0 space-y-4 pt-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                  <Signal className="h-4 w-4" />
                  Execution Health
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <div className="shrink-0 text-3xl font-bold leading-none tabular-nums text-slate-900">{summary.executionHealth}%</div>
                  <p className="min-w-0 flex-1 text-[10px] leading-snug text-slate-600">
                    Balanced workflow throughput with blocker pressure that still needs active intervention.
                  </p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-blue-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${summary.executionHealth}%` }} />
                </div>
              </div>

              {!sidebarFixed ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Bulk Actions</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{selectedIds.length}</div>
                  <p className="mt-1 text-xs text-slate-600">Selected work items ready for reassignment or status changes.</p>
                  {selectedIds.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <Button variant="outline" size="sm" className="h-8 justify-start" onClick={() => openBulkAction('status')}>
                        Update Status
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 justify-start" onClick={() => openBulkAction('assignee')}>
                        Reassign
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 justify-start" onClick={() => setSelectedIds([])}>
                        Clear selection
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </aside>
        ) : null}

        <div
          className={cn(
            // Page wrapper already applies docked-nav inset when Fixed Sidebar is off.
            // Passing navDocked here would double the left padding and leave the Overview panel short.
            showEnterpriseNavPanel
              ? workspaceMainColumnClass(false, isWorkspaceCollapsed, enterpriseNavLayoutVariant)
              : 'space-y-4',
            'min-w-0 w-full',
            (activePanel === 'directory' || activePanel === 'structure' || activePanel === 'dependencies' || activePanel === 'ownership') && 'flex min-h-0 min-w-0 flex-col'
          )}
        >
          {!isOverviewSectionActive && showFiltersPanel ? (
            <Card
              ref={taskMainFiltersRef}
              className={cn(
                'glass-card mb-0 shrink-0 space-y-3 rounded-2xl p-4',
                'border border-white/40 dark:border-white/10',
                'ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
                'shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_52px_rgba(0,0,0,0.35)]',
                'bg-gradient-to-br from-white/70 via-background/75 to-slate-50/70 dark:from-slate-900/45 dark:via-background/40 dark:to-slate-950/20'
              )}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => startTransition(() => setSearch(event.target.value))}
                  className="h-10 w-full pl-9"
                  placeholder="Search task title, ID, epic, feature, assignee, or project"
                />
              </div>

              <div className="relative pt-3">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,hsl(var(--border)/0.2)_18%,hsl(var(--border)/0.75)_50%,hsl(var(--border)/0.2)_82%,transparent_100%)]"
                />
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {activePanel === 'structure' ? (
                    <button
                      type="button"
                      onClick={openCreateEpicFromStructure}
                      disabled={Boolean(workItemsLoadError)}
                      className={enterpriseCyanGradientActionButtonClass()}
                    >
                      <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                      Add Epic
                    </button>
                  ) : activePanel === 'dependencies' ? (
                    <button
                      type="button"
                      onClick={() => setDependencyAddOpenToken((value) => value + 1)}
                      disabled={Boolean(workItemsLoadError) || visibleWorkItems.length < 2}
                      className={enterpriseCyanGradientActionButtonClass()}
                    >
                      <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                      Link Items
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openCreateWorkItemDrawer}
                      disabled={Boolean(workItemsLoadError)}
                      className={enterpriseCyanGradientActionButtonClass()}
                    >
                    <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                    New Work Item
                  </button>
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          {isOverviewSectionActive ? (
            <Panel
              id="overview"
              title="Work Execution Overview"
              description="Operational command center for execution health, workflow flow, ownership balance, dependencies, and delivery risk across active work items."
              highlight={false}
              headerIcon={<BarChart3 className="h-5 w-5" />}
              outerRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn('w-full min-w-0 max-w-none', mainPanelViewportHeightPx != null && 'overflow-hidden')}
              scrollBody={mainPanelViewportHeightPx != null}
              showDivider={false}
            >
              {(() => {
                  const pal = OVERVIEW_PALETTES[overviewPalette]
                  const isVivid = (overviewPalette as string) === 'vivid'
                  const backlogCount = overviewTelemetry.backlogCount
                  return (
                    <div className="space-y-4">
                      {/* ROW 1 — Execution Health + Workflow State (executive donuts) */}
                      <div className="grid gap-4 xl:grid-cols-2">
                        <OverviewChartPanel
                          title="Execution Health Distribution"
                          description="Healthy vs at-risk vs critical delivery posture across open work."
                          icon={ShieldCheck}
                          tone="emerald"
                          palette={pal}
                        >
                          <OverviewExecutiveDonut
                            data={overviewTelemetry.healthDonut}
                            palette={pal}
                            selectedBand={focusBlocked ? 'Critical' : null}
                            onBandClick={(band) => setFocusBlocked(band === 'Critical' ? (current) => !current : false)}
                          />
                        </OverviewChartPanel>

                        <OverviewChartPanel
                          title="Workflow State Distribution"
                          description="Compact execution funnel across To Do → Done with bottleneck visibility."
                          icon={Workflow}
                          tone="sky"
                          palette={pal}
                          right={
                            <Badge className="rounded-full border border-blue-200 bg-blue-50 text-[11px] text-blue-700">Bottleneck watch</Badge>
                          }
                        >
                          <OverviewDonut
                            data={overviewTelemetry.workflowDonut}
                            centerLabel="Workflow"
                            pieColors={pal.workflowPieColors}
                            isVivid={isVivid}
                            selectedSlice={focusBlocked ? 'Backlog' : null}
                            onSliceClick={(name) => setFocusBlocked(name === 'Backlog' ? (current) => !current : false)}
                          />
                        </OverviewChartPanel>
                      </div>

                      {/* ROW 2 — Work composition + Delivery trend */}
                      <div className="grid gap-4 xl:grid-cols-2">
                        <OverviewChartPanel
                          title="Work Distribution by Type"
                          description="Epic-to-checklist mix across the current execution landscape."
                          icon={Layers3}
                          tone="violet"
                          palette={pal}
                        >
                          <OverviewDonut
                            data={overviewTelemetry.typeDonut}
                            centerLabel="Work Items"
                            pieColors={pal.typePieColors}
                            isVivid={isVivid}
                          />
                        </OverviewChartPanel>

                        <OverviewChartPanel
                          title="Delivery Trend"
                          description="30-day trend of created, completed, and closed work items."
                          icon={Activity}
                          tone="cyan"
                          palette={pal}
                          right={
                            <Badge className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700">
                              <TrendingUp className="h-3 w-3" /> {overviewTelemetry.deliveryTrendDeltaPct > 0 ? '+' : ''}{overviewTelemetry.deliveryTrendDeltaPct}%
                            </Badge>
                          }
                        >
                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={overviewTelemetry.deliveryTrend} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} interval={5} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                <Legend iconType="plainline" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                                <Line type="monotone" dataKey="created" name="Created" stroke={pal.workflowPieColors[1]} strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="completed" name="Completed" stroke={pal.healthSeg.healthy[1]} strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="closed" name="Closed" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </OverviewChartPanel>
                      </div>

                      {/* ROW 3 — Ownership + SLA risk */}
                      <div className="grid gap-4 xl:grid-cols-2">
                        <OverviewChartPanel
                          title="Ownership Distribution"
                          description="Work items per assignee — overload and underutilization pressure."
                          icon={Users}
                          tone="amber"
                          palette={pal}
                        >
                          <div className="space-y-2.5">
                            {overviewTelemetry.ownership.length === 0 ? (
                              <p className="text-xs text-slate-500">No open assignees in scope.</p>
                            ) : overviewTelemetry.ownership.map((owner) => {
                              const overloaded = owner.util > 120
                              const underutilized = owner.util < 60
                              const barColor = overloaded ? '#f43f5e' : underutilized ? '#f59e0b' : '#2563eb'
                              return (
                                <div key={owner.name} className="flex items-center gap-2.5 text-xs">
                                  <span className="w-16 shrink-0 truncate font-medium text-slate-700">{owner.name}</span>
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, owner.util)}%`, background: barColor }} />
                                  </div>
                                  <span className="w-5 shrink-0 text-right font-semibold text-slate-900 tabular-nums">{owner.count}</span>
                                  <span className={cn('w-10 shrink-0 text-right font-semibold tabular-nums', overloaded ? 'text-rose-600' : underutilized ? 'text-amber-600' : 'text-slate-500')}>
                                    {owner.util}%
                                  </span>
                                </div>
                              )
                            })}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />&gt;120% Overloaded</span>
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" />60–120% Optimal</span>
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />&lt;60% Underutilized</span>
                            </div>
                          </div>
                        </OverviewChartPanel>

                        <OverviewChartPanel
                          title="SLA & Due Date Risk"
                          description="Schedule risk distribution based on due dates."
                          icon={CalendarClock}
                          tone="rose"
                          palette={pal}
                        >
                          <div className="space-y-4">
                            <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-black/[0.03]">
                              {overviewTelemetry.sla.map((segment) => (
                                <div key={segment.label} style={{ width: `${segment.pct}%`, background: segment.color }} title={`${segment.label}: ${segment.value}`} />
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {overviewTelemetry.sla.map((segment) => (
                                <div key={segment.label} className="rounded-xl border border-slate-200/80 bg-white p-2.5">
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                    <span className="h-2 w-2 rounded-full" style={{ background: segment.color }} />
                                    {segment.label}
                                  </div>
                                  <div className="mt-1 flex items-baseline gap-1.5">
                                    <span className="text-lg font-semibold text-slate-900 tabular-nums">{segment.pct}%</span>
                                    <span className="text-[11px] text-slate-400 tabular-nums">({segment.value})</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </OverviewChartPanel>
                      </div>

                      {/* ROW 4 — Dependency health + Team velocity */}
                      <div className="grid gap-4 xl:grid-cols-2">
                        <OverviewChartPanel
                          title="Dependency Health"
                          description="Cross-team dependency and critical path status."
                          icon={GitBranch}
                          tone="indigo"
                          palette={pal}
                        >
                          <div className="space-y-2">
                            <div className="h-40 w-full">
                              {overviewTelemetry.depNodes.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                                  No parent/child links in scope yet.
                                </div>
                              ) : (
                              <svg viewBox="0 0 320 150" className="h-full w-full" role="img" aria-label="Dependency graph">
                                {overviewTelemetry.depEdges.map((edge) => {
                                  const from = overviewTelemetry.depNodes.find((node) => node.id === edge.from)
                                  if (!from) return null
                                  const to = overviewTelemetry.depNodes.find((node) => node.id === edge.to)
                                  if (!to) return null
                                  const x1 = from.x + 58
                                  const y1 = from.y + 12
                                  const x2 = to.x
                                  const y2 = to.y + 12
                                  const midX = (x1 + x2) / 2
                                  const dimmed = focusBlocked && edge.status !== 'Blocked'
                                  return (
                                    <path
                                      key={`${edge.from}-${edge.to}`}
                                      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                                      fill="none"
                                      stroke={DEP_STATUS_COLOR[edge.status]}
                                      strokeWidth={edge.status === 'Blocked' ? 2 : 1.5}
                                      strokeDasharray={edge.status === 'Blocked' ? '4 3' : undefined}
                                      opacity={dimmed ? 0.18 : 0.85}
                                    />
                                  )
                                })}
                                {overviewTelemetry.depNodes.map((node) => {
                                  const isBlocked = overviewTelemetry.depEdges.some((edge) => (edge.from === node.id || edge.to === node.id) && edge.status === 'Blocked')
                                  const dimmed = focusBlocked && !isBlocked
                                  return (
                                    <g key={node.id} opacity={dimmed ? 0.3 : 1}>
                                      <rect x={node.x} y={node.y} width={58} height={24} rx={7} fill={node.col === 0 ? '#eff6ff' : '#ffffff'} stroke={isBlocked ? '#f43f5e' : '#cbd5e1'} strokeWidth={1} />
                                      <text x={node.x + 29} y={node.y + 15} textAnchor="middle" fontSize="8.5" fontWeight={600} fill="#334155">{node.label}</text>
                                    </g>
                                  )
                                })}
                              </svg>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Healthy</span>
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Warning</span>
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Blocked</span>
                            </div>
                          </div>
                        </OverviewChartPanel>

                        <OverviewChartPanel
                          title="Team Velocity"
                          description="Estimated hours completed per week (from Done items in scope)."
                          icon={Timer}
                          tone="sky"
                          palette={pal}
                        >
                          <div className="flex items-stretch gap-3">
                            <div className="h-44 flex-1">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={overviewTelemetry.velocity} margin={{ top: 16, right: 10, left: -22, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                                  <XAxis dataKey="sprint" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(value: number) => [`${value}h`, 'Completed']} />
                                  <Line type="monotone" dataKey="sp" stroke={pal.workflowPieColors[1]} strokeWidth={2.2} dot={{ r: 3, fill: pal.workflowPieColors[1] }} activeDot={{ r: 4 }}>
                                    <LabelList dataKey="sp" position="top" formatter={(value: number) => `${value}`} style={{ fill: '#475569', fontSize: 9, fontWeight: 600 }} />
                                  </Line>
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex w-24 shrink-0 flex-col justify-center gap-2 text-xs">
                              <div className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5">
                                <p className="text-[10px] text-slate-500">Average</p>
                                <p className="font-semibold text-slate-900">{overviewTelemetry.velocityAvg}h</p>
                              </div>
                              <div className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5">
                                <p className="text-[10px] text-slate-500">Best</p>
                                <p className="font-semibold text-slate-900">{overviewTelemetry.velocityBest}h</p>
                              </div>
                              <div className={cn('flex items-center gap-1 px-0.5 font-semibold', overviewTelemetry.velocityDeltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                <TrendingUp className="h-3.5 w-3.5" /> {overviewTelemetry.velocityDeltaPct > 0 ? '+' : ''}{overviewTelemetry.velocityDeltaPct}%
                              </div>
                            </div>
                          </div>
                        </OverviewChartPanel>
                      </div>

                      {/* ROW 5 — Work item aging + AI delivery insight */}
                      <div className="grid gap-4 xl:grid-cols-2">
                        <OverviewChartPanel
                          title="Work Item Aging"
                          description="Age distribution of open work items."
                          icon={Clock3}
                          tone="amber"
                          palette={pal}
                        >
                          <div className="flex gap-3">
                            <div className="flex-1 overflow-hidden">
                              <div className="grid grid-cols-[64px_repeat(4,1fr)] gap-1 text-[10px]">
                                <span />
                                {OVERVIEW_AGING_COLUMNS.map((col) => (
                                  <span key={col} className="text-center font-medium text-slate-400">{col}</span>
                                ))}
                                {overviewTelemetry.aging.map((row) => (
                                  <Fragment key={row.type}>
                                    <span className="flex items-center truncate pr-1 font-medium text-slate-600">{row.type}</span>
                                    {row.buckets.map((value, index) => (
                                      <span key={index} className={cn('flex h-6 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums', agingCellTone(value))} title={`${row.type} · ${OVERVIEW_AGING_COLUMNS[index]}: ${value}`}>
                                        {value}
                                      </span>
                                    ))}
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                            <div className="flex w-20 shrink-0 flex-col justify-center gap-1.5">
                              {overviewTelemetry.agingSummary.map((summaryRow) => (
                                <div key={summaryRow.label} className="rounded-lg border border-slate-200/80 bg-white px-2 py-1.5 text-center">
                                  <p className={cn('text-base font-semibold tabular-nums', summaryRow.tone)}>{summaryRow.value}</p>
                                  <p className="text-[9px] leading-tight text-slate-500">{summaryRow.label} ({summaryRow.pct}%)</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </OverviewChartPanel>

                        {/* AI Delivery Insight */}
                        <Card className={cn('relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-5 shadow-[0_12px_34px_rgba(79,70,229,0.10)]', 'border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60')}>
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 opacity-85" />
                          <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
                                <Sparkles className="h-4 w-4" />
                              </span>
                              <div>
                                <h3 className="flex items-center gap-1.5 text-sm font-semibold leading-tight text-slate-900">
                                  AI Delivery Insight
                                  <Badge className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0 text-[9px] font-semibold text-indigo-600">BETA</Badge>
                                </h3>
                                <p className="mt-1 text-xs text-slate-600">Generated operational signals and recommended actions.</p>
                              </div>
                            </div>
                            <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-300" />
                          </div>

                          <ul className="min-h-0 flex-1 space-y-1.5 text-[11px] leading-snug text-slate-600">
                            {focusBlocked ? (
                              <li className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-2 py-1.5 font-medium text-rose-700">
                                <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                                Backlog focus active — {backlogCount} items queued before active flow.
                              </li>
                            ) : null}
                            {overviewTelemetry.insights.map((insight) => (
                              <li key={insight} className="flex items-start gap-1.5">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                                {insight}
                              </li>
                            ))}
                          </ul>

                          <p className="mt-3 shrink-0 text-[10px] text-slate-400">
                            Derived from live work items in your workspace scope · <span className="font-semibold text-indigo-500">TECTONA</span>
                          </p>
                          <div className="mt-2.5 flex shrink-0 flex-wrap gap-2">
                            <button type="button" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50">View Recommendation</button>
                            <button type="button" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50">Open Risk Report</button>
                            <button type="button" className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition-opacity hover:opacity-90">Create Action Plan</button>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )
                })()}
            </Panel>
          ) : null}

          {isDirectorySectionGroupActive ? (
          <div className={cn('grid grid-cols-1 gap-4', (activePanel === 'directory' || activePanel === 'ownership') && 'min-h-0 flex flex-1 flex-col')}>
            {activePanel === 'directory' ? (
            <div
              id="directory"
              ref={directoryPanelRef}
              className={cn(
                'glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40',
                'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]'
              )}
              style={directoryPanelHeightStyle}
            >
              <div className="flex h-full min-h-0 w-full flex-col">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
                  <div className="shrink-0">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ListChecks className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                          <h2 className="text-lg font-semibold text-foreground">Task & Work Directory</h2>
                        </div>
                        <p className="mt-0.5 max-w-2xl text-[11px] text-muted-foreground">
                          {directoryViewMode === 'list'
                            ? 'Master table for execution work items across projects, assignees, and workflow states.'
                            : directoryViewMode === 'kanban'
                              ? 'Board view — columns match the Status field from List. Drag cards between columns to update status.'
                              : 'Gantt timeline of due dates and progress across workspaces and projects.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 overflow-x-auto py-1 whitespace-nowrap text-xs text-muted-foreground scrollbar-hide">
                        <div
                          className="inline-flex items-center rounded-lg border border-border bg-background/80 p-0.5 shadow-sm"
                          role="group"
                          aria-label="Directory view type"
                        >
                          {DIRECTORY_VIEW_OPTIONS.map(({ mode, label, icon: Icon }) => {
                            const active = directoryViewMode === mode
                            return (
                              <button
                                key={mode}
                                type="button"
                                aria-pressed={active}
                                title={label}
                                onClick={() => setDirectoryViewMode(mode)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                                  active
                                    ? 'bg-foreground text-background shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span className="hidden sm:inline">{label}</span>
                              </button>
                            )
                          })}
                        </div>
                        {directoryViewMode === 'list' ? (
                        <div className="relative">
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Group by</span>
                            <button
                              type="button"
                              ref={groupByTriggerRef}
                              className={cn(
                                'inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition',
                                'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30',
                                groupByMenuOpen && 'ring-2 ring-inset ring-ring/30'
                              )}
                              onClick={() => {
                                if (groupByMenuOpen) {
                                  setGroupByMenuOpen(false)
                                  setGroupByMenuSearch('')
                                  return
                                }
                                const trigger = groupByTriggerRef.current
                                if (trigger) {
                                  const rect = trigger.getBoundingClientRect()
                                  setGroupByMenuAnchor({
                                    left: rect.left,
                                    top: rect.bottom + 8,
                                    width: rect.width,
                                  })
                                }
                                setGroupByMenuOpen(true)
                              }}
                              aria-expanded={groupByMenuOpen}
                              aria-haspopup="listbox"
                            >
                              <span className="min-w-[84px] text-left capitalize">{groupBy ?? 'None'}</span>
                              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                            </button>
                          </div>

                          {groupByMenuOpen && groupByMenuAnchor
                            ? createPortal(
                                <div
                                  ref={groupByMenuPanelRef}
                                  className="fixed z-[80] w-[260px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
                                  style={{
                                    left: groupByMenuAnchor.left,
                                    top: groupByMenuAnchor.top,
                                  }}
                                  role="listbox"
                                  aria-label="Group by options"
                                >
                                  <div className="p-2">
                                    <Input
                                      value={groupByMenuSearch}
                                      onChange={(e) => setGroupByMenuSearch(e.target.value)}
                                      placeholder="Search grouping options"
                                      className="h-9 text-sm"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="scrollbar-hide max-h-64 overflow-auto py-1 text-sm">
                                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                                      Recently used
                                    </div>
                                    {(
                                      [
                                        { key: 'project' as const, label: 'Project' },
                                        { key: 'workspace' as const, label: 'Workspace' },
                                        { key: 'label' as const, label: 'Label' },
                                        { key: 'type' as const, label: 'Type' },
                                        { key: 'assignee' as const, label: 'Assignee' },
                                        { key: 'priority' as const, label: 'Priority' },
                                        { key: 'status' as const, label: 'Status' },
                                      ] as const
                                    )
                                      .filter((opt) =>
                                        opt.label.toLowerCase().includes(groupByMenuSearch.trim().toLowerCase())
                                      )
                                      .map((opt) => (
                                        <button
                                          key={opt.key}
                                          type="button"
                                          role="option"
                                          aria-selected={groupBy === opt.key}
                                          className={cn(
                                            'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-muted/50',
                                            groupBy === opt.key && 'bg-muted/40 font-semibold text-foreground'
                                          )}
                                          onClick={() => {
                                            setGroupBy(opt.key)
                                            setGroupByMenuOpen(false)
                                            setGroupByMenuSearch('')
                                          }}
                                        >
                                          <span>{opt.label}</span>
                                          {groupBy === opt.key ? (
                                            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                                          ) : null}
                                        </button>
                                      ))}
                                  </div>
                                  <div className="border-t border-border">
                                    <button
                                      type="button"
                                      disabled={!groupBy}
                                      className={cn(
                                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition',
                                        groupBy
                                          ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                          : 'cursor-not-allowed text-muted-foreground/50'
                                      )}
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={() => {
                                        setGroupBy(null)
                                        setGroupByMenuOpen(false)
                                        setGroupByMenuSearch('')
                                      }}
                                    >
                                      <span>Clear selection</span>
                                    </button>
                                  </div>
                                </div>,
                                document.body
                              )
                            : null}
                        </div>
                        ) : null}
                        {directoryViewMode === 'gantt' ? (
                          <div
                            className="inline-flex items-center rounded-lg border border-border bg-background/80 p-0.5 shadow-sm"
                            role="group"
                            aria-label="Gantt zoom level"
                          >
                            {(['Day', 'Week', 'Month', 'Quarter'] as PlanningGanttZoomLevel[]).map((level) => {
                              const active = directoryGanttZoomLevel === level
                              return (
                                <button
                                  key={level}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => setDirectoryGanttZoomLevel(level)}
                                  className={cn(
                                    'rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition',
                                    active
                                      ? 'bg-foreground text-background shadow-sm'
                                      : 'text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  {level}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                        {directoryViewMode === 'list' ? (
                          <>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showDirectorySelection}
                          onClick={() => setShowDirectorySelection((prev) => !prev)}
                          className="group inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-2 py-1 shadow-sm transition hover:bg-muted/40"
                          title="Show/Hide selection checkboxes"
                        >
                          <span className="text-[11px] font-medium text-muted-foreground">Select</span>
                          <span
                            className={cn(
                              'relative h-5 w-9 rounded-full transition-colors',
                              showDirectorySelection ? 'bg-primary' : 'bg-muted'
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
                                showDirectorySelection ? 'left-0.5 translate-x-4' : 'left-0.5 translate-x-0'
                              )}
                            />
                          </span>
                        </button>
                        <p className="text-xs text-muted-foreground">
                          Showing{' '}
                          <span className="font-semibold text-foreground">{directoryTableStart}</span>
                          -
                          <span className="font-semibold text-foreground">{directoryTableEnd}</span> of{' '}
                          <span className="font-semibold text-foreground">{directoryFlatTreeRows.length}</span>
                        </p>
                        <div className="relative inline-flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Rows:</span>
                          <button
                            type="button"
                            ref={directoryPageSizeTriggerRef}
                            className={cn(
                              'inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition',
                              'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30',
                              directoryPageSizeMenuOpen && 'ring-2 ring-inset ring-ring/30'
                            )}
                            onClick={() => {
                              if (directoryPageSizeMenuOpen) {
                                setDirectoryPageSizeMenuOpen(false)
                                return
                              }
                              const trigger = directoryPageSizeTriggerRef.current
                              if (trigger) {
                                const rect = trigger.getBoundingClientRect()
                                setDirectoryPageSizeMenuAnchor({
                                  left: rect.left,
                                  top: rect.bottom + 8,
                                  width: Math.max(rect.width, 160),
                                })
                              }
                              setDirectoryPageSizeMenuOpen(true)
                            }}
                            aria-expanded={directoryPageSizeMenuOpen}
                            aria-haspopup="listbox"
                            aria-label="Rows per page"
                          >
                            <span className="min-w-[28px] text-left tabular-nums">{directoryPageSize}</span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                          </button>

                          {directoryPageSizeMenuOpen && directoryPageSizeMenuAnchor
                            ? createPortal(
                                <div
                                  ref={directoryPageSizeMenuPanelRef}
                                  className="fixed z-[80] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
                                  style={{
                                    left: directoryPageSizeMenuAnchor.left,
                                    top: directoryPageSizeMenuAnchor.top,
                                    width: directoryPageSizeMenuAnchor.width,
                                  }}
                                  role="listbox"
                                  aria-label="Rows per page options"
                                >
                                  <div className="scrollbar-hide max-h-64 overflow-auto py-1 text-sm">
                                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                                      Rows per page
                                    </div>
                                    {DIRECTORY_PAGE_SIZE_OPTIONS.map((size) => (
                                      <button
                                        key={size}
                                        type="button"
                                        role="option"
                                        aria-selected={directoryPageSize === size}
                                        className={cn(
                                          'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-muted/50',
                                          directoryPageSize === size && 'bg-muted/40 font-semibold text-foreground'
                                        )}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onClick={() => {
                                          setDirectoryPageSize(size)
                                          setPage(1)
                                          setDirectoryPageSizeMenuOpen(false)
                                        }}
                                      >
                                        <span className="tabular-nums">{size}</span>
                                        {directoryPageSize === size ? (
                                          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                                        ) : null}
                                      </button>
                                    ))}
                                  </div>
                                </div>,
                                document.body
                              )
                            : null}
                        </div>
                        <div className="flex h-10 items-stretch gap-0.5 rounded-lg border border-border bg-background/80 p-0.5 shadow-sm">
                          <button
                            type="button"
                            className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={directoryPageSafe <= 1}
                          >
                            Previous
                          </button>
                          <div className="flex items-center justify-center px-2 text-xs text-muted-foreground tabular-nums">
                            {directoryPageSafe} / {directoryTotalPages}
                          </div>
                          <button
                            type="button"
                            className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                            onClick={() => setPage((prev) => Math.min(directoryTotalPages, prev + 1))}
                            disabled={directoryPageSafe >= directoryTotalPages}
                          >
                            Next
                          </button>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            ref={directoryColumnsTriggerRef}
                            className={cn(
                              'inline-flex items-center justify-center text-muted-foreground transition',
                              'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30',
                              directoryColumnsMenuOpen && 'text-foreground ring-2 ring-inset ring-ring/30'
                            )}
                            onClick={() => {
                              if (directoryColumnsMenuOpen) {
                                setDirectoryColumnsMenuOpen(false)
                                setDirectoryColumnsMenuSearch('')
                                return
                              }
                              const trigger = directoryColumnsTriggerRef.current
                              if (trigger) {
                                const rect = trigger.getBoundingClientRect()
                                setDirectoryColumnsMenuAnchor({
                                  left: rect.right - 260,
                                  top: rect.bottom + 12,
                                  width: 260,
                                })
                              }
                              setDirectoryColumnsMenuOpen(true)
                            }}
                            aria-expanded={directoryColumnsMenuOpen}
                            aria-haspopup="listbox"
                            aria-label="Show or hide columns"
                            title="Show or hide columns"
                          >
                            <Columns2 className="h-6 w-6 text-muted-foreground" aria-hidden />
                          </button>

                          {directoryColumnsMenuOpen && directoryColumnsMenuAnchor
                            ? createPortal(
                                <div
                                  ref={directoryColumnsMenuPanelRef}
                                  className="fixed z-[80] w-[260px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
                                  style={{
                                    left: directoryColumnsMenuAnchor.left,
                                    top: directoryColumnsMenuAnchor.top,
                                  }}
                                  role="listbox"
                                  aria-label="Column visibility options"
                                >
                                  <div className="border-b border-border px-3 pb-2.5 pt-3.5">
                                    <p className="text-xs font-semibold text-foreground">Columns</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">Show or hide table columns</p>
                                  </div>
                                  <div className="px-3 pb-2.5 pt-2.5">
                                    <Input
                                      value={directoryColumnsMenuSearch}
                                      onChange={(e) => setDirectoryColumnsMenuSearch(e.target.value)}
                                      placeholder="Search columns"
                                      className="h-9 text-sm"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="scrollbar-hide max-h-64 overflow-auto py-1 text-sm">
                                    {directoryColumnOrder.filter((key) =>
                                      directoryColumnLabel(key)
                                        .toLowerCase()
                                        .includes(directoryColumnsMenuSearch.trim().toLowerCase())
                                    ).map((key) => {
                                      const isVisible = !directoryHiddenColumns.has(key)
                                      const isOnlyVisibleColumn = isVisible && directoryVisibleColumnOrder.length <= 1
                                      return (
                                        <button
                                          key={key}
                                          type="button"
                                          role="option"
                                          aria-selected={isVisible}
                                          disabled={isOnlyVisibleColumn}
                                          className={cn(
                                            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted/50',
                                            isVisible && 'font-medium text-foreground',
                                            isOnlyVisibleColumn && 'cursor-not-allowed opacity-60'
                                          )}
                                          onClick={() => toggleDirectoryColumnVisibility(key)}
                                        >
                                          <span>{directoryColumnLabel(key)}</span>
                                          {isVisible ? (
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                                          ) : (
                                            <span className="h-4 w-4 shrink-0 rounded-full border border-border" aria-hidden />
                                          )}
                                        </button>
                                      )
                                    })}
                                  </div>
                                  {directoryHiddenColumns.size > 0 ? (
                                    <div className="border-t border-border">
                                      <button
                                        type="button"
                                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onClick={() => {
                                          setDirectoryHiddenColumns(new Set())
                                          setDirectoryColumnsMenuOpen(false)
                                          setDirectoryColumnsMenuSearch('')
                                        }}
                                      >
                                        <span>Show all columns</span>
                                      </button>
                                    </div>
                                  ) : null}
                                </div>,
                                document.body
                              )
                            : null}
                        </div>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Showing{' '}
                            <span className="font-semibold text-foreground">{filteredItems.length}</span> work item
                            {filteredItems.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {directoryReparentHint ? (
                      <div
                        className={cn(
                          'mt-2 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px]',
                          directoryReparentHint.startsWith('Saved locally')
                            ? 'border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100'
                            : 'border-rose-200/80 bg-rose-50/90 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100'
                        )}
                      >
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{directoryReparentHint}</span>
                      </div>
                    ) : null}

                    {selectedIds.length > 0 ? (
                      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-sky-200/80 bg-sky-50/80 px-3 py-2.5 text-[11px] text-slate-800 sm:flex-row sm:items-center sm:justify-between dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
                        <span>
                          <span className="font-semibold">{selectedIds.length} work item{selectedIds.length !== 1 ? 's' : ''} selected</span>
                          <span className="mx-1 text-muted-foreground">—</span>
                          <span className="text-muted-foreground">Bulk update status, reassign, or archive from the action bar.</span>
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="h-8" onClick={() => openBulkAction('status')}>
                            Update Status
                          </Button>
                          <Button variant="outline" size="sm" className="h-8" onClick={() => openBulkAction('assignee')}>
                            Reassign
                          </Button>
                          <Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedIds([])}>Clear</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={cn(
                      'scrollbar-hide min-h-0 w-full min-w-0 flex-1',
                      sortedItems.length === 0 || directoryDataLoading || Boolean(workItemsLoadError)
                        ? 'flex flex-col items-center justify-center overflow-hidden overflow-y-auto rounded-xl bg-gradient-to-b from-muted/50 via-background to-background py-8 dark:from-muted/25'
                        : directoryViewMode === 'kanban'
                          ? 'flex min-h-0 flex-col overflow-hidden border-t border-border/40'
                          : directoryViewMode === 'gantt'
                            ? 'flex min-h-0 flex-col overflow-hidden rounded-xl'
                            : 'overflow-auto rounded-xl'
                    )}
                  >
                    {directoryDataLoading ? (
                      <div className="flex w-full flex-col items-center justify-center px-6 py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
                        <p className="mt-4 text-sm text-muted-foreground">Loading work items…</p>
                      </div>
                    ) : workItemsLoadError ? (
                      <div className="flex w-full flex-col items-center justify-center px-6">
                        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-rose-200/80 bg-rose-50/90 px-8 py-11 text-center dark:border-rose-900/50 dark:bg-rose-950/40">
                          <CircleAlert className="mx-auto h-10 w-10 text-rose-600" aria-hidden />
                          <p className="mt-5 text-lg font-semibold tracking-tight text-rose-950 dark:text-rose-100">Work directory unavailable</p>
                          <p className="mt-2 text-sm leading-relaxed text-rose-900/90 dark:text-rose-100/90">
                            Connect the Work Management API (port 8432) to view and manage work items.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className={cn('mt-5', registerServicePrimaryButtonClass())}
                            onClick={() => void reloadWorkItemsFromApi()}
                          >
                            Try again
                          </Button>
                        </div>
                      </div>
                    ) : sortedItems.length === 0 ? (
                      <div className="flex w-full flex-col items-center justify-center px-6">
                        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card/85 px-8 py-11 text-center shadow-[0_22px_55px_-18px_rgba(15,23,42,0.12)] backdrop-blur-md dark:bg-slate-950/75">
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-400/35 to-transparent" />
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-muted/80 ring-1 ring-border/70 dark:bg-white/[0.06]">
                            <Filter className="h-7 w-7 text-muted-foreground" aria-hidden />
                          </div>
                          {visibleWorkItems.length === 0 && !isPlatformAdmin ? (
                            <>
                              <p className="mt-5 text-lg font-semibold tracking-tight text-foreground">No workspaces in your scope</p>
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Join or create a workspace to see work items here. Shared directory data from other workspaces stays hidden until you are a member.
                              </p>
                            </>
                          ) : (
                            <>
                          <p className="mt-5 text-lg font-semibold tracking-tight text-foreground">No work items match</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Adjust search or filters to restore the operational directory view.
                          </p>
                            </>
                          )}
                        </div>
                      </div>
                    ) : directoryViewMode === 'kanban' ? (
                      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
                        <DirectoryKanbanView
                          items={directoryKanbanItems}
                          onItemClick={(id) => setDrawer({ open: true, workItemId: id })}
                          onStatusChange={handleKanbanStatusChange}
                          onTitleChange={handleKanbanTitleChange}
                        />
                      </div>
                    ) : directoryViewMode === 'gantt' ? (
                      filteredItems.length === 0 ? (
                        <div className="flex w-full flex-col items-center justify-center px-6 py-12">
                          <GanttChartSquare className="h-10 w-10 text-muted-foreground" aria-hidden />
                          <p className="mt-4 text-sm font-semibold text-foreground">No work items</p>
                          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                            Adjust search or filters to show tasks on the Gantt timeline.
                          </p>
                        </div>
                      ) : (
                        <PlanningSvarGantt
                          items={directoryGanttItems}
                          layout="project-tree"
                          columns={DIRECTORY_GANTT_GRID_COLUMNS}
                          zoomLevel={directoryGanttZoomLevel}
                          selectedId={directoryGanttSelectedId}
                          onSelect={(id) => {
                            setDirectoryGanttSelectedId(id)
                            setDrawer({ open: true, workItemId: id })
                          }}
                        />
                      )
                    ) : (
                      <DndContext sensors={directoryColumnDndSensors} onDragEnd={handleDirectoryColumnDragEnd}>
                        <DndContext
                          sensors={directoryRowDndSensors}
                          collisionDetection={directoryRowCollisionDetection}
                          onDragStart={handleDirectoryRowDragStart}
                          onDragOver={handleDirectoryRowDragOver}
                          onDragEnd={handleDirectoryRowDragEnd}
                          onDragCancel={handleDirectoryRowDragCancel}
                        >
                          <table
                            className={cn(
                              'w-full min-w-[960px] border-separate border-spacing-0 text-xs select-none',
                              (Object.keys(directoryColumnWidthsPx).length > 0 || directoryColumnResizingKey) &&
                                'table-fixed'
                            )}
                          >
                            <thead className="sticky top-0 z-10">
                              <tr className="text-left text-muted-foreground">
                                {showDirectorySelection ? (
                                  <th className="w-10 select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.length > 0 && selectedIds.length === directoryTableRows.length}
                                      onChange={() =>
                                        setSelectedIds(
                                          selectedIds.length === directoryTableRows.length
                                            ? []
                                            : directoryTableRows.map((row) => row.item.id)
                                        )
                                      }
                                      aria-label="Select all rows on this page"
                                    />
                                  </th>
                                ) : null}
                                <SortableContext items={directoryVisibleColumnOrder} strategy={rectSortingStrategy}>
                                  {directoryVisibleColumnOrder.map((key) => (
                                    <SortableDirectoryHeaderCell key={key} columnKey={key} />
                                  ))}
                                </SortableContext>
                              </tr>
                            </thead>
                            <SortableContext items={directoryRowSortableIds} strategy={verticalListSortingStrategy}>
                              <tbody>
                          {directoryTableRows.map((row, rowIndex) => {
                            const { item, depth, hasChildren, isExpanded, groupLabel: rowGroupLabel } = row
                            const directoryTableColSpan =
                              directoryVisibleColumnOrder.length + (showDirectorySelection ? 1 : 0)
                            const showDropBefore =
                              directoryRowDropTarget?.itemId === item.id &&
                              directoryRowDropTarget.side === 'before'
                            const showDropAfter =
                              directoryRowDropTarget?.itemId === item.id &&
                              directoryRowDropTarget.side === 'after'
                            const previousGroupLabel = directoryTableRows[rowIndex - 1]?.groupLabel ?? null
                            const showGroupHeader = groupBy && rowGroupLabel && rowGroupLabel !== previousGroupLabel
                            const groupTint =
                              groupBy && rowGroupLabel ? getDirectoryGroupTint(groupBy, rowGroupLabel) : null
                            const isRowSelected = selectedIds.includes(item.id)
                            const directoryInlineDisabled = Boolean(workItemsLoadError)
                            const resolveDirectoryBodyCellBackground = (isFirstColumn: boolean) => {
                              if (isRowSelected) return ''
                              const stickyFirstClass =
                                freezeDirectoryFirstColumn && isFirstColumn ? directoryFrozenBodyCellClass : ''
                              if (groupTint) {
                                return cn(isFirstColumn ? groupTint.first : groupTint.row, stickyFirstClass)
                              }
                              if (freezeDirectoryFirstColumn && isFirstColumn) {
                                return cn(DIRECTORY_FIRST_COLUMN_TINT_BODY_CLASS, stickyFirstClass)
                              }
                              if (isFirstColumn) return DIRECTORY_FIRST_COLUMN_TINT_BODY_CLASS
                              return stickyFirstClass
                            }
                            const directoryTableCellClass = cn(
                              'border-b border-slate-200/20 px-3 py-2 align-top transition-colors dark:border-slate-700/20',
                              isRowSelected
                                ? 'bg-primary/10'
                                : groupTint
                                  ? 'group-hover:brightness-[0.98] dark:group-hover:brightness-110'
                                  : 'group-hover:bg-accent/20'
                            )

                            return (
                              <Fragment key={item.id}>
                                {showGroupHeader ? (
                                  <tr>
                                    <td
                                      colSpan={directoryVisibleColumnOrder.length + (showDirectorySelection ? 1 : 0)}
                                      className={cn(
                                        'px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
                                        groupTint?.first
                                      )}
                                    >
                                      {groupBy}: {formatDirectoryGroupLabel(groupBy, rowGroupLabel, boardColumnLabels)}
                                    </td>
                                  </tr>
                                ) : null}
                                {showDropBefore ? (
                                  <tr className="pointer-events-none">
                                    <td colSpan={directoryTableColSpan} className="border-none p-0">
                                      <DirectoryInsertIndicator />
                                    </td>
                                  </tr>
                                ) : null}
                                <DirectorySortableRowShell
                                  rowId={item.id}
                                  className={cn(
                                    'group cursor-pointer transition-colors',
                                    directoryRowContextMenu?.workItem.id === item.id && 'bg-accent/30'
                                  )}
                                  onClick={(event) => {
                                    if (directoryDragJustEndedRef.current) return
                                    const target = event.target as HTMLElement
                                    if (
                                      target.closest('button') ||
                                      target.closest('input') ||
                                      target.closest('select') ||
                                      target.closest('[data-directory-inline-cell]')
                                    ) {
                                      return
                                    }
                                    setDrawer({ open: true, workItemId: item.id })
                                  }}
                                  onContextMenu={(event) => {
                                    if (workItemsLoadError) return
                                    const target = event.target as HTMLElement
                                    if (
                                      target.closest('button') ||
                                      target.closest('input') ||
                                      target.closest('[data-directory-drag-handle]')
                                    ) {
                                      return
                                    }
                                    event.preventDefault()
                                    event.stopPropagation()
                                    setDirectoryRowContextMenu({
                                      x: event.clientX,
                                      y: event.clientY,
                                      workItem: item,
                                      rowIndex,
                                    })
                                  }}
                                >
                                  {({ dragHandleProps }) => (
                                    <>
                                  {showDirectorySelection ? (
                                    <td
                                      className={cn(directoryTableCellClass, resolveDirectoryBodyCellBackground(false))}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => toggleSelection(item.id)}
                                        aria-label={`Select ${item.title}`}
                                      />
                                    </td>
                                  ) : null}
                                  {directoryVisibleColumnOrder.map((columnKey) => {
                                    const isFirstDirectoryColumn = directoryVisibleColumnOrder[0] === columnKey
                                    const cellClass = cn(
                                      directoryTableCellClass,
                                      resolveDirectoryBodyCellBackground(isFirstDirectoryColumn)
                                    )
                                    const cellStyle = directoryColumnWidthStyle(columnKey)
                                    switch (columnKey) {
                                      case 'title':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle}>
                                            <div className="flex min-w-0 items-start gap-1.5" style={{ paddingLeft: depth * 18 }}>
                                              <button
                                                type="button"
                                                data-directory-drag-handle
                                                className="mt-0.5 inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/70 transition hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
                                                title="Drag to reorder row"
                                                aria-label={`Drag to reorder ${item.title}`}
                                                {...dragHandleProps}
                                              >
                                                <GripVertical className="h-3.5 w-3.5" aria-hidden />
                                              </button>
                                              {hasChildren ? (
                                                <button
                                                  type="button"
                                                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                                                  onClick={(event) => {
                                                    event.stopPropagation()
                                                    toggleDirectoryTreeExpand(item.id)
                                                  }}
                                                  aria-label={isExpanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
                                                  aria-expanded={isExpanded}
                                                >
                                                  {isExpanded ? (
                                                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                                                  ) : (
                                                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                                                  )}
                                                </button>
                                              ) : null}
                                              <div className="min-w-0 flex-1">
                                                <DirectoryInlineTextCell
                                                  value={item.title}
                                                  ariaLabel={`Task title for ${item.id}`}
                                                  disabled={directoryInlineDisabled}
                                                  inputClassName="text-sm font-semibold"
                                                  className="font-semibold text-foreground"
                                                  onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'title', value)}
                                                />
                                                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.id}</div>
                                                <WorkItemSourceBadges links={item.externalLinks} syncOrigin={item.syncOrigin} />
                                              </div>
                                            </div>
                                          </td>
                                        )
                                      case 'type':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle} onClick={(event) => event.stopPropagation()}>
                                            <DirectoryInlineSelectCell
                                              value={item.type}
                                              ariaLabel={`Type for ${item.title}`}
                                              disabled={directoryInlineDisabled}
                                              options={WORK_ITEM_TYPE_OPTIONS.map((option) => ({
                                                value: option.type,
                                                label: option.label,
                                              }))}
                                              renderOption={(option, selected) => {
                                                const meta = WORK_ITEM_TYPE_META[option.value as WorkItemType]
                                                const OptionIcon = meta.icon
                                                return (
                                                  <>
                                                    <span className="flex items-center gap-2">
                                                      <OptionIcon
                                                        className={cn(
                                                          'h-4 w-4 shrink-0',
                                                          selected ? 'text-primary-foreground' : meta.iconClass
                                                        )}
                                                        aria-hidden
                                                      />
                                                      {option.label}
                                                    </span>
                                                    {selected ? (
                                                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                                                    ) : null}
                                                  </>
                                                )
                                              }}
                                              onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'type', value)}
                                            >
                                              <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium">
                                                <WorkItemTypeIcon type={item.type} className="h-3 w-3" />
                                                {item.type}
                                              </Badge>
                                            </DirectoryInlineSelectCell>
                                          </td>
                                        )
                                      case 'project':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle} onClick={(event) => event.stopPropagation()}>
                                            <DirectoryInlineTextCell
                                              value={item.project ?? ''}
                                              ariaLabel={`Project for ${item.title}`}
                                              disabled={directoryInlineDisabled}
                                              className="font-semibold text-foreground"
                                              onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'project', value)}
                                            />
                                          </td>
                                        )
                                      case 'workspace':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle} onClick={(event) => event.stopPropagation()}>
                                            <DirectoryInlineSelectCell
                                              value={item.workspace}
                                              ariaLabel={`Workspace for ${item.title}`}
                                              disabled={directoryInlineDisabled}
                                              options={Array.from(
                                                new Set([...filterOptions.workspaces, item.workspace].filter(Boolean))
                                              ).map((workspace) => ({
                                                value: workspace,
                                                label: workspace,
                                              }))}
                                              onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'workspace', value)}
                                            >
                                              <span className="font-semibold text-foreground">{item.workspace}</span>
                                            </DirectoryInlineSelectCell>
                                          </td>
                                        )
                                      case 'label':
                                      case 'board': {
                                        const directoryLabel = resolveWorkItemDirectoryLabel(item)
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle} onClick={(event) => event.stopPropagation()}>
                                            <DirectoryInlineTextCell
                                              value={directoryLabel}
                                              ariaLabel={`Label for ${item.title}`}
                                              disabled={directoryInlineDisabled}
                                              className="inline-flex"
                                              display={
                                                directoryLabel ? (
                                                  <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                                    <Tag className="h-3 w-3 text-slate-400" aria-hidden />
                                                    {directoryLabel}
                                                  </Badge>
                                                ) : undefined
                                              }
                                              emptyDisplay={
                                                <span className="text-[11px] text-muted-foreground">—</span>
                                              }
                                              onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'label', value)}
                                            />
                                          </td>
                                        )
                                      }
                                      case 'assignee':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle} onClick={(event) => event.stopPropagation()}>
                                            <DirectoryInlineSelectCell
                                              value={item.assignee || 'Unassigned'}
                                              ariaLabel={`Assignee for ${item.title}`}
                                              disabled={directoryInlineDisabled}
                                              menuMinWidth={220}
                                              options={resolveWorkspaceAssigneeOptions(item.workspace, item.assignee).map(
                                                (assignee) => ({
                                                  value: assignee,
                                                  label: assignee,
                                                })
                                              )}
                                              renderOption={(option, selected) => (
                                                <>
                                                  <span className="flex items-center gap-2">
                                                    <WorkItemPersonAvatar name={option.label} size="sm" />
                                                    <span>{option.label}</span>
                                                  </span>
                                                  {selected ? (
                                                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                                                  ) : null}
                                                </>
                                              )}
                                              onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'assignee', value)}
                                            >
                                              <div className="flex items-center gap-2">
                                                <WorkItemPersonAvatar name={item.assignee} size="sm" />
                                                <span className="font-semibold text-foreground">{item.assignee}</span>
                                              </div>
                                            </DirectoryInlineSelectCell>
                                          </td>
                                        )
                                      case 'status':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle} onClick={(event) => event.stopPropagation()}>
                                            <DirectoryInlineSelectCell
                                              value={item.status}
                                              ariaLabel={`Status for ${item.title}`}
                                              disabled={directoryInlineDisabled}
                                              className="hover:bg-transparent"
                                              options={WORK_STATUS_VALUES.map((status) => ({
                                                value: status,
                                                label: resolveWorkStatusDisplayLabel(status, boardColumnLabels),
                                              }))}
                                              renderOption={(option, selected) => (
                                                <>
                                                  <span className="flex items-center gap-2">
                                                    <WorkItemStatusIcon
                                                      status={option.value as WorkStatus}
                                                      className={cn('h-4 w-4 shrink-0', selected && 'text-primary-foreground')}
                                                    />
                                                    {option.label}
                                                  </span>
                                                  {selected ? (
                                                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                                                  ) : null}
                                                </>
                                              )}
                                              onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'status', value)}
                                            >
                                              <StatusBadge status={item.status} />
                                            </DirectoryInlineSelectCell>
                                          </td>
                                        )
                                      case 'priority':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle} onClick={(event) => event.stopPropagation()}>
                                            <DirectoryInlineSelectCell
                                              value={item.priority}
                                              ariaLabel={`Priority for ${item.title}`}
                                              disabled={directoryInlineDisabled}
                                              className="hover:bg-transparent"
                                              options={PRIORITY_OPTIONS.map((priority) => ({
                                                value: priority,
                                                label: priority,
                                              }))}
                                              renderOption={(option, selected) => (
                                                <>
                                                  <span className="flex items-center gap-2">
                                                    <span
                                                      className={cn(
                                                        'h-2.5 w-2.5 shrink-0 rounded-full',
                                                        PRIORITY_META[option.value as Priority].dot
                                                      )}
                                                      aria-hidden
                                                    />
                                                    {option.label}
                                                  </span>
                                                  {selected ? (
                                                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                                                  ) : null}
                                                </>
                                              )}
                                              onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'priority', value)}
                                            >
                                              <PriorityChip priority={item.priority} />
                                            </DirectoryInlineSelectCell>
                                          </td>
                                        )
                                      case 'dueDate':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle} onClick={(event) => event.stopPropagation()}>
                                            <DirectoryInlineDateCell
                                              value={item.dueDate}
                                              ariaLabel={`Due date for ${item.title}`}
                                              disabled={directoryInlineDisabled}
                                              onCommit={(value) => handleDirectoryFieldUpdate(item.id, 'dueDate', value)}
                                            />
                                          </td>
                                        )
                                      case 'progress':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle}>
                                            <div className="flex min-w-[88px] items-center gap-2">
                                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                                <div
                                                  className="h-full rounded-full bg-blue-600"
                                                  style={{ width: `${item.progress}%` }}
                                                />
                                              </div>
                                              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{item.progress}%</span>
                                            </div>
                                          </td>
                                        )
                                      case 'dependency':
                                        return (
                                          <td key={columnKey} className={cellClass} style={cellStyle}>
                                            <DependencyBadge status={item.dependencyStatus} />
                                          </td>
                                        )
                                      default:
                                        return null
                                    }
                                  })}
                                    </>
                                  )}
                                </DirectorySortableRowShell>
                                {showDropAfter ? (
                                  <tr className="pointer-events-none">
                                    <td colSpan={directoryTableColSpan} className="border-none p-0">
                                      <DirectoryInsertIndicator />
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            )
                          })}
                            </tbody>
                            </SortableContext>
                          </table>
                          {typeof document !== 'undefined'
                            ? createPortal(
                                <DragOverlay zIndex={1500} dropAnimation={null} adjustScale={false} className="cursor-grabbing">
                                  {directoryRowDragOverlayItem ? (
                                    <div
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900"
                                      style={{ width: directoryRowDragWidthPx, maxWidth: '96vw' }}
                                    >
                                      <div className="text-sm font-semibold text-foreground">{directoryRowDragOverlayItem.title}</div>
                                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{directoryRowDragOverlayItem.id}</div>
                                    </div>
                                  ) : null}
                                </DragOverlay>,
                                document.body
                              )
                            : null}
                        </DndContext>
                      </DndContext>
                    )}
                  </div>
                </div>
              </div>
            </div>
            ) : null}

            {activePanel === 'workflow' || activePanel === 'ownership' ? (
            <div className={cn('space-y-4', activePanel === 'ownership' && 'flex min-h-0 flex-1 flex-col')}>
              {activePanel === 'workflow' ? (
              <Panel
                id="workflow"
                title="Workflow Status Management Panel"
                description="Stage distribution, bottleneck indicators, and compact execution swimlanes for workflow visibility."
                highlight={activePanel === 'workflow'}
                outerRef={activeMainPanelRef}
              >
                <div className="grid grid-cols-1 gap-3">
                  {workflowDistribution.map((stage) => (
                    <div key={stage.stage} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={stage.stage as WorkStatus} />
                          <span className="text-sm font-semibold text-slate-800">{stage.stage}</span>
                        </div>
                        <span className="text-lg font-bold text-slate-900">{stage.count}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div className={cn('h-2 rounded-full', stage.stage === 'Backlog' ? 'bg-violet-500' : stage.stage === 'Done' ? 'bg-emerald-500' : 'bg-blue-600')} style={{ width: `${Math.max(10, (stage.count / summary.total) * 100)}%` }} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {['Update Status', 'Configure State Rules', 'Move Task Between States'].map((action) => (
                          <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">{action}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
              ) : null}

              {activePanel === 'ownership' ? (
              <div
                id="ownership"
                ref={activeMainPanelRef}
                className={cn(
                  'glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40',
                  'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]'
                )}
                style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              >
                <div className="flex h-full min-h-0 w-full flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
                    <OwnershipAssignmentPanel
                      items={visibleWorkItems}
                      search={deferredSearch}
                      disabled={Boolean(workItemsLoadError)}
                      assigneeOptions={filterOptions.assignees}
                      resolveAssigneeOptions={(item) =>
                        resolveWorkspaceAssigneeOptions(item.workspace, item.assignee)
                      }
                      onOpenItem={(id) => setDrawer({ open: true, workItemId: id })}
                      onAssign={(id, assignee) => handleDirectoryFieldUpdate(id, 'assignee', assignee)}
                      onBulkAssign={handleOwnershipBulkAssign}
                    />
                      </div>
                      </div>
                      </div>
              ) : null}
            </div>
            ) : null}
          </div>
          ) : null}

          {isStructureSectionGroupActive ? (
          <div className={cn('grid grid-cols-1 gap-4', (activePanel === 'structure' || activePanel === 'dependencies') && 'min-h-0 flex flex-1 flex-col')}>
            {(activePanel === 'structure' || activePanel === 'dependencies') ? (
            <div className={cn((activePanel === 'structure' || activePanel === 'dependencies') && 'min-h-0 flex flex-1 flex-col')}>
              {activePanel === 'structure' ? (
              <div
                id="structure"
                ref={activeMainPanelRef}
                className={cn(
                  'glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40',
                  'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]'
                )}
                style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              >
                <div className="flex h-full min-h-0 w-full flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
                    <EpicStructureTreePanel
                      items={structureBrowseItems}
                      disabled={Boolean(workItemsLoadError)}
                      reparentHint={directoryReparentHint}
                      onOpenItem={(id) => setDrawer({ open: true, workItemId: id })}
                      onAddEpic={openCreateEpicFromStructure}
                      onAddChild={(parent, childType) => {
                        const full = visibleWorkItems.find((item) => item.id === parent.id)
                        if (!full) return
                        openWorkItemAddDrawerForParent(full, childType, { stayOnPanel: true })
                      }}
                      onCanDrop={(draggedId, parentId) => canReparentWorkItem(draggedId, parentId, workItems)}
                      onReparent={(draggedId, parentId) => {
                        void handleDirectoryReparent(draggedId, parentId)
                      }}
                      onCanDetach={(draggedId) => {
                        const item = workItems.find((entry) => entry.id === draggedId)
                        return item ? canDetachStructureItem(item, workItems) : false
                      }}
                      onDetach={(draggedId) => {
                        void handleStructureDetach(draggedId)
                      }}
                      onReparentRejected={(message) => setDirectoryReparentHint(message)}
                    />
                          </div>
                        </div>
                        </div>
              ) : null}

              {activePanel === 'dependencies' ? (
              <div
                id="dependencies"
                ref={activeMainPanelRef}
                className={cn(
                  'glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40',
                  'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]'
                )}
                style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              >
                <div className="flex h-full min-h-0 w-full flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
                    <DependencyManagementPanel
                      items={visibleWorkItems}
                      search={deferredSearch}
                      disabled={Boolean(workItemsLoadError)}
                      addOpenRequestToken={dependencyAddOpenToken}
                      onOpenItem={(id) => setDrawer({ open: true, workItemId: id })}
                      onDependenciesChanged={() => {
                        void reloadWorkItemsFromApi()
                      }}
                    />
                  </div>
                      </div>
                    </div>
              ) : null}
            </div>
            ) : null}

            {(activePanel === 'time' || activePanel === 'activity') ? (
            <div className="space-y-4">
              {activePanel === 'time' ? (
              <Panel
                id="time"
                title="Time Tracking & Worklog Panel"
                description="Planned vs actual effort, remaining hours, variance, and recent worklogs."
                highlight={activePanel === 'time'}
                outerRef={activeMainPanelRef}
              >
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Estimated</div><div className="mt-2 text-2xl font-bold text-slate-900">{timeSummary.estimated}h</div></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Logged</div><div className="mt-2 text-2xl font-bold text-slate-900">{timeSummary.actual}h</div></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Remaining</div><div className="mt-2 text-2xl font-bold text-slate-900">{timeSummary.remaining}h</div></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Variance</div><div className={cn('mt-2 text-2xl font-bold', timeSummary.variance > 0 ? 'text-rose-700' : 'text-emerald-700')}>{timeSummary.variance > 0 ? '+' : ''}{timeSummary.variance}h</div></div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/90 text-slate-600">
                      <tr>
                        {['User', 'Date', 'Task', 'Hours logged', 'Note'].map((header) => (
                          <th key={header} className="px-3 py-3 text-left font-semibold">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WORKLOGS.map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-100 bg-white/90">
                          <td className="px-3 py-3 text-slate-800">{entry.user}</td>
                          <td className="px-3 py-3 text-slate-700">{entry.date}</td>
                          <td className="px-3 py-3 text-slate-700">{workMap[entry.taskId]?.title}</td>
                          <td className="px-3 py-3 font-medium text-slate-900">{entry.hours}h</td>
                          <td className="px-3 py-3 text-slate-700">{entry.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {['Log Time', 'Edit Worklog', 'View Time Summary'].map((action) => (
                    <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">{action}</button>
                  ))}
                </div>
              </Panel>
              ) : null}

              {activePanel === 'activity' ? (
              <Panel
                id="activity"
                title="Activity Log & History Panel"
                description="Audit-friendly execution history across task creation, assignment changes, status movement, dependency changes, and time logging."
                highlight={activePanel === 'activity'}
                outerRef={activeMainPanelRef}
              >
                <div className="space-y-3">
                  {ACTIVITIES.map((entry) => (
                    <div key={entry.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="rounded-full border border-blue-200 bg-blue-50 p-2 text-blue-700">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">{entry.action}</div>
                          <div className="text-[11px] text-slate-500">{entry.timestamp}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">{entry.actor} - {entry.objectRef}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
              ) : null}
            </div>
            ) : null}
          </div>
          ) : null}
        </div>
      </div>
      </div>

      {typeof document !== 'undefined'
        ? createPortal(
            <>
              <div
                className={cn(
                  'fixed inset-0 z-[1050] bg-black/20 backdrop-blur-sm transition-opacity',
                  workItemAddOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                )}
                onClick={closeWorkItemAddDrawer}
                aria-hidden="true"
              />

              <div
                className={cn(
                  'fixed top-0 right-0 z-[1100] flex h-screen w-[460px] max-w-[92vw] transform flex-col transition-all duration-300',
                  'border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl',
                  workItemAddOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'
                )}
                style={{
                  boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
                  margin: 0,
                  padding: 0,
                }}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 backdrop-blur-sm">
                  <div className="pr-3">
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                      <Plus className="h-5 w-5 text-primary" aria-hidden />
                      Add Work Item
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create execution work items for tasks, subtasks, epics, and checklist entries across projects and workspaces.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={closeWorkItemAddDrawer}
                    disabled={workItemAddSaving}
                    aria-label="Close add work item drawer"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleWorkItemCreate(false)
                  }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div
                    ref={workItemAddScrollRef}
                    className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 scrollbar-hide"
                  >
                    {workItemFormError ? (
                      <div className="flex items-start gap-2 rounded-xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-[11px] text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{workItemFormError}</span>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label id="work-item-type-label" className="text-xs text-muted-foreground">
                        Type <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <button
                          type="button"
                          ref={workItemTypeTriggerRef}
                          id="work-item-type"
                          aria-labelledby="work-item-type-label"
                          aria-expanded={workItemTypeMenuOpen}
                          aria-haspopup="listbox"
                          className={cn(
                            'inline-flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition',
                            'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
                          )}
                          onClick={() => {
                            if (workItemTypeMenuOpen) {
                              setWorkItemTypeMenuOpen(false)
                              return
                            }
                            const trigger = workItemTypeTriggerRef.current
                            if (trigger) {
                              const rect = trigger.getBoundingClientRect()
                              setWorkItemTypeMenuAnchor({
                                left: rect.left,
                                top: rect.bottom + 8,
                                width: rect.width,
                              })
                            }
                            setWorkItemTypeMenuOpen(true)
                          }}
                        >
                          <WorkItemTypeIcon type={workItemFormType} />
                          <span className="min-w-0 flex-1 text-left">{workItemFormType}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        </button>

                        {workItemTypeMenuOpen && workItemTypeMenuAnchor
                          ? createPortal(
                              <div
                                ref={workItemTypeMenuPanelRef}
                                className="fixed z-[1200] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
                                style={{
                                  left: workItemTypeMenuAnchor.left,
                                  top: workItemTypeMenuAnchor.top,
                                  width: workItemTypeMenuAnchor.width,
                                }}
                                role="listbox"
                                aria-label="Work item type options"
                              >
                                <div className="py-1 text-sm">
                                  {WORK_ITEM_TYPE_OPTIONS.map((option) => {
                                    const OptionIcon = option.icon
                                    return (
                                      <button
                                        key={option.type}
                                        type="button"
                                        role="option"
                                        aria-selected={workItemFormType === option.type}
                                        className={cn(
                                          'flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-muted/50',
                                          workItemFormType === option.type && 'bg-primary text-primary-foreground hover:bg-primary'
                                        )}
                                        onClick={() => {
                                          setWorkItemFormType(option.type)
                                          setWorkItemTypeMenuOpen(false)
                                        }}
                                      >
                                        <span className="flex items-center gap-2">
                                          <OptionIcon
                                            className={cn(
                                              'h-4 w-4 shrink-0',
                                              workItemFormType === option.type ? 'text-primary-foreground' : option.iconClass
                                            )}
                                            aria-hidden
                                          />
                                          {option.label}
                                        </span>
                                        {workItemFormType === option.type ? (
                                          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                                        ) : null}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>,
                              document.body
                            )
                          : null}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="work-item-title" className="text-xs text-muted-foreground">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="work-item-title"
                        ref={workItemTitleInputRef}
                        value={workItemFormTitle}
                        onChange={(event) => setWorkItemFormTitle(event.target.value)}
                        maxLength={200}
                        placeholder="Short and descriptive"
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="work-item-description" className="text-xs text-muted-foreground">
                        Description
                      </Label>
                      <EnterpriseRichTextEditor
                        id="work-item-description"
                        value={workItemFormDescription}
                        onChange={setWorkItemFormDescription}
                        placeholder="Execution context, acceptance notes, or delivery scope"
                        maxPlainTextLength={2000}
                        disabled={workItemAddSaving}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="work-item-project" className="text-xs text-muted-foreground">
                          Project <span className="font-normal text-muted-foreground/50">(optional)</span>
                        </Label>
                        <Select
                          id="work-item-project"
                          value={workItemFormProject}
                          onChange={(event) => setWorkItemFormProject(event.target.value)}
                          className="h-10 w-full text-sm"
                        >
                          <SelectItem value="">No project</SelectItem>
                          {filterOptions.projects.map((project) => (
                            <SelectItem key={project} value={project}>
                              {project}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="work-item-workspace" className="text-xs text-muted-foreground">
                          Workspace <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          id="work-item-workspace"
                          value={workItemFormWorkspace}
                          onChange={(event) => setWorkItemFormWorkspace(event.target.value)}
                          className="h-10 w-full text-sm"
                        >
                          {workspacePickerGroups.tectona.length > 0 ? (
                            <optgroup label="Tectona">
                              {workspacePickerGroups.tectona.map((workspace) => (
                                <SelectItem key={`tectona-${workspace}`} value={workspace}>
                                  {workspace}
                                </SelectItem>
                              ))}
                            </optgroup>
                          ) : null}
                          {workspacePickerGroups.monday.length > 0 ? (
                            <optgroup label="Monday">
                              {workspacePickerGroups.monday.map((workspace) => (
                                <SelectItem key={`monday-${workspace}`} value={workspace}>
                                  {workspace}
                                </SelectItem>
                              ))}
                            </optgroup>
                          ) : null}
                          {workspacePickerGroups.tectona.length === 0 && workspacePickerGroups.monday.length === 0 ? (
                            <SelectItem value="" disabled>
                              No workspaces available
                            </SelectItem>
                          ) : null}
                        </Select>
                      </div>
                    </div>

                    {DIRECTORY_ALLOWED_PARENTS[workItemFormType].length > 0 ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="work-item-parent" className="text-xs text-muted-foreground">
                          Parent{' '}
                          {workItemFormType === 'Subtask' || workItemFormType === 'Checklist' ? (
                            <span className="text-red-500">*</span>
                          ) : (
                            <span className="font-normal text-muted-foreground/50">(optional)</span>
                          )}
                        </Label>
                        <Select
                          id="work-item-parent"
                          value={workItemFormParentId}
                          onChange={(event) => setWorkItemFormParentId(event.target.value)}
                          className="h-10 w-full text-sm"
                        >
                          <SelectItem value="">
                            {workItemFormType === 'Epic' ? 'None' : 'No parent (root level)'}
                          </SelectItem>
                          {workItemParentOptions.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.type}: {item.title} ({item.id})
                            </SelectItem>
                          ))}
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Allowed parents: {formatWorkItemTypes(DIRECTORY_ALLOWED_PARENTS[workItemFormType])}.
                        </p>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <WorkItemPersonSelect
                          id="work-item-assignee"
                          label="Assignee"
                          value={workItemFormAssignee}
                          options={resolveWorkspaceAssigneeOptions(workItemFormWorkspace, workItemFormAssignee)}
                          onChange={setWorkItemFormAssignee}
                          containmentOpen={workItemAddOpen}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="work-item-start-date" className="text-xs text-muted-foreground">
                          Start date
                        </Label>
                        <Input
                          id="work-item-start-date"
                          type="date"
                          value={workItemFormStartDate}
                          max={workItemFormDueDate || undefined}
                          onChange={(event) => {
                            const nextStart = event.target.value
                            setWorkItemFormStartDate(nextStart)
                            if (nextStart && workItemFormDueDate && nextStart > workItemFormDueDate) {
                              setWorkItemFormDueDate(nextStart)
                            }
                          }}
                          className="h-10 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="work-item-due-date" className="text-xs text-muted-foreground">
                          Due date
                        </Label>
                        <Input
                          id="work-item-due-date"
                          type="date"
                          value={workItemFormDueDate}
                          min={workItemFormStartDate || undefined}
                          onChange={(event) => {
                            const nextDue = event.target.value
                            if (workItemFormStartDate && nextDue && nextDue < workItemFormStartDate) {
                              return
                            }
                            setWorkItemFormDueDate(nextDue)
                          }}
                          className="h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="work-item-team" className="text-xs text-muted-foreground">
                          Team
                        </Label>
                        <Select
                          id="work-item-team"
                          value={workItemFormTeam}
                          onChange={(event) => setWorkItemFormTeam(event.target.value)}
                          disabled={operationalTeamsLoading && operationalTeamOptions.length === 0}
                          className="h-10 w-full text-sm"
                        >
                          {operationalTeamsLoading && operationalTeamOptions.length === 0 ? (
                            <SelectItem value="">Loading teams…</SelectItem>
                          ) : null}
                          {!operationalTeamsLoading && filterOptions.teams.length === 0 ? (
                            <SelectItem value="">No operational teams configured</SelectItem>
                          ) : null}
                          {filterOptions.teams.map((team) => (
                            <SelectItem key={team} value={team}>
                              {team}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>
                      <WorkItemPersonSelect
                        id="work-item-reporter"
                        label="Reporter"
                        value={workItemFormReporter}
                        options={filterOptions.reporters}
                        onChange={setWorkItemFormReporter}
                        containmentOpen={workItemAddOpen}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="work-item-label-input" className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" aria-hidden />
                          Labels
                          <span className="font-normal text-muted-foreground/50">(optional)</span>
                        </span>
                      </Label>
                      <div
                        className={cn(
                          'flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 shadow-sm transition',
                          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30'
                        )}
                      >
                        {workItemFormLabels.map((label) => (
                          <span
                            key={label}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm',
                              workItemLabelTagClass(label)
                            )}
                          >
                            {label}
                            <button
                              type="button"
                              className="rounded-full p-0.5 opacity-70 transition hover:bg-black/10 hover:opacity-100"
                              aria-label={`Remove label ${label}`}
                              onClick={() => removeWorkItemLabel(label)}
                            >
                              <X className="h-3 w-3" aria-hidden />
                            </button>
                          </span>
                        ))}
                        <input
                          id="work-item-label-input"
                          value={workItemFormLabelInput}
                          onChange={(event) => setWorkItemFormLabelInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ',') {
                              event.preventDefault()
                              commitWorkItemLabelDraft()
                              return
                            }
                            if (
                              event.key === 'Backspace' &&
                              workItemFormLabelInput.length === 0 &&
                              workItemFormLabels.length > 0
                            ) {
                              setWorkItemFormLabels((current) => current.slice(0, -1))
                            }
                          }}
                          onBlur={() => commitWorkItemLabelDraft()}
                          placeholder={
                            workItemFormLabels.length === 0
                              ? 'Type label and press Enter'
                              : 'Add another label'
                          }
                          className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Press Enter or comma to add a label. Use Backspace to remove the last label.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label id="work-item-priority-label" className="text-xs text-muted-foreground">
                          Priority
                        </Label>
                        <div className="relative">
                          <button
                            type="button"
                            ref={workItemPriorityTriggerRef}
                            id="work-item-priority"
                            aria-labelledby="work-item-priority-label"
                            aria-expanded={workItemPriorityMenuOpen}
                            aria-haspopup="listbox"
                            className={cn(
                              'inline-flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition',
                              'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
                            )}
                            onClick={() => {
                              if (workItemPriorityMenuOpen) {
                                setWorkItemPriorityMenuOpen(false)
                                return
                              }
                              const trigger = workItemPriorityTriggerRef.current
                              if (trigger) {
                                const rect = trigger.getBoundingClientRect()
                                setWorkItemPriorityMenuAnchor({
                                  left: rect.left,
                                  top: rect.bottom + 8,
                                  width: rect.width,
                                })
                              }
                              setWorkItemPriorityMenuOpen(true)
                            }}
                          >
                            <span
                              className={cn('h-2.5 w-2.5 shrink-0 rounded-full', PRIORITY_META[workItemFormPriority].dot)}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                priorityChipClass(workItemFormPriority)
                              )}
                            >
                              {workItemFormPriority}
                            </span>
                            <span className="min-w-0 flex-1" />
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>

                          {workItemPriorityMenuOpen && workItemPriorityMenuAnchor
                            ? createPortal(
                                <div
                                  ref={workItemPriorityMenuPanelRef}
                                  className="fixed z-[1200] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
                                  style={{
                                    left: workItemPriorityMenuAnchor.left,
                                    top: workItemPriorityMenuAnchor.top,
                                    width: workItemPriorityMenuAnchor.width,
                                  }}
                                  role="listbox"
                                  aria-label="Priority options"
                                >
                                  <div className="py-1 text-sm">
                                    {PRIORITY_OPTIONS.map((priority) => (
                                      <button
                                        key={priority}
                                        type="button"
                                        role="option"
                                        aria-selected={workItemFormPriority === priority}
                                        className={cn(
                                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-muted/50',
                                          workItemFormPriority === priority && 'bg-muted/40'
                                        )}
                                        onClick={() => {
                                          setWorkItemFormPriority(priority)
                                          setWorkItemPriorityMenuOpen(false)
                                        }}
                                      >
                                        <span className="flex items-center gap-2">
                                          <span
                                            className={cn('h-2.5 w-2.5 shrink-0 rounded-full', PRIORITY_META[priority].dot)}
                                            aria-hidden
                                          />
                                          <span
                                            className={cn(
                                              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                              priorityChipClass(priority)
                                            )}
                                          >
                                            {priority}
                                          </span>
                                        </span>
                                        {workItemFormPriority === priority ? (
                                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                                        ) : null}
                                      </button>
                                    ))}
                                  </div>
                                </div>,
                                document.body
                              )
                            : null}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label id="work-item-status-label" className="text-xs text-muted-foreground">
                          Status
                        </Label>
                        <div className="relative">
                          <button
                            type="button"
                            ref={workItemStatusTriggerRef}
                            id="work-item-status"
                            aria-labelledby="work-item-status-label"
                            aria-expanded={workItemStatusMenuOpen}
                            aria-haspopup="listbox"
                            className={cn(
                              'inline-flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition',
                              'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
                            )}
                            onClick={() => {
                              if (workItemStatusMenuOpen) {
                                setWorkItemStatusMenuOpen(false)
                                return
                              }
                              const trigger = workItemStatusTriggerRef.current
                              if (trigger) {
                                const rect = trigger.getBoundingClientRect()
                                setWorkItemStatusMenuAnchor({
                                  left: rect.left,
                                  top: rect.bottom + 8,
                                  width: rect.width,
                                })
                              }
                              setWorkItemStatusMenuOpen(true)
                            }}
                          >
                            <WorkItemStatusIcon status={workItemFormStatus} />
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                statusChipClass(workItemFormStatus)
                              )}
                            >
                              {workItemFormStatus}
                            </span>
                            <span className="min-w-0 flex-1" />
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>

                          {workItemStatusMenuOpen && workItemStatusMenuAnchor
                            ? createPortal(
                                <div
                                  ref={workItemStatusMenuPanelRef}
                                  className="fixed z-[1200] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
                                  style={{
                                    left: workItemStatusMenuAnchor.left,
                                    top: workItemStatusMenuAnchor.top,
                                    width: workItemStatusMenuAnchor.width,
                                  }}
                                  role="listbox"
                                  aria-label="Status options"
                                >
                                  <div className="py-1 text-sm">
                                    {STATUS_OPTIONS.map((status) => (
                                      <button
                                        key={status}
                                        type="button"
                                        role="option"
                                        aria-selected={workItemFormStatus === status}
                                        className={cn(
                                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-muted/50',
                                          workItemFormStatus === status && 'bg-muted/40'
                                        )}
                                        onClick={() => {
                                          setWorkItemFormStatus(status)
                                          setWorkItemStatusMenuOpen(false)
                                        }}
                                      >
                                        <span className="flex items-center gap-2">
                                          <WorkItemStatusIcon status={status} />
                                          <span
                                            className={cn(
                                              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                              statusChipClass(status)
                                            )}
                                          >
                                            {resolveWorkStatusDisplayLabel(status, boardColumnLabels)}
                                          </span>
                                        </span>
                                        {workItemFormStatus === status ? (
                                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                                        ) : null}
                                      </button>
                                    ))}
                                  </div>
                                </div>,
                                document.body
                              )
                            : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="work-item-estimated-hours" className="text-xs text-muted-foreground">
                        Estimated hours
                      </Label>
                      <Input
                        id="work-item-estimated-hours"
                        type="number"
                        min={0}
                        step={0.5}
                        value={workItemFormEstimatedHours}
                        onChange={(event) => setWorkItemFormEstimatedHours(event.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                      Subtasks and checklist items can be added after this work item is saved. Use{' '}
                      <span className="font-medium text-foreground">Save &amp; open detail</span> to continue in the detail drawer.
                    </p>
                  </div>

                  <div className="shrink-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
                    <div className="flex w-full items-stretch gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                        onClick={() => handleWorkItemCreate(true)}
                        disabled={workItemAddSaving}
                      >
                        <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
                        {workItemAddSaving ? 'Saving...' : 'Save & open detail'}
                      </Button>
                      <Button
                        type="submit"
                        variant="default"
                        className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                        disabled={workItemAddSaving}
                      >
                        <Save className="h-4 w-4 shrink-0" aria-hidden />
                        {workItemAddSaving ? 'Saving...' : 'Save work item'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </>,
            document.body
          )
        : null}

      {bulkActionMode && selectedIds.length > 0
        ? createPortal(
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="bulk-action-dialog-title"
                className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="bulk-action-dialog-title" className="text-base font-semibold text-foreground">
                      {bulkActionMode === 'status' ? 'Bulk update status' : 'Bulk reassign'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Apply to {selectedIds.length} selected work item{selectedIds.length !== 1 ? 's' : ''}.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    onClick={() => setBulkActionMode(null)}
                    aria-label="Close bulk action dialog"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4">
                  {bulkActionMode === 'status' ? (
                    <div>
                      <Label htmlFor="bulk-status-select" className="text-xs text-muted-foreground">New status</Label>
                      <Select
                        id="bulk-status-select"
                        value={bulkStatusValue}
                        onChange={(event) => setBulkStatusValue(event.target.value as WorkStatus)}
                        className="mt-1 h-10"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {resolveWorkStatusDisplayLabel(status, boardColumnLabels)}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <WorkItemPersonSelect
                      id="bulk-assignee"
                      label="New assignee"
                      value={bulkAssigneeValue}
                      options={filterOptions.assignees}
                      onChange={setBulkAssigneeValue}
                    />
                  )}
                </div>

                {bulkError ? <p className="mt-3 text-sm text-rose-600">{bulkError}</p> : null}

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" className="h-9" onClick={() => setBulkActionMode(null)} disabled={bulkSaving}>
                    Cancel
                  </Button>
                  <Button
                    className={cn('h-9', registerServicePrimaryButtonClass())}
                    disabled={bulkSaving}
                    onClick={() => void handleBulkApply()}
                  >
                    {bulkSaving ? 'Applying…' : 'Apply to selected'}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {drawer.open && drawerItem && (
        <div className="fixed inset-0 z-[1200] flex justify-end bg-black/30">
          <div className="h-full w-full max-w-[430px] border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Work Detail Drawer</div>
                <div className="mt-1 text-xs text-slate-600">{drawerItem.id} - {drawerItem.title}</div>
              </div>
              <button onClick={() => setDrawer({ open: false, workItemId: null })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">x</button>
            </div>
            <div className="h-[calc(100%-65px)] space-y-4 overflow-y-auto p-4 text-xs text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2">
                  <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{drawerItem.type}</Badge>
                  <PriorityChip priority={drawerItem.priority} />
                  <StatusBadge status={drawerItem.status} />
                </div>
                <p className="mt-3 leading-6 text-slate-700">{drawerItem.description}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Task information</div>
                <dl className="mt-3 space-y-2">
                  <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Project</dt><dd className="text-right font-medium text-slate-900">{drawerItem.project}</dd></div>
                  <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Workspace</dt><dd className="text-right font-medium text-slate-900">{drawerItem.workspace}</dd></div>
                  <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Parent epic / feature</dt><dd className="text-right font-medium text-slate-900">{drawerItem.epicId ?? '-'} / {drawerItem.featureId ?? '-'}</dd></div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Assignee</dt>
                    <dd className="flex items-center justify-end gap-2 text-right font-medium text-slate-900">
                      <WorkItemPersonAvatar name={drawerItem.assignee} size="sm" />
                      {drawerItem.assignee}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Team</dt>
                    <dd className="text-right font-medium text-slate-900">{drawerItem.team}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Reporter</dt>
                    <dd className="flex items-center justify-end gap-2 text-right font-medium text-slate-900">
                      <WorkItemPersonAvatar name={drawerItem.reporter ?? drawerItem.owner} size="sm" />
                      {drawerItem.reporter ?? drawerItem.owner}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Start date</dt>
                    <dd className="text-right font-medium text-slate-900">{drawerItem.startDate || '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Due date</dt><dd className="text-right font-medium text-slate-900">{drawerItem.dueDate}</dd></div>
                  <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Dependencies</dt><dd className="text-right font-medium text-slate-900">{drawerItem.dependencyStatus}</dd></div>
                  {(drawerItem.labels?.length ?? 0) > 0 ? (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Labels</dt>
                      <dd className="flex max-w-[220px] flex-wrap justify-end gap-1">
                        {(drawerItem.labels ?? []).map((label) => (
                          <Badge
                            key={label}
                            variant="outline"
                            className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', workItemLabelTagClass(label))}
                          >
                            {label}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quick update</div>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="drawer-edit-status" className="text-[11px] text-slate-500">Status</Label>
                    <Select
                      id="drawer-edit-status"
                      value={drawerEditStatus}
                      onChange={(event) => setDrawerEditStatus(event.target.value as WorkStatus)}
                      className="mt-1 h-9"
                    >
                      {(Object.keys(STATUS_META) as WorkStatus[]).map((status) => (
                        <SelectItem key={status} value={status}>
                          {resolveWorkStatusDisplayLabel(status, boardColumnLabels)}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="drawer-edit-priority" className="text-[11px] text-slate-500">Priority</Label>
                    <Select
                      id="drawer-edit-priority"
                      value={drawerEditPriority}
                      onChange={(event) => setDrawerEditPriority(event.target.value as Priority)}
                      className="mt-1 h-9"
                    >
                      {(Object.keys(PRIORITY_META) as Priority[]).map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>
                {drawerPatchError ? (
                  <p className="mt-2 text-[11px] text-rose-600">{drawerPatchError}</p>
                ) : null}
                <Button
                  type="button"
                  className={cn('mt-3 h-9 w-full', registerServicePrimaryButtonClass())}
                  disabled={drawerSaving}
                  onClick={() => void handleDrawerQuickSave()}
                >
                  {drawerSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>

              {(drawerIntegrationProfile || (drawerItem.externalLinks?.length ?? 0) > 0 || drawerItem.syncOrigin) ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Integration</div>
                  <dl className="mt-3 space-y-2">
                    {drawerIntegrationProfile ? (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Profile</dt>
                        <dd className="text-right font-medium text-slate-900">
                          {drawerIntegrationProfile.profile_code === 'federated_pm_dev'
                            ? 'Federated PM + Dev'
                            : 'Tectona native'}
                        </dd>
                      </div>
                    ) : null}
                    {drawerItem.syncOrigin ? (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Last sync origin</dt>
                        <dd className="text-right font-medium capitalize text-slate-900">{drawerItem.syncOrigin}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {(drawerItem.externalLinks?.length ?? 0) > 0 ? (
                    <div className="mt-3 space-y-2">
                      {drawerItem.externalLinks?.map((link) => (
                        <div
                          key={`${link.provider}-${link.external_id}`}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                        >
                          <div>
                            <div className="font-medium capitalize text-slate-900">{link.provider}</div>
                            <div className="text-[11px] text-slate-500">{link.external_key ?? link.external_id}</div>
                          </div>
                          {link.external_url ? (
                            <a
                              href={link.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-medium text-blue-600 hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Open
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <WorkItemSourceBadges links={drawerItem.externalLinks} syncOrigin={drawerItem.syncOrigin} />
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Checklist items</div>
                <div className="mt-3 space-y-2">
                  {drawerItem.checklist.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span>{entry.label}</span>
                      <Badge className={cn('rounded-full border', entry.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-700')}>
                        {entry.done ? 'Done' : 'Open'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Activity history</div>
                <div className="mt-3 space-y-2">
                  {ACTIVITIES.filter((entry) => entry.objectRef.includes(drawerItem.id)).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="font-medium text-slate-900">{entry.action}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{entry.timestamp} - {entry.actor}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Worklog summary</div>
                <div className="mt-3 space-y-2">
                  {WORKLOGS.filter((entry) => entry.taskId === drawerItem.id).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="font-medium text-slate-900">{entry.user} - {entry.hours}h</div>
                      <div className="mt-1 text-[11px] text-slate-500">{entry.date} - {entry.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-slate-200 text-xs text-slate-700"
                  onClick={() => void handleDrawerQuickSave()}
                  disabled={drawerSaving}
                >
                  Change Status
                </Button>
                {['Edit', 'Add Subtask', 'Log Time', 'Link Dependency'].map((action) => (
                  <Button key={action} variant="outline" className="h-9 rounded-full border-slate-200 text-xs text-slate-700">{action}</Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ContextMenu
        open={directoryRowContextMenu !== null}
        x={directoryRowContextMenu?.x ?? 0}
        y={directoryRowContextMenu?.y ?? 0}
        onClose={closeDirectoryRowContextMenu}
      >
        {directoryRowContextMenu ? (() => {
          const contextItem = directoryRowContextMenu.workItem
          const contextRowIndex = directoryRowContextMenu.rowIndex
          const previousRowItem = directoryTableRows[contextRowIndex - 1]?.item ?? null
          const canPaste = Boolean(directoryClipboardTitle?.trim())
          const canMoveToTop = getDirectorySiblingIndex(contextItem) > 0
          const canAddSubitem = canWorkItemAcceptChildren(contextItem)
          const defaultChildType = DIRECTORY_ALLOWED_CHILDREN[contextItem.type][0]
          const convertValidation =
            previousRowItem != null
              ? validateWorkItemReparent(contextItem.id, previousRowItem.id, workItems)
              : null
          const canConvertToSubitem = convertValidation?.valid === true
          const canCreateBelow =
            !workItemsLoadError && contextItem.type !== 'Checklist' && contextItem.type !== 'Epic'
          const moveWorkspaceOptions = directoryMoveTargets.workspaces.filter(
            (workspace) => workspace !== contextItem.workspace
          )
          const moveLabelOptions = directoryMoveTargets.labels.filter(
            (label) => label !== resolveWorkItemDirectoryLabel(contextItem)
          )

          return (
            <>
              <DirectoryContextMenuItem onSelect={() => void handleDirectoryCopyName(contextItem)}>
                <Type className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Copy name
              </DirectoryContextMenuItem>
              <DirectoryContextMenuItem
                disabled={!canPaste}
                onSelect={() => void handleDirectoryPasteTitle(contextItem)}
              >
                <ClipboardPaste className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Paste
              </DirectoryContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuSubmenu
                trigger={
                  <>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex-1">Move to</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" aria-hidden />
                  </>
                }
              >
                <DirectoryContextMenuItem disabled={!canMoveToTop}>
                  Move to Top
                </DirectoryContextMenuItem>
                <ContextMenuSubmenu
                  trigger={
                    <>
                      <span className="flex-1">Move to Workspace</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" aria-hidden />
                    </>
                  }
                >
                  {moveWorkspaceOptions.map((workspace) => (
                    <DirectoryContextMenuItem
                      key={workspace}
                      onSelect={() => handleDirectoryMoveWorkspace(contextItem, workspace)}
                    >
                      {workspace}
                    </DirectoryContextMenuItem>
                  ))}
                </ContextMenuSubmenu>
                {moveLabelOptions.length > 0 ? (
                  <ContextMenuSubmenu
                    trigger={
                      <>
                        <span className="flex-1">Move to Label</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" aria-hidden />
                      </>
                    }
                  >
                    {moveLabelOptions.map((label) => (
                      <DirectoryContextMenuItem
                        key={label}
                        onSelect={() => void handleDirectoryMoveLabel(contextItem, label)}
                      >
                        {label}
                      </DirectoryContextMenuItem>
                    ))}
                  </ContextMenuSubmenu>
                ) : (
                  <DirectoryContextMenuItem disabled>
                    Move to Label
                  </DirectoryContextMenuItem>
                )}
              </ContextMenuSubmenu>
              <DirectoryContextMenuItem onSelect={() => void handleDirectoryDuplicate(contextItem)}>
                <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Duplicate
              </DirectoryContextMenuItem>
              <DirectoryContextMenuItem
                disabled={!canCreateBelow}
                onSelect={() => void handleDirectoryCreateTaskBelow(contextItem)}
              >
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Create New Task Below
              </DirectoryContextMenuItem>
              <ContextMenuSeparator />
              <DirectoryContextMenuItem
                disabled={!canAddSubitem || !defaultChildType}
                onSelect={() => {
                  if (!defaultChildType) return
                  openWorkItemAddDrawerForParent(contextItem, defaultChildType)
                  closeDirectoryRowContextMenu()
                }}
              >
                <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Add subitem
              </DirectoryContextMenuItem>
              <DirectoryContextMenuItem
                disabled={!canConvertToSubitem}
                onSelect={() => void handleDirectoryConvertToSubitem(contextItem, contextRowIndex)}
              >
                <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Convert to subitem
              </DirectoryContextMenuItem>
              <ContextMenuSeparator />
              <DirectoryContextMenuItem onSelect={() => void handleDirectoryArchive(contextItem)}>
                <Archive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Archive
              </DirectoryContextMenuItem>
              <DirectoryContextMenuItem
                className="text-rose-600 focus:text-rose-600"
                onSelect={() => void handleDirectoryDelete(contextItem)}
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                Delete
              </DirectoryContextMenuItem>
            </>
          )
        })() : null}
      </ContextMenu>

      <ContextMenu
        open={directoryHeaderContextMenu !== null}
        x={directoryHeaderContextMenu?.x ?? 0}
        y={directoryHeaderContextMenu?.y ?? 0}
        onClose={() => setDirectoryHeaderContextMenu(null)}
      >
        <ContextMenuItem
          onSelect={() => {
            const key = directoryHeaderContextMenu?.columnKey
            if (!key) return
            autoResizeDirectoryColumn(key)
            setDirectoryHeaderContextMenu(null)
          }}
        >
          <UnfoldHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Auto Resize Column
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            const key = directoryHeaderContextMenu?.columnKey
            if (!key) return
            setDirectoryColumnWidthDialog({
              open: true,
              columnKey: key,
              valuePx: String(directoryColumnWidthsPx[key] ?? ''),
            })
            setDirectoryHeaderContextMenu(null)
          }}
        >
          <Ruler className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Column Width...
        </ContextMenuItem>
        {hasAnyDirectoryCustomColumnWidth ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                resetAllDirectoryColumnWidths()
                setDirectoryHeaderContextMenu(null)
              }}
            >
              <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Reset Column Width
            </ContextMenuItem>
          </>
        ) : null}
        {directoryHeaderContextMenu?.columnKey &&
        isDirectorySecondColumn(directoryHeaderContextMenu.columnKey) &&
        !isDirectoryLastColumn(directoryHeaderContextMenu.columnKey) ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                const key = directoryHeaderContextMenu?.columnKey
                if (!key) return
                moveDirectoryColumnRight(key)
                setDirectoryHeaderContextMenu(null)
              }}
            >
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Move Column to Right
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const key = directoryHeaderContextMenu?.columnKey
                if (!key) return
                moveDirectoryColumnToLast(key)
                setDirectoryHeaderContextMenu(null)
              }}
            >
              <ArrowRightToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Move Column to Last Position
            </ContextMenuItem>
          </>
        ) : null}
        {directoryHeaderContextMenu?.columnKey &&
        isDirectoryThirdColumnOrLater(directoryHeaderContextMenu.columnKey) ? (
          <>
            <ContextMenuSeparator />
            {(() => {
              const key = directoryHeaderContextMenu.columnKey
              const columnIndex = getDirectoryColumnIndex(key)
              const canMoveEarlier = columnIndex > 1
              const canMoveLater = columnIndex >= 0 && columnIndex < directoryColumnOrder.length - 1
              return (
                <>
                  {canMoveEarlier ? (
                    <ContextMenuItem
                      onSelect={() => {
                        moveDirectoryColumnToFirst(key)
                        setDirectoryHeaderContextMenu(null)
                      }}
                    >
                      <ArrowLeftToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Move Column to First Position
                    </ContextMenuItem>
                  ) : null}
                  {canMoveEarlier ? (
                    <ContextMenuItem
                      onSelect={() => {
                        moveDirectoryColumnLeft(key)
                        setDirectoryHeaderContextMenu(null)
                      }}
                    >
                      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Move Column to Left
                    </ContextMenuItem>
                  ) : null}
                  {canMoveLater ? (
                    <ContextMenuItem
                      onSelect={() => {
                        moveDirectoryColumnRight(key)
                        setDirectoryHeaderContextMenu(null)
                      }}
                    >
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Move Column to Right
                    </ContextMenuItem>
                  ) : null}
                  {canMoveLater ? (
                    <ContextMenuItem
                      onSelect={() => {
                        moveDirectoryColumnToLast(key)
                        setDirectoryHeaderContextMenu(null)
                      }}
                    >
                      <ArrowRightToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Move Column to Last Position
                    </ContextMenuItem>
                  ) : null}
                </>
              )
            })()}
          </>
        ) : null}
        {directoryHeaderContextMenu?.columnKey &&
        !isDirectoryFirstColumn(directoryHeaderContextMenu.columnKey) ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                const key = directoryHeaderContextMenu?.columnKey
                if (!key) return
                toggleDirectoryColumnVisibility(key)
                setDirectoryHeaderContextMenu(null)
              }}
            >
              <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Hide Column
            </ContextMenuItem>
          </>
        ) : null}
        {directoryHeaderContextMenu?.columnKey &&
        isDirectoryFirstColumn(directoryHeaderContextMenu.columnKey) ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                setFreezeDirectoryFirstColumn((value) => !value)
                setDirectoryHeaderContextMenu(null)
              }}
            >
              <Pin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Freeze Column
              <span className="ml-auto text-xs text-muted-foreground">
                {freezeDirectoryFirstColumn ? 'On' : 'Off'}
              </span>
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenu>

      <EnterpriseColumnWidthModal
        open={directoryColumnWidthDialog?.open ?? false}
        onClose={() => setDirectoryColumnWidthDialog(null)}
        columnLabel={
          directoryColumnWidthDialog ? directoryColumnLabel(directoryColumnWidthDialog.columnKey) : '—'
        }
        valuePx={directoryColumnWidthDialog?.valuePx ?? ''}
        onValuePxChange={(value) => {
          setDirectoryColumnWidthDialog((prev) => (prev ? { ...prev, valuePx: value } : prev))
        }}
        onApply={(widthPx) => {
          if (!directoryColumnWidthDialog) return
          const key = directoryColumnWidthDialog.columnKey
          setDirectoryColumnWidthsPx((prev) => {
            if (widthPx == null) {
              const next = { ...prev }
              delete next[key]
              return next
            }
            return { ...prev, [key]: widthPx }
          })
          setDirectoryColumnWidthDialog(null)
        }}
        minWidth={DIRECTORY_COLUMN_WIDTH_MIN_PX}
        maxWidth={DIRECTORY_COLUMN_WIDTH_MAX_PX}
        dialogTitleId="task-directory-column-width-dialog-title"
      />

      <EnterpriseDeleteConfirmModal
        open={confirmDeleteWorkItemOpen}
        onClose={closeDeleteWorkItemDialog}
        onConfirm={() => void submitDeleteWorkItem()}
        busy={isDeletingWorkItem}
        title="Delete Work Item"
        description={
          confirmDeleteWorkItemImpact && confirmDeleteWorkItemImpact.subitemCount > 0
            ? `This action permanently removes the work item, ${confirmDeleteWorkItemImpact.subitemCount} subitem${confirmDeleteWorkItemImpact.subitemCount === 1 ? '' : 's'}, and cannot be undone.`
            : 'This action permanently removes the work item and cannot be undone.'
        }
        entityLabel="Work item"
        entityValue={confirmDeleteWorkItemTarget?.title ?? '—'}
        impactSummary={
          confirmDeleteWorkItemTarget && confirmDeleteWorkItemImpact ? (
            <>
              <div className="font-medium text-foreground">Impact summary</div>
              <div className="mt-1">ID: {confirmDeleteWorkItemTarget.id}</div>
              <div>Type: {confirmDeleteWorkItemTarget.type}</div>
              <div>Label: {resolveWorkItemDirectoryLabel(confirmDeleteWorkItemTarget) || '—'}</div>
              <div>
                Subitems: {confirmDeleteWorkItemImpact.subitemCount}
                {confirmDeleteWorkItemImpact.subitemCount > 0 ? ' (included in delete)' : ''}
              </div>
              {confirmDeleteWorkItemImpact.hasMondayLinked ? (
                <div>Monday sync: linked item(s) will be removed from Monday.</div>
              ) : null}
            </>
          ) : null
        }
        enterpriseNote={
          confirmDeleteWorkItemImpact?.hasMondayLinked
            ? 'Enterprise note: Monday outbound delete is queued after Tectona delete; tombstone prevents re-import on the next sync.'
            : 'Enterprise note: subitems and linked integration records may require separate cleanup in downstream services.'
        }
        confirmLabel="Delete work item"
        confirmBusyLabel="Deleting..."
        dialogTitleId="delete-work-item-dialog-title"
      />

      {moveWorkspaceState && typeof document !== 'undefined'
        ? createPortal(
            (() => {
              const moveItem = moveWorkspaceState.item
              const moveSubitemCount = collectDescendantIds(moveItem.id, workItems).size
              const canConfirmMove = moveWorkspaceState.workspace.trim().length > 0 && !moveWorkspaceSaving
              const isMondayLinked = (moveItem.externalLinks ?? []).some((link) => link.provider === 'monday')
              return (
                <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
                  <button
                    type="button"
                    className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                    aria-label="Close move to workspace dialog"
                    disabled={moveWorkspaceSaving}
                    onClick={() => {
                      if (!moveWorkspaceSaving) setMoveWorkspaceState(null)
                    }}
                  />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="move-workspace-dialog-title"
                    className="relative z-[1401] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
                  >
                    <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <ArrowRightLeft className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 id="move-workspace-dialog-title" className="text-sm font-semibold text-slate-900">
                          Move to Workspace
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-600">Move this item into the selected Tectona workspace.</p>
                      </div>
                    </div>
                    <div className="space-y-3 px-5 py-4 text-sm">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Work item</div>
                        <div className="mt-0.5 font-medium text-slate-900">
                          {moveItem.title} <span className="text-slate-400">({moveItem.id})</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {moveSubitemCount > 0
                            ? `${moveSubitemCount} subitem${moveSubitemCount === 1 ? '' : 's'} will move too.`
                            : 'No subitems.'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Target workspace</div>
                        <div className="mt-0.5 font-medium text-slate-900">{moveWorkspaceState.workspace}</div>
                      </div>
                      {isMondayLinked ? (
                        <p className="text-[11px] leading-snug text-slate-500">
                          Also reflected in Monday — the workspace &amp; a matching board are created there if missing, and the item (with subitems) is moved into it. Type (Bug/Epic) and placement become Tectona-owned, so sync won&apos;t revert them.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                        disabled={moveWorkspaceSaving}
                        onClick={() => setMoveWorkspaceState(null)}
                      >
                        <X className="h-4 w-4 shrink-0" aria-hidden />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className={cn(
                          registerServicePrimaryButtonClass(),
                          'min-w-0 basis-0 flex-1 justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500'
                        )}
                        disabled={!canConfirmMove}
                        onClick={() => void confirmMoveWorkspace()}
                      >
                        <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />
                        {moveWorkspaceSaving ? 'Moving…' : 'Move'}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })(),
            document.body
          )
        : null}
    </div>
  )
}
