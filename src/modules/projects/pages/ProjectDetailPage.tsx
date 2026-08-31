import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Share2,
  Upload,
  UserPlus,
  Zap,
} from 'lucide-react'
import { PlatformDataLoadingState } from '@/components/loading'
import { DEFAULT_RIGHT_DRAWER_WIDTH, useRightDrawerStore } from '@/stores/right-drawer-store'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import {
  EnterpriseViewControlButton,
  EnterpriseViewControlRail,
  EnterpriseViewControlSeparator,
} from '@/components/enterprise/EnterpriseViewControlRail'
import { cn } from '@/lib/utils'
import { fetchProject } from '@/lib/api/projectApi'
import {
  listWorkItems,
  moveWorkItemWorkspace,
  patchWorkItem,
  TECTONA_PROJECT_WORKSPACE,
  type WorkItemApiModel,
} from '@/lib/api/workApi'
import { syncJiraAll, syncMondayAll } from '@/lib/api/workIntegrationApi'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { enrichProjectWithIdentityNames, fetchIdentityDisplayNameMap } from '../lib/projectMemberIdentity'
import { ProjectDetailHeaderFields } from '../components/ProjectDetailHeaderFields'
import { ProjectAssistantSidebarCard } from '../components/ProjectAssistantSidebarCard'
import { ProjectDeliveryDashboard } from '../components/ProjectDeliveryDashboard'
import { ProjectBoardPanel } from '../components/ProjectBoardPanel'
import { ProjectCalendarPanel } from '../components/ProjectCalendarPanel'
import { ProjectListPanel } from '../components/ProjectListPanel'
import { ProjectDocsPanel } from '../components/ProjectDocsPanel'
import { ProjectTimelinePanel } from '../components/ProjectTimelinePanel'
import { mapApiToProject, useProjectStore, type Project } from '../store/projectStore'
import {
  formatProjectTagLabel,
  getProjectTagBadgeClass,
  isProjectTemplateTag,
  resolveProjectOwnerDisplay,
  resolveProjectMemberAvatars,
} from '../lib/projectDisplay'
import { getProjectTemplateById, type ProjectTemplate } from '../data/projectTemplates'
import { useProjectWorkItems } from '../hooks/useProjectWorkItems'
import { useProjectLinkedIdea } from '../hooks/useProjectLinkedIdea'
import { ProjectSourceIdeaChip } from '../components/ProjectSourceIdeaChip'
import { ProjectMemberAvatarStack } from '../components/ProjectMemberAvatarStack'
import { AddProjectMembersDrawer } from '../components/AddProjectMembersDrawer'
import { ProjectSectionCatalogPopover } from '../components/ProjectSectionCatalogPopover'
import { ProjectArchivedPanel, type ProjectArchivedTab } from '../components/ProjectArchivedPanel'
import { ProjectInboxPanel } from '../components/ProjectInboxPanel'
import { ProjectScenariosPanel } from '../components/ProjectScenariosPanel'
import { ProjectSectionEmptyPanel } from '../components/ProjectSectionEmptyPanel'
import { useProjectWorkItemOverlays } from '../hooks/useProjectWorkItemOverlays'
import {
  filterActiveWorkItemsWithOverlays,
} from '../lib/projectArchivedWorkItems'
import {
  seedSampleArchivedWorkItems,
} from '../lib/projectArchivedWorkItems'
import {
  seedSampleInboxWorkItems,
} from '../lib/projectInboxWorkItems'
import {
  getProjectPanelCatalogEntry,
  PROJECT_PANEL_CATALOG,
  type ProjectPanelKey,
} from '../lib/projectPanelCatalog'
import { resolveProjectNavSections } from '../lib/projectPanelCatalog'
import { useProjectNavSectionsStore } from '../store/projectNavSectionsStore'
import { useProjectDocsStore } from '../store/projectDocsStore'
import { fetchProjectDocumentsForScenarios } from '../lib/fetchProjectDocumentsForScenarios'
import { loadProjectScenarioState } from '../lib/projectScenariosStorage'
import { syncIdeaDocumentsToProjectFolder } from '../lib/ideaLinkedDocuments'
import {
  uploadFilesToProjectDocumentFolder,
  type ProjectDocumentRevisionConflict,
} from '../lib/uploadProjectDocuments'

