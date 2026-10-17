import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Info, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  enterprisePrimarySolidButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { listIdeas, toDisplayStatus, type BackendIdeaStatus, type IdeaApi } from '@/lib/api/ideaBacklogApi'
import { projectTemplateTag } from '../data/projectTemplates'
import { getProjectPanelCatalogEntry } from '../lib/projectPanelCatalog'
import { measureProjectPanelHeight, PROJECT_PANEL_MIN_HEIGHT_PX } from '../lib/projectPanelLayout'
import { linkIdeaToSubProject, type SubProjectEntry } from '../lib/subProjects'
import { useProjectStore, type Project } from '../store/projectStore'

const LINKABLE_STATUSES = new Set<BackendIdeaStatus>(['submitted', 'gate1_approved', 'gate2_approved', 'on_hold', 'converted'])

function healthOf(entry: SubProjectEntry): { label: string; className: string } {
  if (entry.summary.overdue > 0) return { label: 'At risk', className: 'border-rose-200 bg-rose-50 text-rose-700' }
  if (entry.summary.total > 0 && entry.summary.donePct === 100) {
    return { label: 'Done', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  return { label: 'On track', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
}

export function NewSubProjectDialog({
  open,
  onOpenChange,
  parent,
  parentIdeas,
  preselectedIdeaId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parent: Project
  /** Ideas linked directly to the program; they move into the new sub-project. */
  parentIdeas: IdeaApi[]
  preselectedIdeaId?: string | null
  onCreated: (child: Project) => void
}) {
  const { addToast } = useToast()
  const addProject = useProjectStore((state) => state.addProject)
  const [freeIdeas, setFreeIdeas] = useState<IdeaApi[]>([])
  const [ideaId, setIdeaId] = useState('')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setIdeaId(preselectedIdeaId ?? '')
    setNameTouched(false)
    let cancelled = false
    void listIdeas({ workspace_id: parent.workspaceId ?? undefined, page_size: 200 })
      .then((response) => {
        if (cancelled) return
        setFreeIdeas(response.items.filter((idea) => !idea.project_id && LINKABLE_STATUSES.has(idea.status_code)))
      })
      .catch(() => {
        if (!cancelled) setFreeIdeas([])
      })
    return () => {
      cancelled = true
    }
  }, [open, parent.workspaceId, preselectedIdeaId])

  const allIdeas = useMemo(() => [...parentIdeas, ...freeIdeas], [freeIdeas, parentIdeas])
  const selectedIdea = allIdeas.find((idea) => idea.id === ideaId) ?? null

  useEffect(() => {
    if (!nameTouched) setName(selectedIdea?.title.slice(0, 255) ?? '')
  }, [nameTouched, selectedIdea])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return
      event.preventDefault()
      onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, saving, onOpenChange])

  const valid = Boolean(selectedIdea) && name.trim().length > 0

  const handleCreate = async () => {
    if (!selectedIdea || !valid || saving) return
    setSaving(true)
    try {
      if (parent.hierarchySupported === false) {
        throw new Error("This environment's project service does not support sub-projects yet.")
      }
      const child = await addProject({
        name: name.trim(),
        description: `Sub-project of ${parent.name} delivering the idea "${selectedIdea.title}".`,
        tags: [projectTemplateTag('kanban')],
        parentProjectId: parent.id,
      })
      if (child.parentProjectId !== parent.id) {
        // Defensive: the service accepted the project but did not attach it; never move the idea then.
        throw new Error(`${child.name} was created as a standalone project; the project service did not attach it.`)
      }
      try {
        await linkIdeaToSubProject(selectedIdea, child.id)
      } catch (error: unknown) {
        addToast({
          title: 'Sub-project created, idea not linked',
          description: error instanceof Error ? error.message : 'Link the idea from the sub-project page.',
          variant: 'error',
        })
      }
      onCreated(child)
      onOpenChange(false)
      addToast({ title: 'Sub-project created', description: `${child.name} is now part of ${parent.name}.`, variant: 'success' })
    } catch (error: unknown) {
      addToast({
        title: 'Could not create sub-project',
        description: error instanceof Error ? error.message : 'Project service rejected the request.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close new sub-project dialog"
        disabled={saving}
        onClick={() => onOpenChange(false)}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-sub-project-title"
        className="relative z-[1401] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
        onSubmit={(event) => {
          event.preventDefault()
          void handleCreate()
        }}
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <h3 id="new-sub-project-title" className="text-base font-semibold text-foreground">
            New sub-project in {parent.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A sub-project delivers exactly one idea, with its own board, Docs and members. It starts from the Kanban template.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <label htmlFor="new-sub-project-idea" className="text-sm font-medium text-foreground">
              Idea
            </label>
            <select
              id="new-sub-project-idea"
              value={ideaId}
              onChange={(event) => setIdeaId(event.target.value)}
              disabled={saving}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose an idea…</option>
              {parentIdeas.length > 0 ? (
                <optgroup label={`Linked to ${parent.name} (moves into the sub-project)`}>
                  {parentIdeas.map((idea) => (
                    <option key={idea.id} value={idea.id}>
                      {idea.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {freeIdeas.length > 0 ? (
                <optgroup label="Not in any project yet">
                  {freeIdeas.map((idea) => (
                    <option key={idea.id} value={idea.id}>
                      {idea.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            {selectedIdea ? (
              <p className="text-xs text-muted-foreground">Stage: {toDisplayStatus(selectedIdea.status_code)}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-sub-project-name" className="text-sm font-medium text-foreground">
              Sub-project name
            </label>
            <Input
              id="new-sub-project-name"
              value={name}
              maxLength={255}
              disabled={saving}
              onChange={(event) => {
                setNameTouched(true)
                setName(event.target.value)
              }}
              placeholder="Defaults to the idea title"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className={enterpriseSecondaryButtonClass()}
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" className={cn(enterprisePrimarySolidButtonClass(), 'gap-2')} disabled={!valid || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            Create sub-project
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export function ProjectSubProjectsPanel({
  project,
  entries,
  loading,
  parentIdeas,
  onChanged,
}: {
  project: Project
  entries: SubProjectEntry[]
  loading?: boolean
  parentIdeas: IdeaApi[]
  onChanged: () => void
}) {
  const panel = getProjectPanelCatalogEntry('subprojects')
  const PanelIcon = panel.icon
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

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

  return (
    <div
      ref={panelRef}
      id="panel-subprojects"
      style={
        panelHeightPx != null
          ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
          : undefined
      }
      className={cn(
        'scroll-mt-24',
        'liquid-glass-enterprise-panel flex min-h-0 flex-col overflow-hidden border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        'rounded-2xl',
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-5">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <PanelIcon className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
              <h2 className="text-lg font-semibold text-foreground">Project {panel.label}</h2>
            </div>
            <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">{panel.description}</p>
          </div>
          <Button
            type="button"
            className={cn(enterprisePrimarySolidButtonClass(), 'gap-2')}
            disabled={project.hierarchySupported === false}
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New sub-project
          </Button>
        </div>

        {project.hierarchySupported === false ? (
          <p className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            The project service in this environment does not support sub-projects yet. Deploy the updated project
            service, then reload this page.
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading sub-projects…
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {entries.map((entry) => {
                const health = healthOf(entry)
                return (
                  <article
                    key={entry.project.id}
                    className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-background/80 p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            Sub-project
                          </span>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', health.className)}>
                            {health.label}
                          </span>
                        </div>
                        <h3 className="truncate text-base font-semibold text-foreground" title={entry.project.name}>
                          {entry.project.name}
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Idea · locked</p>
                      {entry.idea ? (
                        <>
                          <button
                            type="button"
                            className="block max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary hover:underline"
                            title={entry.idea.title}
                            onClick={() => navigate(`/idea-backlog/${entry.idea?.id}`)}
                          >
                            {entry.idea.title}
                          </button>
                          <span className="text-xs text-muted-foreground">{toDisplayStatus(entry.idea.status_code)}</span>
                        </>
                      ) : (
                        <p className="text-sm text-amber-700">No idea linked yet</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-foreground">{entry.summary.donePct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${entry.summary.donePct}%` }} />
                      </div>
                    </div>

                    <dl className="grid grid-cols-4 gap-2 text-center">
                      {[
                        ['Items', entry.summary.total],
                        ['Done', entry.summary.done],
                        ['Review', entry.summary.inReview],
                        ['Overdue', entry.summary.overdue],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg bg-muted/20 px-1 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
                          <dd
                            className={cn(
                              'mt-0.5 text-lg font-semibold',
                              label === 'Overdue' && Number(value) > 0 ? 'text-rose-600' : 'text-foreground',
                            )}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <Button
                      type="button"
                      variant="outline"
                      className="mt-auto justify-center gap-1.5"
                      onClick={() => navigate(`/projects/${entry.project.id}`)}
                    >
                      Open sub-project
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </article>
                )
              })}

              <button
                type="button"
                disabled={project.hierarchySupported === false}
                onClick={() => setDialogOpen(true)}
                className="flex min-h-[260px] disabled:cursor-not-allowed disabled:opacity-50 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/70 px-6 text-center transition hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Plus className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-foreground">Add a sub-project</span>
                <span className="max-w-[16rem] text-xs text-muted-foreground">
                  Pick an idea. A new project is created for it under {project.name}.
                </span>
              </button>
            </div>
          )}
        </div>

        <p className="flex shrink-0 items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Sub-projects hold one idea each and cannot have sub-projects of their own. Deleting {project.name} keeps its
          sub-projects as standalone projects.
        </p>
      </div>

      <NewSubProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        parent={project}
        parentIdeas={parentIdeas}
        onCreated={() => onChanged()}
      />
    </div>
  )
}
