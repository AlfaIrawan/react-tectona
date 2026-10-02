import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, History, Loader2, Pencil, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  listIdeaTitleVersions,
  patchIdea,
  type IdeaApi,
  type IdeaTitleVersionApi,
} from '@/lib/api/ideaBacklogApi'
import { cn } from '@/lib/utils'

const TITLE_MIN = 3
const TITLE_MAX = 255

function sourceLabel(version: IdeaTitleVersionApi): string {
  if (version.source_code === 'initial') return 'Judul awal'
  if (version.source_code === 'document') return `Diubah dari ${version.source_label || 'dokumen'}`
  return 'Diubah dari Idea'
}

function formatWhen(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * The idea title, editable in place. It is the one title of the idea and of its URD/BRD/FSD
 * documents: saving it syncs those documents (Idea Backlog → document service) and adds a
 * title version, listed under the history button.
 */
export function IdeaTitleEditor({
  ideaId,
  title,
  version,
  nameOf,
  onRenamed,
  onError,
}: {
  ideaId: string
  title: string
  version: number
  nameOf: (subjectId: string) => string
  onRenamed: (api: IdeaApi) => void
  onError: (message: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<IdeaTitleVersionApi[] | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editing) setDraft(title)
  }, [editing, title])

  // A rename elsewhere (a URD/BRD/FSD, the assistant) changes the title: reload the history.
  useEffect(() => {
    setVersions(null)
  }, [title])

  useEffect(() => {
    if (!historyOpen || versions !== null) return
    let cancelled = false
    listIdeaTitleVersions(ideaId)
      .then((items) => { if (!cancelled) setVersions(items) })
      .catch(() => { if (!cancelled) setVersions([]) })
    return () => { cancelled = true }
  }, [historyOpen, ideaId, versions])

  useEffect(() => {
    if (!historyOpen) return
    const close = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) setHistoryOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [historyOpen])

  const trimmed = draft.trim()
  const invalid = trimmed.length < TITLE_MIN || trimmed.length > TITLE_MAX

  const save = useCallback(async () => {
    if (invalid || saving) return
    if (trimmed === title) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const api = await patchIdea(ideaId, { title: trimmed, version, title_source: 'idea' })
      setEditing(false)
      setVersions(null)
      onRenamed(api)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Judul gagal disimpan')
    } finally {
      setSaving(false)
    }
  }, [ideaId, invalid, onError, onRenamed, saving, title, trimmed, version])

  const latestVersionNo = versions?.[0]?.version_no

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={draft}
          maxLength={TITLE_MAX}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void save()
            if (event.key === 'Escape') setEditing(false)
          }}
          aria-label="Idea title"
          className="h-10 text-lg font-semibold"
          disabled={saving}
        />
        <Button size="sm" onClick={() => void save()} disabled={invalid || saving} aria-label="Save title">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-1.5">
      <h1 className="text-2xl font-semibold text-slate-900 leading-tight">{title}</h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100"
        aria-label="Rename idea"
        title="Ubah judul — URD, BRD dan FSD ikut berubah"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <div className="relative mt-1" ref={historyRef}>
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Title history"
          aria-expanded={historyOpen}
        >
          <History className="h-3.5 w-3.5" />
          {latestVersionNo ? `v${latestVersionNo}` : null}
        </button>
        {historyOpen ? (
          <div className="absolute left-0 top-full z-40 mt-1 w-[360px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <p className="px-1 pb-1 text-[11px] font-semibold text-slate-700">
              Riwayat judul
              <span className="block text-[10px] font-normal text-slate-400">Satu judul untuk Idea, URD, BRD dan FSD</span>
            </p>
            {versions === null ? (
              <div className="flex items-center gap-2 px-1 py-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat…
              </div>
            ) : (
              <ol className="max-h-72 space-y-1 overflow-y-auto">
                {versions.map((item, index) => (
                  <li
                    key={`${item.version_no}-${item.id ?? 'current'}`}
                    className={cn('rounded-md px-2 py-1.5', index === 0 ? 'bg-slate-50' : '')}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-slate-900">{item.title}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-slate-500">v{item.version_no}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {sourceLabel(item)}
                      {item.created_by ? ` · ${nameOf(item.created_by)}` : ''}
                      {item.created_at ? ` · ${formatWhen(item.created_at)}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