function formatProjectDate(dateString?: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const MONDAY_LOGO_SRC = '/images/logo-mondays.png'
const JIRA_LOGO_SRC = '/images/logo-jira.png'

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
  const triggerRef = useRef<HTMLDivElement>(null)
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
      <div ref={triggerRef}>
        <Tooltip content="Sync integrations" side="bottom" size="compact" sideOffset={6}>
          <EnterpriseViewControlButton
            aria-label="Sync integrations"
            aria-expanded={open}
            aria-haspopup="menu"
            disabled={syncing}
            onClick={() => {
              if (syncing) return
              if (open) setOpen(false)
              else {
                updateAnchor()
                setOpen(true)
              }
            }}
          >
            <RefreshCw className={cn('h-[18px] w-[18px]', syncing && 'animate-spin')} strokeWidth={1.8} />
          </EnterpriseViewControlButton>
        </Tooltip>
      </div>
      {open && anchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label="Integration sync providers"
              className="fixed z-[1200] flex flex-col items-stretch gap-1 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/60"
              style={{ left: anchor.left, top: anchor.top }}
            >
              <button
                type="button"
                role="menuitem"
                aria-label="Sync Monday"
                title="Sync Monday"
                disabled={mondaySyncing}
                className="flex h-10 min-w-10 items-center justify-center rounded-lg transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                onClick={() => {
                  setOpen(false)
                  onSyncMonday()
                }}
              >
                <img src={MONDAY_LOGO_SRC} alt="" aria-hidden draggable={false} className="h-7 w-7 object-contain" />
              </button>
              <button
                type="button"
                role="menuitem"
                aria-label="Sync Jira"
                title="Sync Jira"
                disabled={jiraSyncing}
                className="flex h-10 min-w-10 items-center justify-center rounded-lg transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                onClick={() => {
                  setOpen(false)
                  onSyncJira()
                }}
              >
                <img src={JIRA_LOGO_SRC} alt="" aria-hidden draggable={false} className="h-7 w-7 object-contain" />
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function isMondayWorkItem(item: WorkItemApiModel): boolean {
  return (
    item.syncOrigin === 'monday' ||
    (item.externalLinks ?? []).some((link) => link.provider === 'monday')
  )
}

function MondayTaskPickerDialog({
  open,
  project,
  onOpenChange,
  onCompleted,
  onSyncingChange,
}: {
  open: boolean
  project: Project
  onOpenChange: (open: boolean) => void
  onCompleted: (count: number) => void
  onSyncingChange: (syncing: boolean) => void
}) {
  const [items, setItems] = useState<WorkItemApiModel[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMondayItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await listWorkItems()
      const mondayItems = response.items.filter(isMondayWorkItem)
      setItems(mondayItems)
      setSelectedIds(
        new Set(mondayItems.filter((item) => item.project === project.name).map((item) => item.id)),
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Monday tasks.')
    } finally {
      setLoading(false)
    }
  }, [project.name])

  useEffect(() => {
    if (open) void loadMondayItems()
  }, [loadMondayItems, open])

  const handleRefreshFromMonday = async () => {
    setLoading(true)
    setError(null)
    onSyncingChange(true)
    try {
      await syncMondayAll()
      await loadMondayItems()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Monday sync failed.')
    } finally {
      onSyncingChange(false)
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id))
    setSaving(true)
    setError(null)
    onSyncingChange(true)
    try {
      await Promise.all(
        selectedItems.map(async (item) => {
          if (item.workspace !== TECTONA_PROJECT_WORKSPACE) {
            await moveWorkItemWorkspace(item.id, TECTONA_PROJECT_WORKSPACE)
          }
          await patchWorkItem(item.id, {
            project: project.name,
            workspace: TECTONA_PROJECT_WORKSPACE,
            expectedVersion: item.version,
          })
        }),
      )
      onCompleted(selectedItems.length)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add selected tasks to this project.')
    } finally {
      setSaving(false)
      onSyncingChange(false)
    }
  }

  const allSelected = items.length > 0 && selectedIds.size === items.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Monday tasks</DialogTitle>
          <DialogDescription>
            Choose the Monday items to add to <span className="font-semibold text-foreground">{project.name}</span>.
            Selected items will appear in Project List, Timeline, Board, and Calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} of {items.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)))}>
              {allSelected ? 'Clear all' : 'Select all'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleRefreshFromMonday()} disabled={loading || saving}>
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh from Monday
            </Button>
          </div>
        </div>

        <div className="max-h-[min(52vh,480px)] overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading Monday tasks...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No Monday tasks are available yet. Click “Refresh from Monday” to pull the latest items.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const checked = selectedIds.has(item.id)
                const alreadyInProject = item.project === project.name
                return (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedIds((current) => {
                          const next = new Set(current)
                          if (next.has(item.id)) next.delete(item.id)
                          else next.add(item.id)
                          return next
                        })
                      }}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{item.title}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                        <span>{item.label || 'Monday item'}</span>
                        <span>·</span>
                        <span>{item.status}</span>
                        {alreadyInProject ? <span className="font-medium text-emerald-600">Already in this project</span> : null}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={() => void handleConfirm()} disabled={saving || loading || selectedIds.size === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add selected tasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SortableNavItem({
  sectionKey,
  collapsed,
  active,
  badgeCount,
  onNavigate,
}: {
  sectionKey: ProjectPanelKey
  collapsed: boolean
  active: boolean
  badgeCount?: number
  onNavigate: (key: ProjectPanelKey) => void
}) {
  const item = getProjectPanelCatalogEntry(sectionKey)
  const Icon = item.icon
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionKey,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={cn('relative', isDragging && 'z-10 opacity-70')}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onNavigate(sectionKey)}
        className={cn(
          'group h-9 w-full justify-start gap-1 rounded-lg pr-2 pl-1',
          collapsed && 'justify-center px-0',
          active ? 'bg-primary/12 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:text-foreground'
        )}
        title={collapsed ? item.label : undefined}
      >
        {!collapsed && (
          <span
            {...attributes}
            {...listeners}
            className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
            aria-label={`Drag to reorder ${item.label}`}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && badgeCount != null && badgeCount > 0 ? (
          <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
            {badgeCount}
          </span>
        ) : null}
        {collapsed && badgeCount != null && badgeCount > 0 ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" aria-label={`${badgeCount} pending`} />
        ) : null}
      </Button>
    </div>
  )
}

