/**
 * Document explainer assistants — create and govern knowledge-only assistant packs.
 *
 * A pack is a display name plus a corpus (folders and/or documents already governed
 * by this module). It grants no tools: chat execution lives in tectona-agent-runtime,
 * which reads this same catalog. Publishing is what makes a pack selectable in chat,
 * so the button is deliberately gated on the corpus resolving to at least one document.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bot, Check, ChevronDown, ChevronRight, FileText, Folder, Loader2, Maximize2, Minimize2, Plus, Save, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  enterpriseSecondaryButtonClass,
  registerServicePrimaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import {
  EXPLAINER_AVATARS,
  archiveExplainerAssistant,
  createExplainerAssistant,
  listAllDocuments,
  listExplainerAssistants,
  patchExplainerAssistant,
  publishExplainerAssistant,
  type DocumentResponse,
  type ExplainerAssistant,
  type ExplainerAssistantAvatar,
} from '@/lib/api/documentKnowledgeApi'
import { fetchAllDocumentFolders, type DocumentFolder } from '@/lib/api/documentFolderApi'

/**
 * The "New assistant" trigger lives in the module toolbar (next to the search bar),
 * alongside the other panels' primary actions, so the panel exposes its create
 * drawer instead of rendering a second button of its own.
 */
export interface ExplainerAssistantsPanelHandle {
  openCreate: () => void
}

interface ExplainerAssistantsPanelProps {
  workspaceId: string | null
  className?: string
  style?: React.CSSProperties
}

interface DraftState {
  id: string | null
  version: number | null
  displayName: string
  description: string
  avatar: ExplainerAssistantAvatar
  folderIds: string[]
  documentIds: string[]
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  version: null,
  displayName: '',
  description: '',
  avatar: 'violet',
  folderIds: [],
  documentIds: [],
}

/**
 * The documents endpoint caps page_size at 100, so a corpus picker that wants more
 * than one page has to actually page — asking for 200 is rejected with a 422.
 */
const DOCUMENT_PAGE_SIZE = 100
const DOCUMENT_PAGE_LIMIT = 10

async function fetchDocumentsForCorpus(workspaceId: string): Promise<DocumentResponse[]> {
  const collected: DocumentResponse[] = []
  for (let page = 1; page <= DOCUMENT_PAGE_LIMIT; page += 1) {
    const res = await listAllDocuments({
      workspace_id: workspaceId,
      page,
      page_size: DOCUMENT_PAGE_SIZE,
    })
    collected.push(...res.items)
    if (res.items.length < DOCUMENT_PAGE_SIZE || collected.length >= res.total) break
  }
  return collected
}

