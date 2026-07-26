import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Archive,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GanttChart,
  Kanban,
  List,
  RefreshCcw,
} from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { fetchProject } from '@/lib/api/projectApi'
import { ProjectDeliveryDashboard } from '../components/ProjectDeliveryDashboard'
import { ProjectBoardPanel } from '../components/ProjectBoardPanel'
import { ProjectTimelinePanel } from '../components/ProjectTimelinePanel'
import { mapApiToProject, useProjectStore, type Project } from '../store/projectStore'
import {
  formatProjectTagLabel,
  getProjectTagBadgeClass,
  isProjectTemplateTag,
  resolveProjectDescriptionHtml,
  resolveProjectOwnerDisplay,
} from '../lib/projectDisplay'
import { getProjectTemplateById } from '../data/projectTemplates'
import { useProjectWorkItems } from '../hooks/useProjectWorkItems'

type ProjectPanelKey = 'summary' | 'timeline' | 'board' | 'calendar' | 'list' | 'docs' | 'archived'

const PROJECT_MENU_ITEMS: Array<{
  key: ProjectPanelKey
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { key: 'summary', label: 'Summary', icon: ClipboardList },
  { key: 'timeline', label: 'Timeline', icon: GanttChart },
  { key: 'board', label: 'Board', icon: Kanban },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'list', label: 'List', icon: List },
  { key: 'docs', label: 'Docs', icon: FileText },
  { key: 'archived', label: 'Archived', icon: Archive },
]

function formatProjectDate(dateString?: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ProjectDetailSidebar({
  collapsed,
  onCollapsedChange,
  activePanel,
  onNavigatePanel,
  projectStatus,
  onRefreshMetrics,
  metricsLoading,
}: {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  activePanel: ProjectPanelKey
  onNavigatePanel: (key: ProjectPanelKey) => void
  projectStatus: Project['status']
  onRefreshMetrics: () => void
  metricsLoading: boolean
}) {
  return (
    <aside
      className={cn(
        'fixed right-0 top-12 z-40 h-[calc(100vh-3rem)] border-l border-border/20 glass-sidebar transition-all duration-300',
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

        <div className="flex-1 space-y-2 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PROJECT_MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activePanel === item.key
            return (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                onClick={() => onNavigatePanel(item.key)}
                className={cn(
                  'h-9 w-full justify-start gap-2 rounded-lg',
                  collapsed && 'justify-center px-0',
                  active ? 'bg-primary/12 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:text-foreground'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Button>
            )
          })}

          {!collapsed && (
            <Card className="mt-2 border-border/30 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Project status
                  </p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">{projectStatus}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Metrics refresh
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full justify-center gap-2"
                    onClick={onRefreshMetrics}
                    disabled={metricsLoading}
                  >
                    <RefreshCcw className={cn('h-3.5 w-3.5', metricsLoading && 'animate-spin')} />
                    Refresh Metrics
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </aside>
  )
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { getProject, fetchProjects } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<ProjectPanelKey>('summary')

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    async function loadProject() {
      setLoading(true)
      try {
        const cached = getProject(projectId)
        if (cached) {
          if (!cancelled) setProject(cached)
        } else {
          await fetchProjects()
          const refreshed = getProject(projectId)
          if (refreshed && !cancelled) setProject(refreshed)
        }

        const apiProject = await fetchProject(projectId)
        if (apiProject && !cancelled) {
          setProject(mapApiToProject(apiProject))
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
  const { workItems, loading: workItemsLoading, usesApiItems, reload: reloadWorkItems } = useProjectWorkItems(
    project,
    ownerName,
  )
  const templateLabel = template?.name ?? (project?.tags?.[0] ? formatProjectTagLabel(project.tags[0]) : 'Project')
  const userTags = useMemo(
    () => (project?.tags ?? []).filter((tag) => !isProjectTemplateTag(tag)),
    [project?.tags],
  )
  const accentColor = project?.borderColor ?? '#3b82f6'
  const descriptionHtml = project ? resolveProjectDescriptionHtml(project) : ''

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading project workspace...
      </div>
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
        projectStatus={project.status}
        onRefreshMetrics={() => {
          void reloadWorkItems()
        }}
        metricsLoading={workItemsLoading}
      />

      <div
        className={cn(
          'transition-all duration-300',
          activePanel === 'timeline' || activePanel === 'board' ? 'space-y-4 pb-4' : 'space-y-5 pb-8',
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
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-[10px] self-stretch rounded-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-2">
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
                </div>
                <h1 className="text-2xl font-semibold leading-tight text-slate-900">{project.name}</h1>
                {descriptionHtml ? (
                  <div
                    className="max-w-3xl text-sm leading-relaxed text-slate-600 [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                ) : null}
                <p className="text-sm text-muted-foreground">
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
                {userTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
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
        </div>

        {activePanel === 'summary' ? (
          <div id="panel-summary" className="scroll-mt-24">
            <ProjectDeliveryDashboard project={project} template={template} workItems={workItems} />
          </div>
        ) : activePanel === 'timeline' ? (
          <ProjectTimelinePanel
            project={project}
            template={template}
            ownerName={ownerName}
            workItems={workItems}
            usesApiItems={usesApiItems}
            onWorkItemsChange={reloadWorkItems}
          />
        ) : activePanel === 'board' ? (
          <ProjectBoardPanel
            project={project}
            template={template}
            ownerName={ownerName}
            workItems={workItems}
            usesApiItems={usesApiItems}
            onWorkItemsChange={reloadWorkItems}
          />
        ) : (
          <Card className="border-dashed border-border/70 bg-muted/10">
            <CardContent className="space-y-2 px-6 py-12 text-center">
              {(() => {
                const panel = PROJECT_MENU_ITEMS.find((item) => item.key === activePanel)
                const PanelIcon = panel?.icon ?? FileText
                return <PanelIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              })()}
              <h2 className="text-lg font-semibold text-foreground">
                {PROJECT_MENU_ITEMS.find((item) => item.key === activePanel)?.label ?? activePanel}
              </h2>
              <p className="text-sm text-muted-foreground">
                This project panel will host{' '}
                {PROJECT_MENU_ITEMS.find((item) => item.key === activePanel)?.label.toLowerCase() ?? activePanel}{' '}
                views in a later delivery increment.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
