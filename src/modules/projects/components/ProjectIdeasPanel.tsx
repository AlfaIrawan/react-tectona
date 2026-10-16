import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Info, Lightbulb, Link2, Loader2, Plus, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  enterprisePrimarySolidButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import {
  createIdea,
  patchIdea,
  toDisplayStatus,
  type BackendIdeaStatus,
  type IdeaApi,
} from '@/lib/api/ideaBacklogApi'
import type { DocumentResponse } from '@/lib/api/documentKnowledgeApi'
import type { Project } from '../store/projectStore'
import { getProjectPanelCatalogEntry } from '../lib/projectPanelCatalog'
import { measureProjectPanelHeight, PROJECT_PANEL_MIN_HEIGHT_PX } from '../lib/projectPanelLayout'
import { fetchDocumentsGroupedByIdea } from '../lib/ideaLinkedDocuments'
import { fetchIdentityDisplayNameMap } from '../lib/projectMemberIdentity'
import { LinkProjectIdeaModal } from './LinkProjectIdeaModal'

type DocKind = 'URD' | 'BRD' | 'FSD'
type DocReadiness = 'final' | 'draft' | 'missing'

const DOC_KINDS: DocKind[] = ['URD', 'BRD', 'FSD']
const FINAL_DOCUMENT_STATUSES = new Set(['final', 'approved', 'published'])

/** "brd-adirafinancews-…" → "BRD"; same rule Idea Docs uses to label URD/BRD/FSD. */
function documentKind(doc: DocumentResponse): DocKind | null {
  const metadata = doc.metadata ?? {}
  const candidate = metadata.doc_type_label || metadata.template_code || doc.document_type_code
  const label = typeof candidate === 'string' ? candidate.split('-', 1)[0]?.trim().toUpperCase() : ''
  return DOC_KINDS.includes(label as DocKind) ? (label as DocKind) : null
}

function readinessFor(docs: DocumentResponse[], kind: DocKind): DocReadiness {
  const ofKind = docs.filter((doc) => documentKind(doc) === kind)
  if (ofKind.length === 0) return 'missing'
  const status = (doc: DocumentResponse) =>
    String(doc.metadata?.document_status ?? doc.status_code ?? '').trim().toLowerCase()
  return ofKind.some((doc) => FINAL_DOCUMENT_STATUSES.has(status(doc))) ? 'final' : 'draft'
}

const READINESS_CLASS: Record<DocReadiness, string> = {
  final: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  missing: 'border-rose-200 bg-rose-50 text-rose-700',
}

const READINESS_LABEL: Record<DocReadiness, string> = {
  final: 'Final',
  draft: 'Draft',
  missing: 'Missing',
}