function ProjectDetailSidebar({
  collapsed,
  onCollapsedChange,
  activePanel,
  onNavigatePanel,
  project,
  template,
  workItems,
  workItemsLoading,
  navSections,
  onAddSection,
  onRemoveSection,
  onReorderSections,
  onWidthChange,
  sectionBadgeCounts,
}: {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  activePanel: ProjectPanelKey
  onNavigatePanel: (key: ProjectPanelKey) => void
  project: Project
  template?: ProjectTemplate
  workItems: WorkItemApiModel[]
  workItemsLoading: boolean
  navSections: ProjectPanelKey[]
  onAddSection: (key: ProjectPanelKey) => void
  onRemoveSection: (key: ProjectPanelKey) => void
  onReorderSections: (orderedKeys: ProjectPanelKey[]) => void
  onWidthChange: (width: number) => void
  sectionBadgeCounts?: Partial<Record<ProjectPanelKey, number>>
}) {
  const addSectionButtonRef = useRef<HTMLButtonElement>(null)
  const asideRef = useRef<HTMLElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Read the width synchronously on layout (works even when ResizeObserver's notify step is
  // deferred, e.g. in a backgrounded tab); ResizeObserver then keeps it in sync afterwards
  // (collapse/expand toggle, container resize).
  useLayoutEffect(() => {
    const el = asideRef.current
    if (el) onWidthChange(el.getBoundingClientRect().width)
  }, [collapsed, onWidthChange])

  useEffect(() => {
    const el = asideRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) onWidthChange(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onWidthChange])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = navSections.indexOf(active.id as ProjectPanelKey)
    const newIndex = navSections.indexOf(over.id as ProjectPanelKey)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderSections(arrayMove(navSections, oldIndex, newIndex))
  }
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogAnchor, setCatalogAnchor] = useState<HTMLElement | null>(null)

  const hasAvailableSections = useMemo(
    () => PROJECT_PANEL_CATALOG.some((entry) => !navSections.includes(entry.key)),
    [navSections],
  )

  useEffect(() => {
    if (catalogOpen && !hasAvailableSections) {
      setCatalogOpen(false)
    }
  }, [catalogOpen, hasAvailableSections])

  return (
    <>
    <aside
      ref={asideRef}
      className={cn(
        'fixed right-0 top-12 z-40 h-[calc(var(--app-vh,100vh)-3rem)] border-l border-border/20 glass-sidebar transition-all duration-300',
        collapsed ? 'w-12' : 'w-72'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border/20 p-2">
          {!collapsed && (
            <span className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Project Menu
            </span>
          )}
          <div className={cn('flex items-center', collapsed ? 'w-full justify-center' : 'ml-auto')}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onCollapsedChange(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={navSections} strategy={verticalListSortingStrategy}>
              {navSections.map((sectionKey) => (
                <SortableNavItem
                  key={sectionKey}
                  sectionKey={sectionKey}
                  collapsed={collapsed}
                  active={activePanel === sectionKey}
                  badgeCount={sectionBadgeCounts?.[sectionKey]}
                  onNavigate={onNavigatePanel}
                />
              ))}
            </SortableContext>
          </DndContext>

          {hasAvailableSections ? (
            <Tooltip content="Add section" side="left" size="compact" sideOffset={6}>
              <Button
                ref={addSectionButtonRef}
                type="button"
                variant="ghost"
                aria-label="Add project section"
                onClick={() => {
                  setCatalogAnchor(addSectionButtonRef.current)
                  setCatalogOpen(true)
                }}
                className={cn(
                  'h-9 w-full justify-start gap-2 rounded-lg border border-dashed border-primary/25 text-primary hover:bg-primary/10 hover:text-primary',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">Add section</span>}
              </Button>
            </Tooltip>
          ) : null}

          {!collapsed && (
            <ProjectAssistantSidebarCard
              project={project}
              template={template}
              workItems={workItems}
              loading={workItemsLoading}
            />
          )}
        </div>
      </div>
    </aside>

    <ProjectSectionCatalogPopover
      open={catalogOpen}
      anchorEl={catalogAnchor ?? addSectionButtonRef.current}
      navSections={navSections}
      onClose={() => setCatalogOpen(false)}
      onAddSection={(key) => {
        onAddSection(key)
        onNavigatePanel(key)
      }}
      onRemoveSection={onRemoveSection}
    />
    </>
  )
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { getProject, fetchProjects } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<ProjectPanelKey>('summary')
  const [addMembersOpen, setAddMembersOpen] = useState(false)
  const [uploadingDocs, setUploadingDocs] = useState(false)
  const [mondaySyncing, setMondaySyncing] = useState(false)
  const [jiraSyncing, setJiraSyncing] = useState(false)
  const [mondayPickerOpen, setMondayPickerOpen] = useState(false)
  const [addTaskRequest, setAddTaskRequest] = useState(0)
  const [documentRevisionPrompt, setDocumentRevisionPrompt] = useState<{
    conflict: ProjectDocumentRevisionConflict
    resolve: (proceed: boolean) => void
  } | null>(null)
  const docsUploadInputRef = useRef<HTMLInputElement>(null)
  const bumpDocsRefresh = useProjectDocsStore((state) => state.bumpRefresh)
  const docsRefreshVersion = useProjectDocsStore((state) => state.refreshVersion)

  // The project menu is a permanent right-side panel here (like Workspace Management's detail
  // drawers), so it would cover a docked chat — float the chat instead while this page is open,
  // reserving exactly this sidebar's measured width rather than the drawer default.
  const setRightDrawerOpen = useRightDrawerStore((s) => s.setOpen)
  const setRightDrawerWidth = useRightDrawerStore((s) => s.setWidth)
  useEffect(() => {
    setRightDrawerOpen(true)
    return () => {
      setRightDrawerOpen(false)
      setRightDrawerWidth(DEFAULT_RIGHT_DRAWER_WIDTH)
    }
  }, [setRightDrawerOpen, setRightDrawerWidth])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    async function loadProject() {
      setLoading(true)
      try {
        const displayNameByUserId = await fetchIdentityDisplayNameMap()

        const cached = getProject(projectId)
        if (cached) {
          if (!cancelled) setProject(enrichProjectWithIdentityNames(cached, displayNameByUserId))
        } else {
          await fetchProjects()
          const refreshed = getProject(projectId)
          if (refreshed && !cancelled) {
            setProject(enrichProjectWithIdentityNames(refreshed, displayNameByUserId))
          }
        }

        const apiProject = await fetchProject(projectId)
        if (apiProject && !cancelled) {
          setProject(
            enrichProjectWithIdentityNames(mapApiToProject(apiProject), displayNameByUserId),
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProject()
    return () => {
      cancelled = true
    }
  }, [projectId, getProject, fetchProjects])

  const template = useMemo(() => {
    const templateTag = project?.tags?.find((tag) => isProjectTemplateTag(tag))
    if (!templateTag) return undefined
    return getProjectTemplateById(formatProjectTagLabel(templateTag))
  }, [project?.tags])

  const ownerName = project ? resolveProjectOwnerDisplay(project) : 'Unknown'
  const memberAvatars = useMemo(
    () => (project ? resolveProjectMemberAvatars(project) : []),
    [project],
  )
  const [overlayRevision, setOverlayRevision] = useState(0)
  const [archivedPreferredTab, setArchivedPreferredTab] = useState<ProjectArchivedTab>('work-items')
  const [scenariosStale, setScenariosStale] = useState(false)
  const bumpOverlayRevision = useCallback(() => setOverlayRevision((value) => value + 1), [])

  const { workItems, loading: workItemsLoading, usesApiItems, reload: reloadWorkItems } = useProjectWorkItems(
    project,
    ownerName,
  )

  const overlays = useProjectWorkItemOverlays(project?.id, usesApiItems, overlayRevision)

  useEffect(() => {
    if (!project || usesApiItems || workItemsLoading || workItems.length === 0) return
    const seededArchive = seedSampleArchivedWorkItems({
      projectId: project.id,
      workItems,
      archivedBy: ownerName || project.ownerName || 'system',
      projectCreatedAt: project.createdAt,
    })
    const seededInbox = seedSampleInboxWorkItems({
      projectId: project.id,
      workItems,
      projectCreatedAt: project.createdAt,
    })
    if (seededArchive || seededInbox) bumpOverlayRevision()
  }, [bumpOverlayRevision, ownerName, project, usesApiItems, workItems, workItemsLoading])

  const activeWorkItems = useMemo(
    () =>
      filterActiveWorkItemsWithOverlays(
        workItems,
        overlays.pendingInboxKeys,
        overlays.archivedWorkItemKeys,
      ),
    [overlays.archivedWorkItemKeys, overlays.pendingInboxKeys, workItems],
  )

  const inboxPendingCount = overlays.pendingInboxKeys.size

  const sectionBadgeCounts = useMemo((): Partial<Record<ProjectPanelKey, number>> => {
    const counts: Partial<Record<ProjectPanelKey, number>> = {}
    if (inboxPendingCount > 0) counts.inbox = inboxPendingCount
    if (scenariosStale) counts.scenarios = 1
    return counts
  }, [inboxPendingCount, scenariosStale])
  const {
    linkedIdea,
    linkedIdeas,
    loading: linkedIdeaLoading,
    reload: reloadLinkedIdea,
    setLinkedIdea,
  } = useProjectLinkedIdea(project?.id)
  const addNavSection = useProjectNavSectionsStore((state) => state.addSection)
  const removeNavSection = useProjectNavSectionsStore((state) => state.removeSection)
  const reorderNavSections = useProjectNavSectionsStore((state) => state.reorderSections)
  const savedNavSections = useProjectNavSectionsStore((state) =>
    project ? state.sectionsByProject[project.id] : undefined,
  )
  const navSections = useMemo(() => resolveProjectNavSections(savedNavSections), [savedNavSections])
  const templateLabel = template?.name ?? (project?.tags?.[0] ? formatProjectTagLabel(project.tags[0]) : 'Project')
  const userTags = useMemo(
    () => (project?.tags ?? []).filter((tag) => !isProjectTemplateTag(tag)),
    [project?.tags],
  )
  const accentColor = project?.borderColor ?? '#3b82f6'

  const handleDocsUpload = async (files: FileList | null) => {
    if (!project || !files?.length) return

    setUploadingDocs(true)
    try {
      const { uploadedCount, revisedCount, duplicates } = await uploadFilesToProjectDocumentFolder(
        project,
        Array.from(files),
        {
          ideaId: linkedIdea?.id,
          onRevisionConflict: (conflict) => new Promise<boolean>((resolve) => {
            setDocumentRevisionPrompt({
              conflict,
              resolve: (proceed) => {
                setDocumentRevisionPrompt(null)
                resolve(proceed)
              },
            })
          }),
        },
      )
      if (uploadedCount > 0) {
        bumpDocsRefresh()
        setActivePanel('docs')
        addToast({
          title: 'Document uploaded',
          description:
            uploadedCount === 1
              ? 'File saved to this project folder in Document Repository.'
              : `${uploadedCount} files saved to this project folder in Document Repository.`,
          variant: 'success',
        })
      }
      if (revisedCount > 0) {
        bumpDocsRefresh()
        setActivePanel('docs')
        addToast({
          title: 'Document revision committed',
          description: `${revisedCount} document${revisedCount === 1 ? '' : 's'} uploaded as a new version in this project’s Docs.`,
          variant: 'success',
        })
      }
      for (const duplicate of duplicates) {
        addToast({
          title: 'Upload blocked — document already exists',
          description: `"${duplicate.fileName}" was not committed because "${duplicate.existingTitle}" already exists with the same content or source name.`,
          variant: 'error',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload document'
      addToast({ title: 'Upload failed', description: message, variant: 'error' })
    } finally {
      setUploadingDocs(false)
      if (docsUploadInputRef.current) docsUploadInputRef.current.value = ''
    }
  }

  const handleSyncMonday = () => {
    if (mondaySyncing) return
    setMondayPickerOpen(true)
  }

  const handleSyncJira = async () => {
    if (jiraSyncing) return
    setJiraSyncing(true)
    try {
      const result = await syncJiraAll()
      const count = result.synced ?? 0
      const projects = result.projects?.length ?? (result.project_key ? 1 : 0)
      await reloadWorkItems()
      addToast({
        title: 'Jira sync complete',
        description:
          count > 0
            ? `Synced ${count} item${count === 1 ? '' : 's'} from ${projects} Jira project${projects === 1 ? '' : 's'}.`
            : 'Pull completed with 0 items. Check Jira credentials and project access.',
        variant: 'success',
      })
    } catch {
      addToast({
        title: 'Jira sync failed',
        description: 'Set Jira credentials on the Work Integration Hub (port 8433), or configure the Jira webhook.',
        variant: 'error',
      })
    } finally {
      setJiraSyncing(false)
    }
  }

  useEffect(() => {
    if (!project?.id || !linkedIdea?.id) return
    void syncIdeaDocumentsToProjectFolder({
      project: { id: project.id, name: project.name },
      ideaId: linkedIdea.id,
      workspaceId: linkedIdea.workspace_id ?? project.workspaceId,
    }).then(() => {
      bumpDocsRefresh()
    })
  }, [bumpDocsRefresh, linkedIdea?.id, linkedIdea?.workspace_id, project?.id, project?.name, project?.workspaceId])

  useEffect(() => {
    if (!project?.id) {
      setScenariosStale(false)
      return
    }
    let cancelled = false
    void fetchProjectDocumentsForScenarios({
      projectId: project.id,
      projectName: project.name,
      linkedIdeaId: linkedIdea?.id ?? null,
      linkedIdeaWorkspaceId: linkedIdea?.workspace_id ?? null,
      workspaceId: project.workspaceId,
    })
      .then((context) => {
        if (cancelled) return
        const stored = loadProjectScenarioState(project.id)
        setScenariosStale(Boolean(stored?.analysis && stored.analysis.doc_fingerprint !== context.fingerprint))
      })
      .catch(() => {
        if (!cancelled) setScenariosStale(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    docsRefreshVersion,
    linkedIdea?.id,
    linkedIdea?.workspace_id,
    project?.id,
    project?.name,
    project?.workspaceId,
  ])

  useEffect(() => {
    if (!navSections.includes(activePanel)) {
      setActivePanel(navSections[0] ?? 'summary')
    }
  }, [activePanel, navSections])

  if (loading) {
    return (
      <PlatformDataLoadingState
        title="Loading project data"
        description="Retrieving project details from the service."
      />
    )
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Project not found</h1>
        <p className="text-sm text-muted-foreground">The project may have been removed or you no longer have access.</p>
        <Button type="button" onClick={() => navigate('/projects')}>
          Back to projects
        </Button>
      </div>
    )
  }

  return (
    <>
      <ProjectDetailSidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        activePanel={activePanel}
        onNavigatePanel={setActivePanel}
        project={project}
        template={template}
        workItems={activeWorkItems}
        workItemsLoading={workItemsLoading}
        navSections={navSections}
        onAddSection={(key) => {
          addNavSection(project.id, key)
          addToast({
            title: 'Section added',
            description: `${getProjectPanelCatalogEntry(key).label} is now in the project sidebar.`,
            variant: 'success',
          })
        }}
        onRemoveSection={(key) => {
          removeNavSection(project.id, key)
          if (activePanel === key) {
            setActivePanel('summary')
          }
          addToast({
            title: 'Section removed',
            description: `${getProjectPanelCatalogEntry(key).label} removed from the project sidebar.`,
            variant: 'default',
          })
        }}
        onReorderSections={(orderedKeys) => reorderNavSections(project.id, orderedKeys)}
        onWidthChange={setRightDrawerWidth}
        sectionBadgeCounts={sectionBadgeCounts}
      />

      <div
        className={cn(
          'transition-all duration-300',
          activePanel === 'summary' ? 'space-y-5 pb-8' : 'space-y-4 pb-4',
          'mr-0 md:mr-12',
          sidebarCollapsed ? 'lg:mr-12' : 'lg:mr-72'
        )}
      >
        <Breadcrumb
          items={[
            { label: 'Workspace', href: '/workspace-management' },
            { label: 'Projects', href: '/projects' },
            { label: project.name },
          ]}
        />

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="w-[10px] self-stretch rounded-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="bg-white/90 text-[10px] font-semibold">
                    {project.id.slice(0, 8).toUpperCase()}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-semibold',
                      project.status === 'active'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    )}
                  >
                    {project.status === 'active' ? 'Active' : 'Archived'}
                  </Badge>
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] font-semibold text-blue-700">
                    {templateLabel}
                  </Badge>
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[10px] font-semibold text-indigo-700">
                    Tectona Delivery Workspace
                  </Badge>
                  {linkedIdea ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/idea-backlog/${linkedIdea.id}`)}
                      className={cn(
                        'inline-flex max-w-[min(100%,280px)] items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5',
                        'text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100/90',
                      )}
                      title={`Source idea: ${linkedIdea.title}`}
                    >
                      <Lightbulb className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="truncate">{linkedIdea.title}</span>
                      {linkedIdeas.length > 1 ? (
                        <span className="shrink-0 text-amber-700/75">+{linkedIdeas.length - 1}</span>
                      ) : null}
                    </button>
                  ) : null}
                </div>
                <ProjectDetailHeaderFields
                  project={project}
                  onProjectUpdated={(updated) => {
                    void fetchIdentityDisplayNameMap().then((displayNameByUserId) => {
                      setProject(enrichProjectWithIdentityNames(updated, displayNameByUserId))
                    })
                  }}
                />
                {userTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {userTags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', getProjectTagBadgeClass(tag))}
                      >
                        {formatProjectTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch pt-0.5">
              <EnterpriseViewControlRail className="flex-nowrap">
                <Tooltip content="Add task" side="bottom" size="compact" sideOffset={6}>
                  <EnterpriseViewControlButton
                    aria-label="Add task"
                    onClick={() => {
                      setActivePanel('timeline')
                      setAddTaskRequest((value) => value + 1)
                    }}
                  >
                    <Plus className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </EnterpriseViewControlButton>
                </Tooltip>
                <EnterpriseViewControlSeparator />
                <ProjectSourceIdeaChip
                  projectId={project.id}
                  projectName={project.name}
                  linkedIdea={linkedIdea}
                  linkedIdeas={linkedIdeas}
                  loading={linkedIdeaLoading}
                  onLinked={(idea) => {
                    setLinkedIdea(idea)
                    void reloadLinkedIdea()
                    void syncIdeaDocumentsToProjectFolder({
                      project: { id: project.id, name: project.name },
                      ideaId: idea.id,
                      workspaceId: idea.workspace_id ?? project.workspaceId,
                    }).then(() => {
                      bumpDocsRefresh()
                    })
                  }}
                  onUnlinked={() => {
                    setLinkedIdea(null)
                    void reloadLinkedIdea()
                  }}
                />
                <EnterpriseViewControlSeparator />
                <IntegrationSyncToolbarButton
                  mondaySyncing={mondaySyncing}
                  jiraSyncing={jiraSyncing}
                  onSyncMonday={() => void handleSyncMonday()}
                  onSyncJira={() => void handleSyncJira()}
                />
                <EnterpriseViewControlSeparator />
                <Tooltip content="Share" side="bottom" size="compact" sideOffset={6}>
                  <EnterpriseViewControlButton
                    aria-label="Share project"
                    onClick={() => {
                      addToast({
                        title: 'Share',
                        description: 'This feature is coming soon.',
                        variant: 'default',
                      })
                    }}
                  >
                    <Share2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </EnterpriseViewControlButton>
                </Tooltip>
                <EnterpriseViewControlSeparator />
                <Tooltip content="Automation" side="bottom" size="compact" sideOffset={6}>
                  <EnterpriseViewControlButton
                    aria-label="Project automation"
                    onClick={() => {
                      addToast({
                        title: 'Automation',
                        description: 'This feature is coming soon.',
                        variant: 'default',
                      })
                    }}
                  >
                    <Zap className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </EnterpriseViewControlButton>
                </Tooltip>
                <EnterpriseViewControlSeparator />
                <Tooltip content="Add members" side="bottom" size="compact" sideOffset={6}>
                  <EnterpriseViewControlButton
                    aria-label="Add members"
                    onClick={() => setAddMembersOpen(true)}
                  >
                    <UserPlus className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </EnterpriseViewControlButton>
                </Tooltip>
                <EnterpriseViewControlSeparator />
                <Tooltip content="Upload document" side="bottom" size="compact" sideOffset={6}>
                  <EnterpriseViewControlButton
                    aria-label="Upload document"
                    disabled={uploadingDocs}
                    onClick={() => docsUploadInputRef.current?.click()}
                  >
                    {uploadingDocs ? (
                      <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={1.8} />
                    ) : (
                      <Upload className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    )}
                  </EnterpriseViewControlButton>
                </Tooltip>
              </EnterpriseViewControlRail>
              <input
                ref={docsUploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void handleDocsUpload(event.target.files)}
              />
              <ProjectMemberAvatarStack members={memberAvatars} />
              <p className="text-right text-sm text-muted-foreground">
                Owner <span className="font-medium text-slate-700">{ownerName}</span>
                <span className="mx-2 text-slate-400" aria-hidden="true">
                  ·
                </span>
                Created <span className="font-medium text-slate-700">{formatProjectDate(project.createdAt)}</span>
                <span className="mx-2 text-slate-400" aria-hidden="true">
                  ·
                </span>
                Updated <span className="font-medium text-slate-700">{formatProjectDate(project.updatedAt)}</span>
              </p>
            </div>
          </div>
        </div>

        {activePanel === 'summary' ? (
          <div id="panel-summary" className="scroll-mt-24">
            <ProjectDeliveryDashboard project={project} template={template} workItems={activeWorkItems} />
          </div>
        ) : activePanel === 'timeline' ? (
          <ProjectTimelinePanel
            project={project}
            template={template}
            ownerName={ownerName}
            workItems={activeWorkItems}
            usesApiItems={usesApiItems}
            onWorkItemsChange={reloadWorkItems}
            openAddTaskRequest={addTaskRequest}
          />
        ) : activePanel === 'board' ? (
          <ProjectBoardPanel
            project={project}
            template={template}
            ownerName={ownerName}
            workItems={activeWorkItems}
            usesApiItems={usesApiItems}
            onWorkItemsChange={reloadWorkItems}
          />
        ) : activePanel === 'calendar' ? (
          <ProjectCalendarPanel
            project={project}
            template={template}
            ownerName={ownerName}
            workItems={activeWorkItems}
            usesApiItems={usesApiItems}
            onWorkItemsChange={reloadWorkItems}
          />
        ) : activePanel === 'list' ? (
          <ProjectListPanel
            project={project}
            template={template}
            ownerName={ownerName}
            workItems={activeWorkItems}
            usesApiItems={usesApiItems}
            onWorkItemsChange={reloadWorkItems}
            onArchiveChange={bumpOverlayRevision}
            onNavigateArchived={() => {
              setArchivedPreferredTab('work-items')
              setActivePanel('archived')
            }}
            usesOverlayApi={overlays.usesDatabase}
          />
        ) : activePanel === 'docs' ? (
          <ProjectDocsPanel
            project={project}
            linkedIdeaId={linkedIdea?.id ?? null}
            linkedIdeaTitle={linkedIdea?.title ?? null}
            linkedIdeaDescription={linkedIdea?.description ?? null}
            linkedIdeaWorkspaceId={linkedIdea?.workspace_id ?? null}
            archivedBy={ownerName}
            archiveRevision={overlayRevision}
            onArchiveChange={bumpOverlayRevision}
            onNavigateArchived={() => {
              setArchivedPreferredTab('documents')
              setActivePanel('archived')
            }}
          />
        ) : activePanel === 'archived' ? (
          <ProjectArchivedPanel
            project={project}
            workItems={workItems}
            loading={workItemsLoading || overlays.loading}
            archivedWorkItems={overlays.archivedWorkItems}
            archivedWorkItemKeys={overlays.archivedWorkItemKeys}
            overlayRevision={overlayRevision}
            onOverlayChange={bumpOverlayRevision}
            usesOverlayApi={overlays.usesDatabase}
            onNavigateList={() => setActivePanel('list')}
            preferredTab={archivedPreferredTab}
          />
        ) : activePanel === 'inbox' ? (
          <ProjectInboxPanel
            project={project}
            workItems={workItems}
            loading={workItemsLoading || overlays.loading}
            inboxRoutes={overlays.inboxRoutes}
            pendingInboxKeys={overlays.pendingInboxKeys}
            onOverlayChange={bumpOverlayRevision}
            usesOverlayApi={overlays.usesDatabase}
            usesApiItems={usesApiItems}
            onWorkItemsChange={reloadWorkItems}
            ownerName={ownerName}
          />
        ) : activePanel === 'scenarios' ? (
          <ProjectScenariosPanel
            project={project}
            linkedIdeaId={linkedIdea?.id ?? null}
            linkedIdeaTitle={linkedIdea?.title ?? null}
            linkedIdeaDescription={linkedIdea?.description ?? null}
            linkedIdeaWorkspaceId={linkedIdea?.workspace_id ?? null}
            ownerName={ownerName}
            onNavigateDocs={() => setActivePanel('docs')}
            onWorkItemsChange={reloadWorkItems}
            onStaleChange={setScenariosStale}
          />
        ) : (
          <ProjectSectionEmptyPanel panelKey={activePanel} />
        )}
      </div>

      <AddProjectMembersDrawer
        open={addMembersOpen}
        onOpenChange={setAddMembersOpen}
        project={project}
        onProjectUpdated={(updated) => {
          void fetchIdentityDisplayNameMap().then((displayNameByUserId) => {
            setProject(enrichProjectWithIdentityNames(updated, displayNameByUserId))
            void fetchProjects()
          })
        }}
      />

      <MondayTaskPickerDialog
        open={mondayPickerOpen}
        project={project}
        onOpenChange={setMondayPickerOpen}
        onSyncingChange={setMondaySyncing}
        onCompleted={(count) => {
          void reloadWorkItems()
          addToast({
            title: 'Monday tasks added',
            description: `${count} Monday task${count === 1 ? '' : 's'} is now available in this project’s list, timeline, board, and calendar.`,
            variant: 'success',
          })
        }}
      />

      <Dialog
        open={Boolean(documentRevisionPrompt)}
        onOpenChange={(open) => {
          if (!open) documentRevisionPrompt?.resolve(false)
        }}
      >
        <DialogContent className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-0 text-slate-900 shadow-2xl dark:border-amber-900/60 dark:bg-slate-900 dark:text-slate-100">
          <DialogHeader className="border-b border-slate-200/80 bg-amber-50/70 px-5 py-4 dark:border-slate-700/70 dark:bg-amber-950/20">
            <DialogTitle>Existing document detected</DialogTitle>
            <DialogDescription>
              This file has the same source name as a document in this project, but its content is different.
              Do you want to merge it as a new document version?
            </DialogDescription>
          </DialogHeader>
          {documentRevisionPrompt ? (
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Incoming file</p>
                <p className="mt-1 break-words font-medium">{documentRevisionPrompt.conflict.fileName}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Existing document: <span className="font-medium text-foreground">{documentRevisionPrompt.conflict.existingTitle}</span>
                {' · '}Current version: <span className="font-semibold text-foreground">v{documentRevisionPrompt.conflict.existingVersion}</span>
              </p>
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/70 px-5 py-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-9">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              className="h-9 bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => documentRevisionPrompt?.resolve(true)}
            >
              Merge as new version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