/** Avatar chrome per palette token; the chat clients apply their own equivalent. */
const AVATAR_CHROME: Record<ExplainerAssistantAvatar, string> = {
  violet: 'bg-violet-600 text-white',
  sky: 'bg-sky-600 text-white',
  teal: 'bg-teal-600 text-white',
  emerald: 'bg-emerald-600 text-white',
  amber: 'bg-amber-600 text-white',
  rose: 'bg-rose-600 text-white',
  slate: 'bg-slate-600 text-white',
  indigo: 'bg-indigo-600 text-white',
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'AI'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

/** Explorer-style timestamp: 02/09/2026 19:59. */
function formatModified(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function statusTone(status: ExplainerAssistant['status']): string {
  if (status === 'published') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  if (status === 'archived') return 'border-border/60 bg-muted/40 text-muted-foreground'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
}

export const ExplainerAssistantsPanel = forwardRef<
  ExplainerAssistantsPanelHandle,
  ExplainerAssistantsPanelProps
>(function ExplainerAssistantsPanel({ workspaceId, className, style }, ref) {
  const [assistants, setAssistants] = useState<ExplainerAssistant[]>([])
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [documents, setDocuments] = useState<DocumentResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerFullscreen, setDrawerFullscreen] = useState(false)
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [corpusQuery, setCorpusQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
  }, [])

  const closeDrawer = useCallback(() => {
    if (saving) return
    setDrawerOpen(false)
    setDrawerFullscreen(false)
  }, [saving])

  const reload = useCallback(async () => {
    if (!workspaceId) {
      setAssistants([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await listExplainerAssistants({ workspaceId, pageSize: 200 })
      setAssistants(res.assistants)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the assistant list.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void reload()
  }, [reload])

  // Corpus pickers only need the catalog when the drawer is actually opened.
  useEffect(() => {
    if (!drawerOpen || !workspaceId) return
    let cancelled = false
    void (async () => {
      try {
        const [folderList, documentList] = await Promise.all([
          fetchAllDocumentFolders(workspaceId),
          fetchDocumentsForCorpus(workspaceId),
        ])
        if (cancelled) return
        setFolders(folderList)
        setDocuments(documentList)
      } catch (err) {
        if (!cancelled) setSaveError(err instanceof Error ? err.message : 'Could not load folders and documents.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [drawerOpen, workspaceId])

  useEffect(() => {
    if (!drawerOpen) return
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (drawerFullscreen) {
        event.preventDefault()
        setDrawerFullscreen(false)
        return
      }
      closeDrawer()
    }
    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [drawerOpen, drawerFullscreen, closeDrawer])

  const openCreate = useCallback(() => {
    setDraft(EMPTY_DRAFT)
    setSaveError(null)
    setCorpusQuery('')
    setDrawerFullscreen(false)
    setDrawerOpen(true)
  }, [])

  useImperativeHandle(ref, () => ({ openCreate }), [openCreate])

  const openEdit = (assistant: ExplainerAssistant) => {
    setDraft({
      id: assistant.id,
      version: assistant.version,
      displayName: assistant.display_name,
      description: assistant.description ?? '',
      avatar: assistant.avatar ?? 'violet',
      folderIds: assistant.corpus.folder_ids ?? [],
      documentIds: assistant.corpus.document_ids ?? [],
    })
    setSaveError(null)
    setCorpusQuery('')
    setDrawerFullscreen(false)
    setDrawerOpen(true)
  }

  const toggle = (key: 'folderIds' | 'documentIds', id: string) => {
    setDraft((prev) => {
      const current = prev[key]
      return {
        ...prev,
        [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      }
    })
  }

  const filteredFolders = useMemo(() => {
    const q = corpusQuery.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((folder) => folder.name.toLowerCase().includes(q))
  }, [folders, corpusQuery])

  const filteredDocuments = useMemo(() => {
    const q = corpusQuery.trim().toLowerCase()
    if (!q) return documents
    return documents.filter((doc) => doc.title.toLowerCase().includes(q))
  }, [documents, corpusQuery])

  const explorerGroups = useMemo(
    () =>
      [
        {
          key: 'folders',
          label: 'File folder',
          stateKey: 'folderIds' as const,
          rows: filteredFolders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            modified: formatModified(folder.updated_date ?? folder.created_date),
          })),
        },
        {
          key: 'documents',
          label: 'Documents',
          stateKey: 'documentIds' as const,
          rows: filteredDocuments.map((doc) => ({
            id: doc.id,
            name: doc.title,
            modified: formatModified(doc.updated_date ?? doc.created_date),
          })),
        },
      ],
    [filteredFolders, filteredDocuments],
  )

  const canSave = !!workspaceId && draft.displayName.trim().length > 0

  const handleSave = async () => {
    if (!workspaceId || !canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      const corpus = { folder_ids: draft.folderIds, document_ids: draft.documentIds }
      if (draft.id) {
        await patchExplainerAssistant(draft.id, {
          display_name: draft.displayName.trim(),
          description: draft.description.trim() || null,
          avatar: draft.avatar,
          corpus,
          version: draft.version ?? undefined,
        })
      } else {
        await createExplainerAssistant({
          display_name: draft.displayName.trim(),
          workspace_id: workspaceId,
          description: draft.description.trim() || null,
          avatar: draft.avatar,
          corpus,
        })
      }
      setDrawerOpen(false)
      setDrawerFullscreen(false)
      await reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the assistant.')
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (assistant: ExplainerAssistant, action: 'publish' | 'archive') => {
    setBusyId(assistant.id)
    setError(null)
    try {
      if (action === 'publish') await publishExplainerAssistant(assistant.id)
      else await archiveExplainerAssistant(assistant.id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The action could not be completed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className={cn(
        'liquid-glass-enterprise-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        className,
      )}
      style={style}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
        <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
              <h2 className="text-lg font-semibold text-foreground">Document Explainer Assistants</h2>
              <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Knowledge only
              </Badge>
            </div>
            <p className="mt-0.5 max-w-3xl text-[11px] text-muted-foreground">
              Assistants that only explain the documents bound to them. They carry no operational tooling — every
              answer is grounded in a citation from their own corpus, or the assistant says it does not know.
            </p>
          </div>
        </div>

        {error ? (
          <div className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!workspaceId ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              Select a workspace first to manage assistants.
            </p>
          ) : assistants.length === 0 && !loading ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              No assistants yet. Create one and bind it to the folders or documents it should explain.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {assistants.map((assistant) => (
                <div
                  key={assistant.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{assistant.display_name}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {assistant.description || 'No description.'}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px] uppercase', statusTone(assistant.status))}>
                      {assistant.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-md border border-border/50 px-1.5 py-0.5">
                      {assistant.corpus.folder_ids.length} folders
                    </span>
                    <span className="rounded-md border border-border/50 px-1.5 py-0.5">
                      {assistant.corpus.document_ids.length} documents
                    </span>
                    <span className="rounded-md border border-border/50 px-1.5 py-0.5">
                      {assistant.resolved_document_count} resolved
                    </span>
                  </div>

                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(assistant)}>
                      Edit
                    </Button>
                    {assistant.status !== 'published' ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === assistant.id || assistant.resolved_document_count === 0}
                        title={
                          assistant.resolved_document_count === 0
                            ? 'Empty corpus — an assistant with no documents cannot answer anything.'
                            : undefined
                        }
                        onClick={() => void runAction(assistant, 'publish')}
                      >
                        {busyId === assistant.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : null}
                        Publish
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === assistant.id}
                        onClick={() => void runAction(assistant, 'archive')}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {typeof document !== 'undefined'
        ? createPortal(
            <>
              <div
                className={cn(
                  'fixed inset-0 z-[1050] bg-black/20 backdrop-blur-sm transition-opacity',
                  drawerOpen && !drawerFullscreen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
                onClick={closeDrawer}
                aria-hidden="true"
              />

              <div
                className={cn(
                  'fixed top-0 right-0 z-[1100] flex h-screen transform flex-col transition-all duration-300',
                  'border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl',
                  drawerFullscreen ? 'w-screen max-w-none border-l-0' : 'w-[460px] max-w-[92vw]',
                  drawerOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0',
                )}
                style={{
                  boxShadow: drawerFullscreen
                    ? '0 0 80px rgba(0, 0, 0, 0.35)'
                    : '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
                  margin: 0,
                  padding: 0,
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="explainer-assistant-drawer-title"
              >
                <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4 backdrop-blur-sm">
                  <div className="pr-3">
                    <h2
                      id="explainer-assistant-drawer-title"
                      className="flex items-center gap-2 text-xl font-semibold text-foreground"
                    >
                      <Plus className="h-5 w-5 text-primary" aria-hidden />
                      {draft.id ? 'Edit explainer assistant' : 'Add explainer assistant'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {drawerFullscreen
                        ? 'Full window view — press Esc or use Exit full window to return to the side panel.'
                        : 'The display name appears in the assistant picker in both chat clients. The corpus is the only source this assistant can answer from.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDrawerFullscreen((open) => !open)}
                      disabled={saving}
                      aria-label={drawerFullscreen ? 'Exit explainer editor full window' : 'Open explainer editor full window'}
                      title={drawerFullscreen ? 'Exit full window' : 'Full window'}
                    >
                      {drawerFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={closeDrawer}
                      disabled={saving}
                      aria-label="Close explainer assistant"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSave()
                  }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-5 py-5 scrollbar-hide">
                    <div className="space-y-1.5">
                      <Label htmlFor="explainer-name" className="text-xs text-muted-foreground">
                        Display name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="explainer-name"
                        value={draft.displayName}
                        maxLength={120}
                        placeholder="Short and unique — e.g. Policy Explainer"
                        className="h-10 text-sm"
                        onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="explainer-description" className="text-xs text-muted-foreground">
                        Description
                      </Label>
                      <Textarea
                        id="explainer-description"
                        value={draft.description}
                        maxLength={500}
                        rows={4}
                        placeholder="Short scope: which documents this assistant can explain."
                        className="min-h-[88px] text-sm"
                        onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                      />
                      <p className="text-[10px] text-muted-foreground">{draft.description.length} / 500</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Avatar</Label>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                            AVATAR_CHROME[draft.avatar],
                          )}
                          aria-hidden
                        >
                          {initialsOf(draft.displayName)}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {EXPLAINER_AVATARS.map((token) => (
                            <button
                              key={token}
                              type="button"
                              onClick={() => setDraft((prev) => ({ ...prev, avatar: token }))}
                              aria-label={`Avatar colour ${token}`}
                              aria-pressed={draft.avatar === token}
                              title={token}
                              className={cn(
                                'h-6 w-6 rounded-full transition-transform',
                                AVATAR_CHROME[token],
                                draft.avatar === token
                                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                                  : 'hover:scale-110',
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Initials come from the display name. The same avatar is rendered in both chat clients.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">
                          Corpus <span className="text-red-500">*</span>
                        </Label>
                        <span className="text-[11px] text-muted-foreground">
                          {draft.folderIds.length} folders · {draft.documentIds.length} documents
                        </span>
                      </div>
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                          aria-hidden
                        />
                        <Input
                          value={corpusQuery}
                          onChange={(event) => setCorpusQuery(event.target.value)}
                          placeholder="Search folders or documents…"
                          className="h-10 pl-8 text-sm"
                        />
                      </div>

                      {/* File-explorer layout: one list, grouped by type, Name + Date modified. */}
                      <div className="overflow-hidden rounded-lg border border-border/60">
                        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                          <span className="min-w-0 flex-1">Name</span>
                          <span className="w-[124px] shrink-0">Date modified</span>
                        </div>
                        <div className={cn('overflow-y-auto', drawerFullscreen ? 'max-h-[52vh]' : 'max-h-[320px]')}>
                          {explorerGroups.every((group) => group.rows.length === 0) ? (
                            <p className="p-6 text-center text-[11px] text-muted-foreground">
                              Nothing to show in this workspace.
                            </p>
                          ) : (
                            explorerGroups.map((group) => (
                              <div key={group.key}>
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(group.key)}
                                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-muted/50"
                                >
                                  {collapsedGroups.includes(group.key) ? (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                  )}
                                  {group.label}
                                  <span className="font-normal text-muted-foreground">({group.rows.length})</span>
                                </button>

                                {collapsedGroups.includes(group.key)
                                  ? null
                                  : group.rows.map((row) => {
                                      const selected = draft[group.stateKey].includes(row.id)
                                      return (
                                        <button
                                          key={row.id}
                                          type="button"
                                          onClick={() => toggle(group.stateKey, row.id)}
                                          aria-pressed={selected}
                                          className={cn(
                                            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                                            selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/50',
                                          )}
                                        >
                                          {group.key === 'folders' ? (
                                            <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                                          ) : (
                                            <FileText className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />
                                          )}
                                          <span className="min-w-0 flex-1 truncate">{row.name}</span>
                                          <span className="w-[124px] shrink-0 tabular-nums text-[11px] text-muted-foreground">
                                            {row.modified}
                                          </span>
                                          <Check
                                            className={cn(
                                              'h-3.5 w-3.5 shrink-0 text-primary',
                                              selected ? 'opacity-100' : 'opacity-0',
                                            )}
                                            aria-hidden
                                          />
                                        </button>
                                      )
                                    })}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {saveError ? (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {saveError}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
                    <div className="flex w-full items-stretch gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 flex-1 basis-0 justify-center gap-2')}
                        onClick={closeDrawer}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="default"
                        className={cn(registerServicePrimaryButtonClass(), 'min-w-0 flex-1 basis-0 justify-center gap-2')}
                        disabled={!canSave || saving}
                      >
                        <Save className="h-4 w-4 shrink-0" aria-hidden />
                        {saving ? 'Saving...' : draft.id ? 'Update assistant' : 'Save assistant'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
})

export default ExplainerAssistantsPanel