function statusChipClass(code: BackendIdeaStatus): string {
  switch (code) {
    case 'gate1_approved':
    case 'gate2_approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'converted':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'gate1_rejected':
    case 'gate2_rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'submitted':
    case 'on_hold':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function NewIdeaDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onCreated: (idea: IdeaApi) => void
}) {
  const { addToast } = useToast()
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const trimmed = title.trim()
  const valid = trimmed.length >= 3

  useEffect(() => {
    if (!open) setTitle('')
  }, [open])

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

  const handleCreate = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const created = await createIdea({
        title: trimmed,
        project_id: project.id,
        workspace_id: project.workspaceId ?? undefined,
      })
      onCreated(created)
      onOpenChange(false)
      addToast({ title: 'Idea created', description: `"${created.title}" was added to ${project.name}.`, variant: 'success' })
    } catch (error: unknown) {
      addToast({
        title: 'Could not create idea',
        description: error instanceof Error ? error.message : 'Idea Backlog rejected the request.',
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
        aria-label="Close new idea dialog"
        disabled={saving}
        onClick={() => onOpenChange(false)}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-new-idea-title"
        className="relative z-[1401] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
        onSubmit={(event) => {
          event.preventDefault()
          void handleCreate()
        }}
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <h3 id="project-new-idea-title" className="text-base font-semibold text-foreground">
            New idea in {project.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The idea is created in Idea Backlog and linked to this project. Fill in the rest on the idea page.
          </p>
        </div>
        <div className="space-y-2 px-6 py-5">
          <label htmlFor="project-new-idea-input" className="text-sm font-medium text-foreground">
            Idea title
          </label>
          <Input
            id="project-new-idea-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="At least 3 characters"
            maxLength={255}
            autoFocus
            disabled={saving}
          />
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
            Create idea
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export function ProjectIdeasPanel({
  project,
  linkedIdeas,
  loading,
  onIdeasChanged,
}: {
  project: Project
  linkedIdeas: IdeaApi[]
  loading?: boolean
  /** Reload the project's linked ideas (and anything derived from them, such as Docs). */
  onIdeasChanged: (change?: { linked?: IdeaApi }) => void
}) {
  const panel = getProjectPanelCatalogEntry('ideas')
  const PanelIcon = panel.icon
  const navigate = useNavigate()
  const { addToast } = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [newIdeaOpen, setNewIdeaOpen] = useState(false)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [docsByIdea, setDocsByIdea] = useState<Map<string, DocumentResponse[]> | null>(null)
  const [ownerNames, setOwnerNames] = useState<Map<string, string>>(new Map())

  const ideaIdsKey = linkedIdeas.map((idea) => idea.id).join(',')

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
    void fetchIdentityDisplayNameMap().then((names) => {
      if (!cancelled) setOwnerNames(names)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const ideaIds = ideaIdsKey ? ideaIdsKey.split(',') : []
    if (ideaIds.length === 0) {
      setDocsByIdea(new Map())
      return
    }
    let cancelled = false
    setDocsByIdea(null)
    void fetchDocumentsGroupedByIdea({ ideaIds, projectId: project.id, workspaceId: project.workspaceId })
      .then((grouped) => {
        if (!cancelled) setDocsByIdea(grouped)
      })
      .catch(() => {
        if (!cancelled) setDocsByIdea(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [ideaIdsKey, project.id, project.workspaceId])

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const idea of linkedIdeas) {
      const label = toDisplayStatus(idea.status_code)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return Array.from(counts, ([label, count]) => ({ label, count }))
  }, [linkedIdeas])

  const docsReadyCount = useMemo(() => {
    if (!docsByIdea) return null
    return linkedIdeas.filter((idea) =>
      DOC_KINDS.every((kind) => readinessFor(docsByIdea.get(idea.id) ?? [], kind) === 'final'),
    ).length
  }, [docsByIdea, linkedIdeas])

  const handleUnlink = async (idea: IdeaApi) => {
    setUnlinkingId(idea.id)
    try {
      await patchIdea(idea.id, { project_id: null, version: idea.version })
      onIdeasChanged()
      addToast({
        title: 'Idea unlinked',
        description: `"${idea.title}" is no longer linked to ${project.name}. Its documents stay in place.`,
        variant: 'success',
      })
    } catch (error: unknown) {
      addToast({
        title: 'Unlink failed',
        description: error instanceof Error ? error.message : 'Could not unlink idea from project.',
        variant: 'error',
      })
    } finally {
      setUnlinkingId(null)
    }
  }

  return (
    <div
      ref={panelRef}
      id="panel-ideas"
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(enterpriseSecondaryButtonClass(), 'gap-2')}
              onClick={() => setLinkModalOpen(true)}
            >
              <Link2 className="h-4 w-4" aria-hidden />
              Link existing idea
            </Button>
            <Button type="button" className={cn(enterprisePrimarySolidButtonClass(), 'gap-2')} onClick={() => setNewIdeaOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New idea
            </Button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-background/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ideas</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{linkedIdeas.length}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Docs ready</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {docsReadyCount == null ? '…' : `${docsReadyCount} / ${linkedIdeas.length}`}
            </p>
            <p className="text-[11px] text-muted-foreground">URD + BRD + FSD final</p>
          </div>
          <div className="col-span-2 rounded-xl border border-border/50 bg-background/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">By stage</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stageCounts.length === 0 ? (
                <span className="text-sm text-muted-foreground">No ideas yet</span>
              ) : (
                stageCounts.map((stage) => (
                  <span key={stage.label} className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {stage.label} · {stage.count}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/40 bg-background/60">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading ideas…
            </div>
          ) : linkedIdeas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Lightbulb className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} aria-hidden />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">No ideas linked yet</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  A project can deliver several ideas. Link ones that already exist in Idea Backlog, or start a new one here.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 z-[1] bg-muted/60 backdrop-blur">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-3">Idea</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">URD · BRD · FSD</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {linkedIdeas.map((idea) => {
                  const docs = docsByIdea?.get(idea.id) ?? []
                  const ownerName = idea.owner_id ? ownerNames.get(idea.owner_id) ?? '—' : '—'
                  return (
                    <tr key={idea.id} className="border-t border-border/40 align-middle">
                      <td className="max-w-[360px] px-4 py-3">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left font-semibold text-foreground hover:text-primary hover:underline"
                          title={idea.title}
                          onClick={() => navigate(`/idea-backlog/${idea.id}`)}
                        >
                          {idea.title}
                        </button>
                        {idea.category ? <span className="text-xs text-muted-foreground">{idea.category}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', statusChipClass(idea.status_code))}>
                          {toDisplayStatus(idea.status_code)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {docsByIdea == null ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading document status" />
                        ) : (
                          <div className="flex gap-1.5">
                            {DOC_KINDS.map((kind) => {
                              const readiness = readinessFor(docs, kind)
                              return (
                                <span
                                  key={kind}
                                  className={cn('rounded-md border px-2 py-0.5 text-[11px] font-semibold', READINESS_CLASS[readiness])}
                                  title={`${kind}: ${READINESS_LABEL[readiness]}`}
                                >
                                  {kind}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">{ownerName}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => navigate(`/idea-backlog/${idea.id}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            Open
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 hover:border-rose-200 hover:text-rose-700"
                            disabled={unlinkingId !== null}
                            aria-label={`Unlink ${idea.title} from ${project.name}`}
                            onClick={() => void handleUnlink(idea)}
                          >
                            {unlinkingId === idea.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Unlink className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Unlink
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="flex shrink-0 items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          An idea belongs to one project at a time. Linking an idea that lives in another project moves it here, and its documents follow it into this project's Docs.
        </p>
      </div>

      <LinkProjectIdeaModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        projectId={project.id}
        projectName={project.name}
        currentLinkedIdeas={linkedIdeas}
        onLinked={(idea) => onIdeasChanged({ linked: idea })}
        onUnlinked={() => onIdeasChanged()}
      />
      <NewIdeaDialog
        open={newIdeaOpen}
        onOpenChange={setNewIdeaOpen}
        project={project}
        onCreated={(idea) => onIdeasChanged({ linked: idea })}
      />
    </div>
  )
}
