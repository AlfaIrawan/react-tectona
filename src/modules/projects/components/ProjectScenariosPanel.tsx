import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  FileSearch,
  Layers3,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  ListChecks,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createWorkItem, TECTONA_PROJECT_WORKSPACE } from '@/lib/api/workApi'
import { cn } from '@/lib/utils'
import {
  enterpriseIndigoGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { getFileTypeIcon } from '@/modules/document-knowledge-management/fileTypeIcon'
import { getProjectPanelCatalogEntry } from '../lib/projectPanelCatalog'
import {
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
  PROJECT_LIST_TABLE_SCROLL_CLASS,
} from '../lib/projectListTableClasses'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'
import type { Project } from '../store/projectStore'
import { useProjectDocsStore } from '../store/projectDocsStore'
import { fetchProjectDocumentsForScenarios } from '../lib/fetchProjectDocumentsForScenarios'
import {
  ANALYSIS_STEPS,
  analyzeProjectScenarios,
  scenarioStatusBadgeClass,
  suitabilityBadgeClass,
} from '../lib/projectScenariosAnalysis'
import {
  loadProjectScenarioState,
  saveProjectScenarioState,
  updateScenarioCatalogItem,
} from '../lib/projectScenariosStorage'
import type {
  ProjectScenarioAnalysisResult,
  ScenarioCatalogItem,
  ScenarioCatalogStatus,
  ScenarioGapItem,
  ScenarioSourceDocumentAnalysis,
} from '../lib/projectScenariosTypes'

const listToolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

const scenariosInnerShellClass =
  'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/90 via-background to-background shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-700/50 dark:from-slate-900/35 dark:via-background dark:to-background dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_rgba(0,0,0,0.22)]'

const scenariosTabActiveClass =
  'bg-white text-indigo-700 shadow-[0_2px_10px_rgba(99,102,241,0.14)] ring-1 ring-indigo-200/70 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-800/50'

const scenariosTableHeadClass = cn(
  PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
  PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS,
  'text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-300',
)

const scenariosTableBodyClass = cn(PROJECT_LIST_TABLE_BODY_CELL_CLASS, 'text-xs')

const scenariosTitleCellClass = cn(
  scenariosTableBodyClass,
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  'group-hover:bg-indigo-50/40 dark:group-hover:bg-indigo-950/20',
)

type ScenariosTab = 'source' | 'plan' | 'catalog'

function formatAnalyzedAt(value: string): string {
  try {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function SuitabilityBadge({ level, score }: { level: ScenarioSourceDocumentAnalysis['suitability']; score: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm',
        suitabilityBadgeClass(level),
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {level} · {score}%
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === 'P1'
      ? 'border-rose-200/80 bg-gradient-to-r from-rose-50 to-rose-100/80 text-rose-800 dark:border-rose-900/40 dark:from-rose-950/40 dark:to-rose-900/20 dark:text-rose-200'
      : priority === 'P2'
        ? 'border-amber-200/80 bg-gradient-to-r from-amber-50 to-amber-100/70 text-amber-900 dark:border-amber-900/40 dark:from-amber-950/40 dark:to-amber-900/20 dark:text-amber-100'
        : 'border-slate-200/80 bg-gradient-to-r from-slate-50 to-slate-100/80 text-slate-700 dark:border-slate-700/50 dark:from-slate-900/50 dark:to-slate-800/40 dark:text-slate-200'

  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-sm', tone)}>
      {priority}
    </span>
  )
}

function StatusChip({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[5.5rem] flex-col gap-0.5 rounded-xl border px-3 py-1.5 shadow-sm',
        tone === 'success' &&
          'border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white text-emerald-900 dark:border-emerald-900/40 dark:from-emerald-950/35 dark:to-slate-900/40 dark:text-emerald-100',
        tone === 'warning' &&
          'border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-white text-amber-950 dark:border-amber-900/40 dark:from-amber-950/35 dark:to-slate-900/40 dark:text-amber-100',
        tone === 'default' &&
          'border-slate-200/70 bg-gradient-to-br from-slate-50/90 to-white text-slate-700 dark:border-slate-700/50 dark:from-slate-900/40 dark:to-slate-950/20 dark:text-slate-200',
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</span>
      <span className="text-sm font-semibold tabular-nums leading-none">{value}</span>
    </span>
  )
}

function GapReportCard({ item }: { item: ScenarioGapItem }) {
  return (
    <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 via-white to-white p-4 shadow-[0_8px_24px_rgba(245,158,11,0.08)] dark:border-amber-900/40 dark:from-amber-950/25 dark:via-slate-900/40 dark:to-slate-950/20">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
          <p className="text-sm text-muted-foreground">{item.detail}</p>
          <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Evidence: </span>
            {item.evidence}
          </div>
          <p className="text-xs font-medium text-foreground">{item.recommended_action}</p>
        </div>
      </div>
    </div>
  )
}

export type ProjectScenariosPanelProps = {
  project: Project
  linkedIdeaId?: string | null
  linkedIdeaTitle?: string | null
  linkedIdeaDescription?: string | null
  linkedIdeaWorkspaceId?: string | null
  ownerName: string
  onNavigateDocs?: () => void
  onWorkItemsChange?: () => void | Promise<void>
  onStaleChange?: (stale: boolean) => void
}

export function ProjectScenariosPanel({
  project,
  linkedIdeaId,
  linkedIdeaTitle,
  linkedIdeaDescription,
  linkedIdeaWorkspaceId,
  ownerName,
  onNavigateDocs,
  onWorkItemsChange,
  onStaleChange,
}: ProjectScenariosPanelProps) {
  const panelMeta = getProjectPanelCatalogEntry('scenarios')
  const PanelIcon = panelMeta.icon
  const { addToast } = useToast()
  const docsRefreshVersion = useProjectDocsStore((state) => state.refreshVersion)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<ScenariosTab>('source')
  const [analysis, setAnalysis] = useState<ProjectScenarioAnalysisResult | null>(null)
  const [docFingerprint, setDocFingerprint] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(() => new Set())
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])
  const [creatingWorkItems, setCreatingWorkItems] = useState(false)

  const isStale = Boolean(analysis && docFingerprint && analysis.doc_fingerprint !== docFingerprint)

  useEffect(() => {
    onStaleChange?.(isStale)
  }, [isStale, onStaleChange])

  useLayoutEffect(() => {
    const panelEl = panelRef.current
    if (!panelEl) return

    const updateHeight = () => setPanelHeightPx(measureProjectPanelHeight(panelEl))
    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })
    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)
    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void fetchProjectDocumentsForScenarios({
      projectId: project.id,
      projectName: project.name,
      linkedIdeaId,
      linkedIdeaWorkspaceId,
      workspaceId: project.workspaceId,
    })
      .then((context) => {
        if (cancelled) return
        setDocFingerprint(context.fingerprint)
        const stored = loadProjectScenarioState(project.id)
        setAnalysis(stored?.analysis ?? null)
      })
      .catch((error) => {
        if (cancelled) return
        addToast({
          title: 'Failed to load documents',
          description: error instanceof Error ? error.message : '',
          variant: 'error',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [addToast, docsRefreshVersion, linkedIdeaId, linkedIdeaWorkspaceId, project.id, project.name, project.workspaceId])

  useEffect(() => {
    if (!analyzing) {
      setStepIndex(0)
      return
    }
    const timer = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1))
    }, 2200)
    return () => window.clearInterval(timer)
  }, [analyzing])

  const suitableCount = useMemo(
    () =>
      analysis?.source_documents.filter((item) => item.suitability === 'high' || item.suitability === 'partial')
        .length ?? 0,
    [analysis],
  )

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true)
    setStepIndex(0)
    try {
      const context = await fetchProjectDocumentsForScenarios({
        projectId: project.id,
        projectName: project.name,
        linkedIdeaId,
        linkedIdeaWorkspaceId,
        workspaceId: project.workspaceId,
      })
      setDocFingerprint(context.fingerprint)

      const result = await analyzeProjectScenarios({
        projectId: project.id,
        projectName: project.name,
        projectDescription: project.description,
        workspaceId: project.workspaceId ?? linkedIdeaWorkspaceId ?? null,
        ideaTitle: linkedIdeaTitle,
        ideaDescription: linkedIdeaDescription,
        documents: context.documents,
        fingerprint: context.fingerprint,
        preferLlm: true,
      })

      saveProjectScenarioState({ project_id: project.id, analysis: result })
      setAnalysis(result)
      setActiveTab(result.verdict === 'sufficient' ? 'plan' : 'source')
      setExpandedDomains(new Set(result.plan_domains.map((domain) => domain.id)))
      setSelectedScenarioIds([])

      addToast({
        title: result.verdict === 'sufficient' ? 'Scenario plan ready' : 'Documentation gaps found',
        description: result.verdict_summary,
        variant: result.verdict === 'sufficient' ? 'success' : 'warning',
      })
    } catch (error) {
      addToast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setAnalyzing(false)
    }
  }, [
    addToast,
    linkedIdeaDescription,
    linkedIdeaId,
    linkedIdeaTitle,
    linkedIdeaWorkspaceId,
    project.description,
    project.id,
    project.name,
    project.workspaceId,
  ])

  const updateScenarioStatus = useCallback(
    (scenarioId: string, status: ScenarioCatalogStatus) => {
      const updated = updateScenarioCatalogItem(project.id, scenarioId, { status })
      if (updated) setAnalysis(updated.analysis)
    },
    [project.id],
  )

  const toggleScenarioSelection = useCallback((scenarioId: string) => {
    setSelectedScenarioIds((previous) =>
      previous.includes(scenarioId) ? previous.filter((id) => id !== scenarioId) : [...previous, scenarioId],
    )
  }, [])

  const createWorkItemsFromScenarios = useCallback(async () => {
    if (!analysis || selectedScenarioIds.length === 0) return
    setCreatingWorkItems(true)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)
    const dueDateIso = dueDate.toISOString().slice(0, 10)

    try {
      let created = 0
      for (const scenarioId of selectedScenarioIds) {
        const scenario = analysis.catalog.find((item) => item.id === scenarioId)
        if (!scenario || scenario.work_item_id) continue

        const description = [
          `Scenario ID: ${scenario.id}`,
          `Domain: ${scenario.domain_name} / ${scenario.group_name}`,
          '',
          'Preconditions:',
          ...scenario.preconditions.map((line) => `- ${line}`),
          '',
          'Steps:',
          ...scenario.steps.map((line, index) => `${index + 1}. ${line}`),
          '',
          `Expected: ${scenario.expected_result}`,
        ].join('\n')

        const workItem = await createWorkItem({
          title: `[Test] ${scenario.title}`.slice(0, 255),
          type: 'Task',
          project: project.name,
          workspace: TECTONA_PROJECT_WORKSPACE,
          assignee: ownerName,
          status: 'To Do',
          priority: scenario.priority === 'P1' ? 'High' : scenario.priority === 'P2' ? 'Medium' : 'Low',
          dueDate: dueDateIso,
          description,
          labels: ['scenario', scenario.id, 'test-planning'],
        })

        updateScenarioCatalogItem(project.id, scenario.id, { work_item_id: workItem.id, status: 'ready' })
        created += 1
      }

      const refreshed = loadProjectScenarioState(project.id)
      if (refreshed) setAnalysis(refreshed.analysis)
      setSelectedScenarioIds([])
      await onWorkItemsChange?.()

      addToast({
        title: 'Work items created',
        description: `${created} scenario task${created === 1 ? '' : 's'} added to the project backlog.`,
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to create work items',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setCreatingWorkItems(false)
    }
  }, [addToast, analysis, onWorkItemsChange, ownerName, project.id, project.name, selectedScenarioIds])

  const renderSourceTab = () => {
    if (!analysis) return null
    return (
      <div className={PROJECT_LIST_TABLE_SCROLL_CLASS}>
        <table className="w-full table-fixed border-collapse text-xs select-none">
          <colgroup>
            <col className="w-[32%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[16%]" />
            <col className="w-[28%]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-muted-foreground">
              <th className={cn(scenariosTableHeadClass, PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS)}>Document</th>
              <th className={scenariosTableHeadClass}>Type</th>
              <th className={scenariosTableHeadClass}>Suitability</th>
              <th className={scenariosTableHeadClass}>Role</th>
              <th className={scenariosTableHeadClass}>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {analysis.source_documents.map((item) => (
              <tr key={item.document_id} className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                <td className={cn(scenariosTitleCellClass, 'max-w-0 overflow-hidden')}>
                  <div className="flex min-w-0 items-start gap-3">
                    <img
                      src={getFileTypeIcon(item.document_title)}
                      alt=""
                      className="size-10 shrink-0 object-contain"
                      loading="lazy"
                      draggable={false}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-900 dark:text-slate-100" title={item.document_title}>
                        {item.document_title}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{item.document_id}</div>
                    </div>
                  </div>
                </td>
                <td className={cn(scenariosTableBodyClass, 'group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/30')}>
                  <span className="inline-flex rounded-md border border-slate-200/70 bg-white/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-300">
                    {item.document_type_code.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className={cn(scenariosTableBodyClass, 'group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/30')}>
                  <SuitabilityBadge level={item.suitability} score={item.suitability_score} />
                </td>
                <td className={cn(scenariosTableBodyClass, 'group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/30 font-medium text-slate-800 dark:text-slate-200')}>
                  {item.role}
                </td>
                <td className={cn(scenariosTableBodyClass, 'group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/30')}>
                  <p className="line-clamp-2 leading-relaxed text-slate-600 dark:text-slate-300">{item.evidence_quote}</p>
                  <p className="mt-1.5 rounded-lg border border-slate-200/60 bg-slate-50/70 px-2 py-1 text-[10px] leading-snug text-muted-foreground dark:border-slate-700/50 dark:bg-slate-900/40">
                    {item.rationale}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderPlanTab = () => {
    if (!analysis) return null
    if (analysis.plan_domains.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <AlertCircle className="h-8 w-8 text-amber-600" aria-hidden />
          <p className="max-w-lg text-sm text-muted-foreground">
            No scenario plan was generated. Review documentation gaps in Source analysis or add BRD/FSD/URD in Project Docs,
            then re-analyze.
          </p>
          {onNavigateDocs ? (
            <Button type="button" variant="outline" size="sm" onClick={onNavigateDocs}>
              Open Project Docs
            </Button>
          ) : null}
        </div>
      )
    }

    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-1 pr-2">
        {analysis.plan_domains.map((domain) => {
          const expanded = expandedDomains.has(domain.id)
          const scenarioCount = domain.groups.reduce((sum, group) => sum + group.scenarios.length, 0)
          return (
            <div
              key={domain.id}
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-[0_10px_28px_rgba(15,23,42,0.06)] dark:border-slate-700/50 dark:bg-slate-900/40 dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 border-b border-slate-200/60 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/50 px-4 py-3.5 text-left transition hover:from-indigo-50 hover:to-violet-50/70 dark:border-slate-700/50 dark:from-indigo-950/30 dark:via-slate-900/40 dark:to-violet-950/20"
                onClick={() =>
                  setExpandedDomains((previous) => {
                    const next = new Set(previous)
                    if (next.has(domain.id)) next.delete(domain.id)
                    else next.add(domain.id)
                    return next
                  })
                }
              >
                <span className="inline-flex size-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{domain.name}</p>
                  <p className="text-[11px] text-muted-foreground">Test scenario domain</p>
                </div>
                <span className="rounded-full border border-indigo-200/70 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 shadow-sm dark:border-indigo-800/50 dark:bg-slate-900/60 dark:text-indigo-300">
                  {scenarioCount} scenarios
                </span>
              </button>
              {expanded ? (
                <div className="space-y-4 px-4 py-4">
                  {domain.groups.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Layers3 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden />
                        <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          {group.name}
                        </h4>
                      </div>
                      {group.scenarios.map((scenario) => (
                        <div
                          key={scenario.id}
                          className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50/40 to-indigo-50/20 p-4 shadow-sm ring-1 ring-slate-200/40 dark:border-slate-700/50 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-indigo-950/10 dark:ring-slate-700/40"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/60 pb-3 dark:border-slate-700/50">
                            <div className="min-w-0 space-y-1">
                              <span className="font-mono text-[10px] text-indigo-600/80 dark:text-indigo-300/80">{scenario.id}</span>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{scenario.title}</p>
                            </div>
                            <PriorityBadge priority={scenario.priority} />
                          </div>
                          <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
                            <div className="rounded-xl border border-slate-200/60 bg-white/70 p-3 dark:border-slate-700/50 dark:bg-slate-950/20">
                              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                <CheckCircle2 className="h-3 w-3" aria-hidden />
                                Preconditions
                              </p>
                              <ul className="mt-2 space-y-1 text-slate-700 dark:text-slate-300">
                                {scenario.preconditions.map((line) => (
                                  <li key={line} className="flex gap-2">
                                    <span className="text-indigo-500">•</span>
                                    <span>{line}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-xl border border-slate-200/60 bg-white/70 p-3 dark:border-slate-700/50 dark:bg-slate-950/20">
                              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                <ArrowRight className="h-3 w-3" aria-hidden />
                                Steps
                              </p>
                              <ol className="mt-2 space-y-1 text-slate-700 dark:text-slate-300">
                                {scenario.steps.map((line, index) => (
                                  <li key={line} className="flex gap-2">
                                    <span className="font-semibold tabular-nums text-indigo-600">{index + 1}.</span>
                                    <span>{line}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                            <div className="rounded-xl border border-slate-200/60 bg-white/70 p-3 dark:border-slate-700/50 dark:bg-slate-950/20">
                              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                <Target className="h-3 w-3" aria-hidden />
                                Expected result
                              </p>
                              <p className="mt-2 leading-relaxed text-slate-700 dark:text-slate-300">{scenario.expected_result}</p>
                              {scenario.traceability.length > 0 ? (
                                <div className="mt-3 rounded-lg border border-indigo-200/50 bg-indigo-50/40 px-2.5 py-2 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                                    Traceability
                                  </p>
                                  {scenario.traceability.map((ref) => (
                                    <p key={`${ref.document_id}-${ref.reference}`} className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                      {ref.document_title ?? ref.document_id}: {ref.reference}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  const renderCatalogRow = (item: ScenarioCatalogItem) => {
    const selected = selectedScenarioIds.includes(item.id)
    return (
      <tr
        key={item.id}
        className={cn(
          'group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/30',
          selected && 'bg-indigo-50/50 dark:bg-indigo-950/20',
        )}
      >
        <td className={cn(scenariosTableBodyClass, 'w-10 text-center')}>
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={selected}
            disabled={Boolean(item.work_item_id)}
            onChange={() => toggleScenarioSelection(item.id)}
            aria-label={`Select ${item.title}`}
          />
        </td>
        <td className={cn(scenariosTitleCellClass, 'max-w-0 overflow-hidden', selected && 'bg-indigo-50/60 dark:bg-indigo-950/25')}>
          <div className="truncate font-semibold text-slate-900 dark:text-slate-100" title={item.title}>
            {item.title}
          </div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">{item.id}</div>
        </td>
        <td className={cn(scenariosTableBodyClass, 'group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/30')}>
          <PriorityBadge priority={item.priority} />
        </td>
        <td className={cn(scenariosTableBodyClass, 'group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/30')}>
          <span
            className={cn(
              'inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize shadow-sm',
              scenarioStatusBadgeClass(item.status),
            )}
          >
            {item.status}
          </span>
        </td>
        <td className={cn(scenariosTableBodyClass, 'group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/30 text-muted-foreground')}>
          {item.work_item_id ? (
            <span className="rounded-md border border-slate-200/70 bg-slate-50/80 px-1.5 py-0.5 font-mono text-[10px] dark:border-slate-700/50 dark:bg-slate-900/40">
              {item.work_item_id}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td className={cn(scenariosTableBodyClass, 'group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/30')}>
          <div className="flex flex-wrap gap-1.5">
            {item.status !== 'reviewed' && item.status !== 'ready' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(enterpriseSecondaryButtonClass(), 'h-7 px-2.5 text-[11px]')}
                onClick={() => updateScenarioStatus(item.id, 'reviewed')}
              >
                Mark reviewed
              </Button>
            ) : null}
            {item.status !== 'ready' ? (
              <Button
                type="button"
                size="sm"
                className={cn(enterpriseIndigoGradientActionButtonClass(), 'h-7 px-2.5 text-[11px]')}
                onClick={() => updateScenarioStatus(item.id, 'ready')}
              >
                Mark ready
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
    )
  }

  const renderCatalogTab = () => {
    if (!analysis) return null
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/35">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Select scenarios to create executable test tasks in the project backlog.
          </p>
          <Button
            type="button"
            size="sm"
            className={cn(enterpriseIndigoGradientActionButtonClass(), 'h-9 text-xs')}
            disabled={creatingWorkItems || selectedScenarioIds.length === 0}
            onClick={() => void createWorkItemsFromScenarios()}
          >
            {creatingWorkItems ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Create test work items ({selectedScenarioIds.length})
          </Button>
        </div>
        <div className={PROJECT_LIST_TABLE_SCROLL_CLASS}>
          <table className="w-full table-fixed border-collapse text-xs select-none">
            <colgroup>
              <col className="w-10" />
              <col className="w-[36%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-muted-foreground">
                <th className={scenariosTableHeadClass} aria-hidden />
                <th className={cn(scenariosTableHeadClass, PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS)}>Scenario</th>
                <th className={scenariosTableHeadClass}>Priority</th>
                <th className={scenariosTableHeadClass}>Status</th>
                <th className={scenariosTableHeadClass}>Work item</th>
                <th className={scenariosTableHeadClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {analysis.catalog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-muted-foreground">
                    No scenarios in catalog yet. Run analysis when documentation is sufficient.
                  </td>
                </tr>
              ) : (
                analysis.catalog.map(renderCatalogRow)
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderEmptyState = () => (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-dashed border-indigo-200/70 bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/50 px-6 py-12 text-center dark:border-indigo-900/40 dark:from-indigo-950/20 dark:via-slate-900/20 dark:to-slate-950/30">
      {panelMeta.illustrationSrc ? (
        <img src={panelMeta.illustrationSrc} alt="" className="h-auto w-full max-w-[17rem] object-contain drop-shadow-sm" loading="lazy" />
      ) : (
        <ListChecks className="h-10 w-10 text-indigo-500/70" strokeWidth={1.5} aria-hidden />
      )}
      <div className="max-w-lg space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Plan test scenarios from Project Docs</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The agent scans BRD, FSD, URD, and linked Idea context to rank reference documents, build a scenario plan, or
          return a gap report with evidence when documentation is insufficient.
        </p>
      </div>
      <button
        type="button"
        className={enterpriseIndigoGradientActionButtonClass()}
        disabled={analyzing || loading}
        onClick={() => void runAnalysis()}
      >
        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : <Sparkles className="h-4 w-4" strokeWidth={2.5} />}
        Analyze docs &amp; plan scenarios
      </button>
    </div>
  )

  const panel = (
    <div
      ref={panelRef}
      id="panel-scenarios"
      style={
        isFullscreen
          ? { height: 'calc(100dvh - 3rem)', maxHeight: 'calc(100dvh - 3rem)' }
          : panelHeightPx != null
            ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
            : undefined
      }
      className={cn(
        'scroll-mt-24',
        'glass-card flex min-h-0 flex-col overflow-hidden border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        isFullscreen ? 'fixed inset-x-0 top-12 bottom-0 z-50 rounded-none border-0 bg-background' : 'rounded-2xl',
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
          <div className="shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 shadow-sm ring-1 ring-indigo-200/60 dark:from-indigo-950/50 dark:to-violet-950/40 dark:text-indigo-300 dark:ring-indigo-800/50">
                  <PanelIcon className="h-4 w-4" aria-hidden />
                </span>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Project {panelMeta.label}
                </h2>
              </div>
              <button
                type="button"
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Exit scenarios fullscreen' : 'Expand scenarios to fullscreen'}
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                  listToolbarFocusClass,
                  isFullscreen && 'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                )}
                onClick={() => setIsFullscreen((prev) => !prev)}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">{panelMeta.description}</p>
                {analysis ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip label="Docs scanned" value={analysis.docs_scanned} />
                    <StatusChip label="References" value={suitableCount} tone={suitableCount > 0 ? 'success' : 'warning'} />
                    <StatusChip label="Scenarios" value={analysis.catalog.length} />
                    <StatusChip
                      label="Readiness"
                      value={`${analysis.readiness_score}%`}
                      tone={analysis.readiness_score >= 70 ? 'success' : 'warning'}
                    />
                    <StatusChip label="Analyzed" value={formatAnalyzedAt(analysis.analyzed_at)} />
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className={enterpriseIndigoGradientActionButtonClass()}
                  disabled={analyzing || loading}
                  onClick={() => void runAnalysis()}
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                  ) : (
                    <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                  )}
                  {analysis ? 'Re-analyze docs' : 'Analyze docs & plan scenarios'}
                </button>
              </div>
            </div>

            {isStale ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Project Docs changed since the last analysis.</span>
                <Button type="button" size="sm" variant="outline" className="h-7" disabled={analyzing} onClick={() => void runAnalysis()}>
                  Re-analyze
                </Button>
              </div>
            ) : null}

            {analyzing ? (
              <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/40 px-4 py-3 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/25 dark:via-slate-900/30 dark:to-violet-950/15">
                <div className="space-y-2">
                  {ANALYSIS_STEPS.map((step, index) => {
                    const done = index < stepIndex
                    const active = index === stepIndex
                    return (
                      <div key={step} className="flex items-center gap-2 text-sm">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                        ) : active ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/50" aria-hidden />
                        )}
                        <span className={cn(active ? 'font-medium text-foreground' : 'text-muted-foreground')}>{step}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {analysis && analysis.verdict === 'insufficient' ? (
              <div className="space-y-3 rounded-xl border border-amber-200/60 bg-amber-50/30 p-4 dark:border-amber-900/40 dark:bg-amber-950/15">
                <div className="flex items-start gap-2">
                  <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Documentation not sufficient for full scenario planning</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{analysis.verdict_summary}</p>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {analysis.gap_items.map((item) => (
                    <GapReportCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ) : null}

            {analysis ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1 shadow-inner dark:border-slate-700/50 dark:bg-slate-900/50">
                  {([
                    ['source', 'Source analysis', FileSearch],
                    ['plan', 'Scenario plan', ClipboardList],
                    ['catalog', 'Scenario catalog', ListChecks],
                  ] as const).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200',
                        activeTab === key
                          ? scenariosTabActiveClass
                          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100',
                      )}
                      onClick={() => setActiveTab(key)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className={cn(scenariosInnerShellClass, !analysis && 'border-dashed')}>
            {loading && !analysis ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading scenario workspace…
              </div>
            ) : !analysis ? (
              renderEmptyState()
            ) : activeTab === 'source' ? (
              renderSourceTab()
            ) : activeTab === 'plan' ? (
              renderPlanTab()
            ) : (
              renderCatalogTab()
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="min-h-[50vh]" aria-hidden />
        {createPortal(panel, document.body)}
      </>
    )
  }

  return panel
}
