import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  FileSearch,
  GripVertical,
  ArrowUpDown,
  Layers3,
  Loader2,
  Maximize2,
  Minimize2,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  ListChecks,
  Target,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { createWorkItem, TECTONA_PROJECT_WORKSPACE } from '@/lib/api/workApi'
import { cn } from '@/lib/utils'
import {
  enterpriseCyanGradientActionButtonClass,
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
  ScenarioExecution,
  ScenarioExecutionStatus,
  ScenarioPriority,
  ScenarioSourceType,
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
  'h-10 text-[10px] uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300',
)

const scenariosTableBodyClass = cn(PROJECT_LIST_TABLE_BODY_CELL_CLASS, 'px-3 py-2.5 text-xs')

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

type TestCaseDetailTab = 'overview' | 'steps' | 'traceability' | 'execution' | 'evidence'

type ManualScenarioDraft = {
  title: string
  priority: ScenarioPriority
  preconditions: string
  steps: string
  expectedResult: string
}

function ManualScenarioDialog({
  open,
  initial,
  onOpenChange,
  onSave,
}: {
  open: boolean
  initial?: ScenarioCatalogItem | null
  onOpenChange: (open: boolean) => void
  onSave: (draft: ManualScenarioDraft) => void
}) {
  const [draft, setDraft] = useState<ManualScenarioDraft>({
    title: '', priority: 'P2', preconditions: '', steps: '', expectedResult: '',
  })

  useEffect(() => {
    setDraft({
      title: initial?.title ?? '',
      priority: initial?.priority ?? 'P2',
      preconditions: initial?.preconditions.join('\n') ?? '',
      steps: initial?.steps.join('\n') ?? '',
      expectedResult: initial?.expected_result ?? '',
    })
  }, [initial, open])

  const fieldClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40'
  const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle>{initial ? 'Edit scenario' : 'Add scenario manually'}</DialogTitle>
          <DialogDescription>
            Create a scenario draft without waiting for document analysis. One item per line is saved as a separate precondition or step.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Scenario title</span>
            <input className={fieldClass} value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="e.g. User can submit a valid payment request" />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Priority</span>
            <select className={fieldClass} value={draft.priority} onChange={(event) => setDraft((prev) => ({ ...prev, priority: event.target.value as ScenarioPriority }))}>
              <option value="P1">P1 — Critical</option><option value="P2">P2 — Important</option><option value="P3">P3 — Normal</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Source</span>
            <div className="flex h-[38px] items-center rounded-lg border border-border bg-muted/30 px-3 text-sm text-muted-foreground">Manual scenario</div>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preconditions</span>
            <textarea className={cn(fieldClass, 'min-h-24 resize-y')} value={draft.preconditions} onChange={(event) => setDraft((prev) => ({ ...prev, preconditions: event.target.value }))} placeholder="User is authenticated\nRequired master data available" />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Steps / procedure</span>
            <textarea className={cn(fieldClass, 'min-h-24 resize-y')} value={draft.steps} onChange={(event) => setDraft((prev) => ({ ...prev, steps: event.target.value }))} placeholder="Open feature entry point\nComplete form with valid data\nSubmit the action" />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Expected result</span>
            <textarea className={cn(fieldClass, 'min-h-20 resize-y')} value={draft.expectedResult} onChange={(event) => setDraft((prev) => ({ ...prev, expectedResult: event.target.value }))} placeholder="Operation succeeds and confirmation is shown to the user." />
          </label>
        </div>
        <DialogFooter className="border-t border-border/70 px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            className={enterpriseIndigoGradientActionButtonClass()}
            disabled={!draft.title.trim() || lines(draft.steps).length === 0 || !draft.expectedResult.trim()}
            onClick={() => onSave(draft)}
          >
            {initial ? 'Save changes' : 'Add scenario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const executionStatusLabels: Record<ScenarioExecutionStatus, string> = {
  not_run: 'Not run',
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
  skipped: 'Skipped',
}

function executionStatusClass(status: ScenarioExecutionStatus): string {
  if (status === 'passed') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'blocked') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function ScenarioTestCaseDialog({
  item,
  open,
  onOpenChange,
  onExecutionSaved,
}: {
  item: ScenarioCatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onExecutionSaved: (execution: ScenarioExecution) => void
}) {
  const [activeTab, setActiveTab] = useState<TestCaseDetailTab>('overview')
  const [executionStatus, setExecutionStatus] = useState<ScenarioExecutionStatus>(item?.execution?.status ?? 'not_run')
  const [actualResult, setActualResult] = useState(item?.execution?.actual_result ?? '')
  const [evidenceUrl, setEvidenceUrl] = useState(item?.execution?.evidence_urls?.[0] ?? '')

  if (!item) return null

  const saveExecution = () => {
    onExecutionSaved({
      status: executionStatus,
      actual_result: actualResult.trim() || undefined,
      executed_at: new Date().toISOString(),
      evidence_urls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
    })
    setActiveTab('overview')
  }

  const tabs: Array<[TestCaseDetailTab, string]> = [
    ['overview', 'Overview'],
    ['steps', 'Test Plan'],
    ['traceability', 'Traceability'],
    ['execution', 'Execution'],
    ['evidence', 'Evidence'],
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="test-case-dialog-surface w-full max-w-[min(92vw,560px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <DialogHeader className="m-0 border-b border-slate-200/80 p-5 dark:border-slate-700/70">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">Test case specification</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.id}</p>
                  <DialogTitle className="mt-1 text-lg leading-tight">{item.title}</DialogTitle>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={item.priority} />
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-semibold', executionStatusClass(item.execution?.status ?? 'not_run'))}>
                    {executionStatusLabels[item.execution?.status ?? 'not_run']}
                  </span>
                </div>
              </div>
              <DialogDescription className="mt-2 text-xs leading-relaxed">
                {item.domain_name} / {item.group_name}. Review the test plan, traceability, and execution evidence.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mx-5 mt-4 flex flex-wrap gap-1 rounded-xl border border-slate-200/70 bg-slate-100/70 p-1 dark:border-slate-700/50 dark:bg-slate-800/70">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-semibold transition',
                activeTab === key ? scenariosTabActiveClass : 'text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-slate-800/70',
              )}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mx-5 mt-3 max-h-[38vh] min-h-[180px] overflow-y-auto rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-700/50 dark:bg-slate-950/30">
          {activeTab === 'overview' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Preconditions</p>
                {item.preconditions.length > 0 ? (
                  <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {item.preconditions.map((line) => <li key={line} className="flex gap-2"><span className="text-indigo-500">•</span>{line}</li>)}
                  </ul>
                ) : <p className="mt-2 text-sm text-muted-foreground">No preconditions defined.</p>}
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expected result</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{item.expected_result || 'No expected result defined.'}</p>
              </div>
            </div>
          ) : null}

          {activeTab === 'steps' ? (
            <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/50">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-muted-foreground dark:bg-slate-900/60">
                  <tr><th className="w-12 px-3 py-2">#</th><th className="px-3 py-2">Step / Procedure</th><th className="w-[32%] px-3 py-2">Expected result</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {item.steps.length > 0 ? item.steps.map((step, index) => (
                    <tr key={`${item.id}-step-${index}`} className="align-top">
                      <td className="px-3 py-3 font-semibold text-indigo-600">{index + 1}</td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{step}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{index === item.steps.length - 1 ? item.expected_result : 'Continue to the next step.'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">No test steps defined.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === 'traceability' ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Requirement / source references</p>
                {item.traceability.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {item.traceability.map((ref) => (
                      <div key={`${ref.document_id}-${ref.reference}`} className="rounded-lg border border-indigo-200/60 bg-white/80 px-3 py-2 text-sm dark:border-indigo-900/40 dark:bg-slate-900/40">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{ref.document_title ?? ref.document_id}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{ref.reference}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-2 text-sm text-muted-foreground">No source reference was generated for this test case.</p>}
              </div>
              <p className="text-xs text-muted-foreground">Traceability links this test case back to the document evidence used by the analysis.</p>
            </div>
          ) : null}

          {activeTab === 'execution' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground" htmlFor="scenario-execution-status">Execution status</label>
                <select id="scenario-execution-status" value={executionStatus} onChange={(event) => setExecutionStatus(event.target.value as ScenarioExecutionStatus)} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                  {Object.entries(executionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground" htmlFor="scenario-actual-result">Actual result</label>
                <textarea id="scenario-actual-result" value={actualResult} onChange={(event) => setActualResult(event.target.value)} rows={5} placeholder="Describe what happened during execution..." className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900" />
              </div>
              {item.execution?.executed_at ? <p className="text-xs text-muted-foreground">Last executed: {formatAnalyzedAt(item.execution.executed_at)}</p> : null}
            </div>
          ) : null}

          {activeTab === 'evidence' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground" htmlFor="scenario-evidence-url">Evidence URL</label>
                <input id="scenario-evidence-url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://..." className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900" />
                <p className="mt-1.5 text-xs text-muted-foreground">Attach a screenshot, recording, report, or defect link to this execution.</p>
              </div>
              {item.execution?.evidence_urls?.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/50">{item.execution.evidence_urls[0]}</div> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-4 w-full flex-row justify-between border-t border-slate-200/80 px-5 py-3.5 dark:border-slate-700/70">
          <Button type="button" variant="outline" className="!h-9 !min-h-9 min-w-0 flex-1 items-center rounded-lg border-slate-300 bg-white py-0 font-medium leading-none text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800" style={{ height: 36, minHeight: 36 }} onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" className="!h-9 !min-h-9 min-w-0 flex-1 items-center rounded-lg bg-indigo-600 py-0 font-medium leading-none text-white shadow-sm hover:bg-indigo-700" style={{ height: 36, minHeight: 36 }} onClick={saveExecution}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Save execution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [documentsAvailable, setDocumentsAvailable] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(() => new Set())
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])
  const [selectedTestCase, setSelectedTestCase] = useState<ScenarioCatalogItem | null>(null)
  const [manualScenarioOpen, setManualScenarioOpen] = useState(false)
  const [editingScenario, setEditingScenario] = useState<ScenarioCatalogItem | null>(null)
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
        setDocumentsAvailable(context.documents.length)
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
    setAnalysisError(null)
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
      setDocumentsAvailable(context.documents.length)

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
      const message = error instanceof Error ? error.message : 'Unable to analyze project documents.'
      setAnalysisError(message)
      addToast({
        title: 'Analysis failed',
        description: message,
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

  const saveManualScenario = useCallback((draft: ManualScenarioDraft) => {
    const current = loadProjectScenarioState(project.id)
    if (!current) return

    const toLines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean)
    const source: Pick<ScenarioCatalogItem, 'source_type' | 'source_label'> = {
      source_type: 'manual' as ScenarioSourceType,
      source_label: 'Manual scenario',
    }

    if (editingScenario) {
      const patch = {
        title: draft.title.trim(),
        priority: draft.priority,
        preconditions: toLines(draft.preconditions),
        steps: toLines(draft.steps),
        expected_result: draft.expectedResult.trim(),
        ...source,
      }
      const updated = updateScenarioCatalogItem(project.id, editingScenario.id, patch)
      if (updated) setAnalysis(updated.analysis)
      setEditingScenario(null)
      setManualScenarioOpen(false)
      addToast({ title: 'Scenario updated', description: 'Manual scenario changes have been saved.', variant: 'success' })
      return
    }

    const domain = current.analysis.plan_domains[0] ?? {
      id: 'manual-domain', name: 'Manual scenarios', groups: [],
    }
    const group = domain.groups[0] ?? {
      id: 'manual-group', name: 'User-defined', scenarios: [],
    }
    const id = `SCN-manual-${Date.now()}`
    const scenario = {
      id,
      title: draft.title.trim(),
      priority: draft.priority,
      preconditions: toLines(draft.preconditions),
      steps: toLines(draft.steps),
      expected_result: draft.expectedResult.trim(),
      traceability: [],
      ...source,
    }
    const nextDomain = domain.id === 'manual-domain' && current.analysis.plan_domains.length === 0
      ? { ...domain, groups: [{ ...group, scenarios: [scenario] }] }
      : {
        ...domain,
        groups: domain.groups.length === 0
          ? [{ ...group, scenarios: [scenario] }]
          : domain.groups.map((item) => item.id === group.id ? { ...item, scenarios: [...item.scenarios, scenario] } : item),
      }
    const nextAnalysis = {
      ...current.analysis,
      plan_domains: current.analysis.plan_domains.length === 0
        ? [nextDomain]
        : current.analysis.plan_domains.map((item) => item.id === domain.id ? nextDomain : item),
      catalog: [...current.analysis.catalog, {
        ...scenario,
        domain_id: domain.id,
        domain_name: domain.name,
        group_id: group.id,
        group_name: group.name,
        status: 'draft' as const,
        work_item_id: null,
      }],
    }
    saveProjectScenarioState({ ...current, analysis: nextAnalysis })
    setAnalysis(nextAnalysis)
    setExpandedDomains((previous) => new Set(previous).add(domain.id))
    setManualScenarioOpen(false)
    addToast({ title: 'Scenario added', description: 'The manual scenario is available in the plan and catalog as a draft.', variant: 'success' })
  }, [addToast, editingScenario, project.id])

  const saveScenarioExecution = useCallback(
    (execution: ScenarioExecution) => {
      if (!selectedTestCase) return
      const updated = updateScenarioCatalogItem(project.id, selectedTestCase.id, { execution })
      if (!updated) return
      const nextItem = updated.analysis.catalog.find((item) => item.id === selectedTestCase.id) ?? null
      setAnalysis(updated.analysis)
      setSelectedTestCase(nextItem)
      addToast({
        title: 'Test case execution saved',
        description: nextItem ? `${nextItem.title} is now marked ${executionStatusLabels[execution.status]}.` : 'Execution details were saved.',
        variant: 'success',
      })
    },
    [addToast, project.id, selectedTestCase],
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
            {analysis.source_documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-sm text-muted-foreground">
                  No project documents were available for analysis. Open Project Docs and add a BRD, FSD, URD, or supporting delivery artifact.
                </td>
              </tr>
            ) : analysis.source_documents.map((item) => (
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
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" aria-hidden />
          </span>
          <div className="max-w-xl space-y-2">
            <p className="text-sm font-semibold text-foreground">Scenario plan needs more documentation</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Analysis completed, but there is not enough testable acceptance criteria to build a reliable scenario plan.
              Review the gaps in Source analysis, add the missing project documentation, and run the analysis again.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {onNavigateDocs ? (
              <Button type="button" variant="outline" size="sm" onClick={onNavigateDocs}>
                Open Project Docs
              </Button>
            ) : null}
            <Button type="button" size="sm" disabled={analyzing || loading} onClick={() => void runAnalysis()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Re-analyze
            </Button>
          </div>
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
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{scenario.title}</p>
                                <span className={cn(
                                  'rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                                  scenario.source_type === 'manual'
                                    ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
                                )}>
                                  {scenario.source_label ?? (scenario.source_type === 'manual' ? 'Manual' : 'AI generated')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority={scenario.priority} />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-[11px]"
                                onClick={() => {
                                  const item = analysis.catalog.find((candidate) => candidate.id === scenario.id) ?? null
                                  setEditingScenario(item)
                                  setManualScenarioOpen(true)
                                }}
                              >
                                <PencilLine className="h-3 w-3" aria-hidden />
                                Edit
                              </Button>
                            </div>
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
                                Steps / procedure
                              </p>
                              <div className="mt-2 space-y-2.5">
                                {scenario.steps.length > 0 ? scenario.steps.map((line, index) => (
                                  <div key={`${scenario.id}-step-${index}`} className="flex gap-2.5 rounded-lg border border-slate-200/60 bg-white/70 px-2.5 py-2 dark:border-slate-700/50 dark:bg-slate-900/40">
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                      {index + 1}
                                    </span>
                                    <div className="min-w-0 space-y-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Action / procedure</p>
                                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{line}</p>
                                      <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                        <span className="font-semibold text-slate-600 dark:text-slate-300">Checkpoint: </span>
                                        {index === scenario.steps.length - 1 ? scenario.expected_result : 'Step completed before continuing to the next procedure.'}
                                      </p>
                                    </div>
                                  </div>
                                )) : (
                                  <p className="text-xs text-muted-foreground">No test steps defined.</p>
                                )}
                              </div>
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
          'group border-l-2 border-l-transparent transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/30',
          selected && 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20',
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
              'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize shadow-sm',
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-md px-2.5 text-[11px]"
              onClick={() => setSelectedTestCase(item)}
            >
              Open test case
            </Button>
            {item.status !== 'reviewed' && item.status !== 'ready' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(enterpriseSecondaryButtonClass(), 'h-8 rounded-md px-2.5 text-[11px]')}
                onClick={() => updateScenarioStatus(item.id, 'reviewed')}
              >
                Mark reviewed
              </Button>
            ) : null}
            {item.status !== 'ready' ? (
              <Button
                type="button"
                size="sm"
                className={cn(enterpriseIndigoGradientActionButtonClass(), 'h-8 rounded-md px-2.5 text-[11px]')}
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
        <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm dark:border-slate-700/60 dark:bg-slate-950/20">
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
                <th className={cn(scenariosTableHeadClass, PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS)}>
                  <div className="flex items-center gap-1.5"><GripVertical className="h-3.5 w-3.5 text-slate-400/80" aria-hidden /><span>Scenario</span><ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden /></div>
                </th>
                <th className={scenariosTableHeadClass}><div className="flex items-center gap-1.5"><GripVertical className="h-3.5 w-3.5 text-slate-400/80" aria-hidden /><span>Priority</span><ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden /></div></th>
                <th className={scenariosTableHeadClass}><div className="flex items-center gap-1.5"><GripVertical className="h-3.5 w-3.5 text-slate-400/80" aria-hidden /><span>Status</span><ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden /></div></th>
                <th className={scenariosTableHeadClass}><div className="flex items-center gap-1.5"><GripVertical className="h-3.5 w-3.5 text-slate-400/80" aria-hidden /><span>Work item</span></div></th>
                <th className={scenariosTableHeadClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {analysis.catalog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                      <ListChecks className="h-8 w-8 text-indigo-400" aria-hidden />
                      <p className="text-sm font-semibold text-foreground">No executable scenarios yet</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Scenarios will appear here after the documentation passes readiness checks and a scenario plan is generated.
                      </p>
                      <Button type="button" size="sm" variant="outline" className="mt-1" onClick={() => setActiveTab('plan')}>
                        Open Scenario Plan
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                analysis.catalog.map(renderCatalogRow)
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    )
  }

  const renderEmptyState = () => {
    if (analyzing) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-indigo-200/70 bg-indigo-50/20 px-6 py-12 text-center dark:border-indigo-900/40 dark:bg-indigo-950/10">
          <Loader2 className="h-9 w-9 animate-spin text-indigo-600" aria-hidden />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Analyzing project documents</h3>
            <p className="text-sm text-muted-foreground">The progress above will update as the analysis moves through each step.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-dashed border-indigo-200/70 bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/50 px-6 py-12 text-center dark:border-indigo-900/40 dark:from-indigo-950/20 dark:via-slate-900/20 dark:to-slate-950/30">
        {panelMeta.illustrationSrc ? (
          <img src={panelMeta.illustrationSrc} alt="" className="h-auto w-full max-w-[13rem] object-contain drop-shadow-sm" loading="lazy" />
        ) : (
          <ListChecks className="h-10 w-10 text-indigo-500/70" strokeWidth={1.5} aria-hidden />
        )}
        <div className="max-w-lg space-y-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Plan test scenarios from Project Docs</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Analyze BRD, FSD, URD, and linked Idea context to identify suitable references, documentation gaps, and test scenarios.
          </p>
          <p className="text-xs text-muted-foreground">
            {documentsAvailable > 0 ? `${documentsAvailable} document${documentsAvailable === 1 ? '' : 's'} ready to scan.` : 'Add delivery documents before starting analysis.'}
          </p>
        </div>
        <button
          type="button"
          className={enterpriseIndigoGradientActionButtonClass()}
          disabled={loading}
          onClick={() => void runAnalysis()}
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          Analyze docs &amp; plan scenarios
        </button>
        {onNavigateDocs ? (
          <Button type="button" variant="outline" size="sm" onClick={onNavigateDocs}>
            Upload document or generate from template
          </Button>
        ) : null}
      </div>
    )
  }

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
        'liquid-glass-enterprise-panel flex min-h-0 flex-col overflow-hidden border border-border/40',
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
                  <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none',
                        analysis.gap_items.length > 0
                          ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200',
                      )}
                    >
                      {analysis.gap_items.length > 0
                        ? `${analysis.gap_items.length} documentation gap${analysis.gap_items.length === 1 ? '' : 's'} need attention before full scenario planning.`
                        : 'Documentation passed the initial scenario-readiness checks.'}
                    </span>
                    {activeTab === 'catalog' && analysis.catalog.length > 0 ? (
                      <>
                        <span className="text-slate-300 dark:text-slate-600" aria-hidden>|</span>
                        <span>Select scenarios to create executable test tasks in the project backlog.</span>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {activeTab === 'catalog' && analysis && analysis.catalog.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn(enterpriseCyanGradientActionButtonClass(), '!h-10 !min-h-10 !py-0 text-xs')}
                  disabled={creatingWorkItems || selectedScenarioIds.length === 0}
                  onClick={() => void createWorkItemsFromScenarios()}
                >
                  {creatingWorkItems ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Create test work items ({selectedScenarioIds.length})
                </Button>
              ) : null}
              {activeTab === 'plan' && analysis ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn(enterpriseCyanGradientActionButtonClass(), '!h-10 !min-h-10 !py-0 text-xs')}
                  onClick={() => {
                    setEditingScenario(null)
                    setManualScenarioOpen(true)
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Add scenario
                </Button>
              ) : null}
              <button
                  type="button"
                  className={enterpriseIndigoGradientActionButtonClass()}
                  disabled={analyzing || loading}
                  aria-busy={analyzing}
                  onClick={() => void runAnalysis()}
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                  ) : (
                    <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                  )}
                  {analyzing ? 'Analyzing…' : analysis ? 'Re-analyze docs' : 'Analyze docs & plan scenarios'}
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

            {analysisError ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3 py-2.5 text-xs text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Analysis could not be completed</p>
                  <p className="mt-0.5 truncate text-rose-800/80 dark:text-rose-200/80" title={analysisError}>{analysisError}</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="h-7 border-rose-300 bg-white/70 text-rose-800 hover:bg-white dark:border-rose-800 dark:bg-slate-900/40 dark:text-rose-200" disabled={analyzing} onClick={() => void runAnalysis()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry analysis
                </Button>
              </div>
            ) : null}

            {analyzing ? (
              <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/40 px-4 py-3 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/25 dark:via-slate-900/30 dark:to-violet-950/15">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Analysis in progress</span>
                  <span>Step {Math.min(stepIndex + 1, ANALYSIS_STEPS.length)} of {ANALYSIS_STEPS.length}</span>
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                    style={{ width: `${((stepIndex + 1) / ANALYSIS_STEPS.length) * 100}%` }}
                  />
                </div>
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
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1 shadow-inner dark:border-slate-700/50 dark:bg-slate-900/50">
                  <div className="flex min-w-0 flex-wrap gap-1">
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
                  <div className="ml-auto flex flex-wrap justify-end gap-1.5 px-1">
                    <StatusChip label="Docs scanned" value={analysis.docs_scanned} />
                    <StatusChip label="Suitable refs" value={suitableCount} tone={suitableCount > 0 ? 'success' : 'warning'} />
                    <StatusChip label="Scenarios" value={analysis.catalog.length} />
                    <StatusChip
                      label="Readiness"
                      value={`${analysis.readiness_score}%`}
                      tone={analysis.readiness_score >= 70 ? 'success' : 'warning'}
                    />
                    <StatusChip label="Analyzed" value={formatAnalyzedAt(analysis.analyzed_at)} />
                  </div>
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

  const testCaseDialog = (
    <ScenarioTestCaseDialog
      key={selectedTestCase ? `${selectedTestCase.id}-${selectedTestCase.execution?.executed_at ?? 'new'}` : 'empty'}
      item={selectedTestCase}
      open={Boolean(selectedTestCase)}
      onOpenChange={(open) => {
        if (!open) setSelectedTestCase(null)
      }}
      onExecutionSaved={saveScenarioExecution}
    />
  )

  const manualScenarioDialog = (
    <ManualScenarioDialog
      open={manualScenarioOpen}
      initial={editingScenario}
      onOpenChange={(open) => {
        setManualScenarioOpen(open)
        if (!open) setEditingScenario(null)
      }}
      onSave={saveManualScenario}
    />
  )

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="min-h-[50vh]" aria-hidden />
        {createPortal(panel, document.body)}
        {testCaseDialog}
        {manualScenarioDialog}
      </>
    )
  }

  return (
    <>
      {panel}
      {testCaseDialog}
      {manualScenarioDialog}
    </>
  )
}
