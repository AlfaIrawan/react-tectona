/**
 * Document explainer assistants — create and govern knowledge-only assistant packs.
 *
 * A pack is a display name plus a corpus (folders and/or documents already governed
 * by this module). It grants no tools: chat execution lives in tectona-agent-runtime,
 * which reads this same catalog. Publishing is what makes a pack selectable in chat,
 * so the button is deliberately gated on the corpus resolving to at least one document.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Check, Loader2, Plus, RefreshCw, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  archiveExplainerAssistant,
  createExplainerAssistant,
  listAllDocuments,
  listExplainerAssistants,
  patchExplainerAssistant,
  publishExplainerAssistant,
  type DocumentResponse,
  type ExplainerAssistant,
} from '@/lib/api/documentKnowledgeApi'
import { fetchAllDocumentFolders, type DocumentFolder } from '@/lib/api/documentFolderApi'

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
  folderIds: string[]
  documentIds: string[]
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  version: null,
  displayName: '',
  description: '',
  folderIds: [],
  documentIds: [],
}

function statusTone(status: ExplainerAssistant['status']): string {
  if (status === 'published') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  if (status === 'archived') return 'border-border/60 bg-muted/40 text-muted-foreground'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
}

export function ExplainerAssistantsPanel({ workspaceId, className, style }: ExplainerAssistantsPanelProps) {
  const [assistants, setAssistants] = useState<ExplainerAssistant[]>([])
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [documents, setDocuments] = useState<DocumentResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [corpusQuery, setCorpusQuery] = useState('')

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
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar asisten.')
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
          listAllDocuments({ workspace_id: workspaceId, page_size: 200 }),
        ])
        if (cancelled) return
        setFolders(folderList)
        setDocuments(documentList.items)
      } catch (err) {
        if (!cancelled) setSaveError(err instanceof Error ? err.message : 'Gagal memuat folder/dokumen.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [drawerOpen, workspaceId])

  const openCreate = () => {
    setDraft(EMPTY_DRAFT)
    setSaveError(null)
    setCorpusQuery('')
    setDrawerOpen(true)
  }

  const openEdit = (assistant: ExplainerAssistant) => {
    setDraft({
      id: assistant.id,
      version: assistant.version,
      displayName: assistant.display_name,
      description: assistant.description ?? '',
      folderIds: assistant.corpus.folder_ids ?? [],
      documentIds: assistant.corpus.document_ids ?? [],
    })
    setSaveError(null)
    setCorpusQuery('')
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

  const canSave =
    !!workspaceId &&
    draft.displayName.trim().length > 0 &&
    (draft.folderIds.length > 0 || draft.documentIds.length > 0)

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
          corpus,
          version: draft.version ?? undefined,
        })
      } else {
        await createExplainerAssistant({
          display_name: draft.displayName.trim(),
          workspace_id: workspaceId,
          description: draft.description.trim() || null,
          corpus,
        })
      }
      setDrawerOpen(false)
      await reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan asisten.')
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
      setError(err instanceof Error ? err.message : 'Aksi gagal dijalankan.')
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
              Asisten yang hanya menjelaskan isi dokumen terikat (mis. MI / Ketetapan Sementara). Tidak punya tool
              aplikasi kredit atau SSD — jawaban selalu berbasis kutipan dari korpusnya.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={openCreate} disabled={!workspaceId}>
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Buat asisten
            </Button>
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
              Pilih workspace terlebih dahulu untuk mengelola asisten.
            </p>
          ) : assistants.length === 0 && !loading ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              Belum ada asisten. Buat satu dan ikat ke folder MI atau Ketetapan Sementara.
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
                        {assistant.description || 'Tanpa deskripsi.'}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px] uppercase', statusTone(assistant.status))}>
                      {assistant.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-md border border-border/50 px-1.5 py-0.5">
                      {assistant.corpus.folder_ids.length} folder
                    </span>
                    <span className="rounded-md border border-border/50 px-1.5 py-0.5">
                      {assistant.corpus.document_ids.length} dokumen langsung
                    </span>
                    <span className="rounded-md border border-border/50 px-1.5 py-0.5">
                      {assistant.resolved_document_count} dokumen aktif
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
                            ? 'Korpus kosong — asisten tanpa dokumen tidak bisa menjawab apa pun.'
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

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="w-[min(920px,95vw)] max-w-none">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit explainer assistant' : 'Buat explainer assistant'}</DialogTitle>
            <DialogDescription>
              Nama tampilan dipakai di pemilih asisten pada chat Tectona dan Advena. Korpus menentukan satu-satunya
              sumber jawaban.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-1">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="explainer-name">Nama tampilan</Label>
                <Input
                  id="explainer-name"
                  value={draft.displayName}
                  maxLength={120}
                  placeholder="mis. John — Penjelas MI Kredit"
                  onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="explainer-description">Deskripsi</Label>
                <Textarea
                  id="explainer-description"
                  value={draft.description}
                  maxLength={500}
                  rows={2}
                  placeholder="Cakupan singkat: dokumen apa yang bisa dijelaskan."
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Korpus</Label>
                <span className="text-[11px] text-muted-foreground">
                  {draft.folderIds.length} folder · {draft.documentIds.length} dokumen
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={corpusQuery}
                  onChange={(event) => setCorpusQuery(event.target.value)}
                  placeholder="Cari folder atau dokumen…"
                  className="pl-8"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/50">
                  <p className="border-b border-border/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Folder
                  </p>
                  <div className="max-h-56 overflow-y-auto p-1.5">
                    {filteredFolders.length === 0 ? (
                      <p className="p-3 text-center text-[11px] text-muted-foreground">Tidak ada folder.</p>
                    ) : (
                      filteredFolders.map((folder) => {
                        const selected = draft.folderIds.includes(folder.id)
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => toggle('folderIds', folder.id)}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                              selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60',
                            )}
                          >
                            <span className="truncate">{folder.name}</span>
                            <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                              {folder.document_count} dok
                              {selected ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border/50">
                  <p className="border-b border-border/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Dokumen
                  </p>
                  <div className="max-h-56 overflow-y-auto p-1.5">
                    {filteredDocuments.length === 0 ? (
                      <p className="p-3 text-center text-[11px] text-muted-foreground">Tidak ada dokumen.</p>
                    ) : (
                      filteredDocuments.map((doc) => {
                        const selected = draft.documentIds.includes(doc.id)
                        return (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => toggle('documentIds', doc.id)}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                              selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60',
                            )}
                          >
                            <span className="truncate">{doc.title}</span>
                            {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {saveError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {saveError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={!canSave || saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ExplainerAssistantsPanel
