import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import {
  listIdeas,
  patchIdea,
  toDisplayStatus,
  type BackendIdeaStatus,
  type IdeaApi,
} from '@/lib/api/ideaBacklogApi'

const LINKABLE_STATUSES = new Set<BackendIdeaStatus>([
  'submitted',
  'gate1_approved',
  'gate2_approved',
  'on_hold',
  'converted',
])

function isEligibleIdea(idea: IdeaApi, projectId: string, currentLinkedIdeaId?: string | null) {
  if (idea.id === currentLinkedIdeaId) return false
  if (idea.project_id && idea.project_id !== projectId) return false
  return LINKABLE_STATUSES.has(idea.status_code)
}

export function LinkProjectIdeaModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  currentLinkedIdea,
  onLinked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  currentLinkedIdea: IdeaApi | null
  onLinked: (idea: IdeaApi) => void
}) {
  const { addToast } = useToast()
  const [ideas, setIdeas] = useState<IdeaApi[]>([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const busy = submittingId !== null

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return
      event.preventDefault()
      event.stopPropagation()
      onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, busy, onOpenChange])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setLoadError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    void listIdeas({ page_size: 200 })
      .then((response) => {
        if (cancelled) return
        setIdeas(response.items)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setIdeas([])
        setLoadError(error instanceof Error ? error.message : 'Failed to load ideas.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const eligibleIdeas = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return ideas
      .filter((idea) => isEligibleIdea(idea, projectId, currentLinkedIdea?.id))
      .filter((idea) => {
        if (!query) return true
        return (
          idea.title.toLowerCase().includes(query) ||
          (idea.description ?? '').toLowerCase().includes(query) ||
          idea.tags.some((tag) => tag.toLowerCase().includes(query))
        )
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [currentLinkedIdea?.id, ideas, projectId, searchQuery])

  const handleLink = async (idea: IdeaApi) => {
    setSubmittingId(idea.id)
    try {
      if (currentLinkedIdea && currentLinkedIdea.id !== idea.id) {
        await patchIdea(currentLinkedIdea.id, {
          project_id: null,
          version: currentLinkedIdea.version,
        })
      }

      const linked = await patchIdea(idea.id, {
        project_id: projectId,
        status_code: idea.status_code === 'converted' ? undefined : 'converted',
        version: idea.version,
      })

      onLinked(linked)
      onOpenChange(false)
      addToast({
        title: 'Idea linked',
        description: `"${linked.title}" is now linked to ${projectName}.`,
        variant: 'success',
      })
    } catch (error: unknown) {
      addToast({
        title: 'Link failed',
        description: error instanceof Error ? error.message : 'Could not link idea to project.',
        variant: 'error',
      })
    } finally {
      setSubmittingId(null)
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close link idea dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onOpenChange(false)
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-project-idea-dialog-title"
        className="relative z-[1401] flex max-h-[min(720px,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/25">
              <Lightbulb className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id="link-project-idea-dialog-title" className="text-base font-semibold tracking-tight text-foreground">
                Link to idea
              </h3>
              <p className="text-sm text-muted-foreground">
                Select the backlog idea that is the source of demand for this project. Each project can be linked to only one idea.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Project</p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{projectName}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <div className="font-medium text-sm text-foreground">Select source idea</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {eligibleIdeas.length} eligible idea{eligibleIdeas.length === 1 ? '' : 's'} available to link.
            </p>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search ideas…"
                className="h-9 border-border/70 bg-background pl-9 text-sm"
                autoFocus
                disabled={busy}
              />
            </div>

            <div className="mt-3 max-h-[280px] overflow-y-auto rounded-lg border border-border/60 bg-muted/10">
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading ideas…
                </div>
              ) : loadError ? (
                <div className="px-4 py-8 text-sm text-rose-600">{loadError}</div>
              ) : eligibleIdeas.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">
                  No eligible ideas found. Ideas must be approved or submitted and not linked to another project.
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {eligibleIdeas.map((idea) => {
                    const itemBusy = submittingId === idea.id
                    return (
                      <li key={idea.id}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-start gap-3 px-3 py-3 text-left transition',
                            'hover:bg-background/80 focus-visible:bg-background/80 focus-visible:outline-none',
                            itemBusy && 'bg-background/70',
                          )}
                          disabled={busy}
                          onClick={() => void handleLink(idea)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{idea.title}</div>
                            {idea.description ? (
                              <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{idea.description}</div>
                            ) : null}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                {toDisplayStatus(idea.status_code)}
                              </span>
                              {idea.category ? (
                                <span className="text-[10px] text-muted-foreground">{idea.category}</span>
                              ) : null}
                            </div>
                          </div>
                          {itemBusy ? (
                            <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Enterprise note: demand traceability is stored on the idea record via logical project reference; project delivery data is not duplicated into idea backlog.
          </p>
        </div>

        <div className="flex items-center justify-end border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'min-w-[120px] justify-center gap-2')}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
