import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChatSidebarPanel } from '@/modules/core-shell/components/ChatSidebarPanel'
import { fetchLatestAttachmentId, fetchOnlyOfficeEditorConfig } from '@/lib/api/documentKnowledgeApi'

type DocEditorInstance = { destroyEditor?: () => void }
type DocsApi = { DocEditor: new (placeholderId: string, config: Record<string, unknown>) => DocEditorInstance }

declare global {
  interface Window {
    DocsAPI?: DocsApi
  }
}

const PLACEHOLDER_ID = 'onlyoffice-editor-surface'
// How long to wait for the Document Server to persist edits as a new version after closing.
const SAVE_POLL_TIMEOUT_MS = 30_000
const SAVE_POLL_INTERVAL_MS = 1_500

// Load the Document Server's api.js once per URL; subsequent opens reuse the resolved promise.
const scriptPromises = new Map<string, Promise<void>>()
function loadDocumentServerApi(documentServerUrl: string): Promise<void> {
  const src = `${documentServerUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`
  const cached = scriptPromises.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromises.delete(src)
      reject(new Error('Could not reach the document editor service.'))
    }
    document.head.appendChild(script)
  })
  scriptPromises.set(src, promise)
  return promise
}

const delay = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms) })

type DocumentOnlyOfficeEditorProps = {
  open: boolean
  documentId: string | null
  documentTitle: string | null
  onClose: () => void
  /** Called once edits have been persisted as a new version, so callers can refresh their preview. */
  onEdited?: () => void
}

export function DocumentOnlyOfficeEditor({
  open,
  documentId,
  documentTitle,
  onClose,
  onEdited,
}: DocumentOnlyOfficeEditorProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const editorRef = useRef<DocEditorInstance | null>(null)
  // React-managed wrapper. OnlyOffice mutates a *plain* child div we create inside it (not this node
  // and not anything React reconciles), so React's commit phase never trips over OnlyOffice's DOM.
  const hostRef = useRef<HTMLDivElement | null>(null)
  // Latest attachment id captured at open; edits produce a newer one we can poll for.
  const baselineAttachmentIdRef = useRef<string | null>(null)
  const editedRef = useRef(false)

  useEffect(() => {
    if (!open || !documentId) return

    let cancelled = false
    setLoading(true)
    setSaving(false)
    setError(null)
    setChatOpen(false)
    editedRef.current = false
    baselineAttachmentIdRef.current = null

    void (async () => {
      try {
        const [{ documentServerUrl, config }, baselineId] = await Promise.all([
          fetchOnlyOfficeEditorConfig(documentId),
          fetchLatestAttachmentId(documentId).catch(() => null),
        ])
        if (cancelled) return
        baselineAttachmentIdRef.current = baselineId

        await loadDocumentServerApi(documentServerUrl)
        if (cancelled || !hostRef.current) return
        if (!window.DocsAPI) throw new Error('Document editor failed to initialize.')

        // Hand OnlyOffice a fresh plain DOM node it fully owns; React only ever sees the empty host.
        editorRef.current?.destroyEditor?.()
        hostRef.current.replaceChildren()
        const surface = document.createElement('div')
        surface.id = PLACEHOLDER_ID
        surface.style.height = '100%'
        surface.style.width = '100%'
        hostRef.current.appendChild(surface)

        editorRef.current = new window.DocsAPI.DocEditor(PLACEHOLDER_ID, {
          ...config,
          width: '100%',
          height: '100%',
          events: {
            onDocumentStateChange: (event: { data?: boolean }) => {
              if (event?.data) editedRef.current = true
            },
            onError: () => {
              if (!cancelled) setError('The editor reported an error while opening this document.')
            },
          },
        })
      } catch (openError) {
        if (!cancelled) setError(openError instanceof Error ? openError.message : 'Unable to open the editor.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      try {
        editorRef.current?.destroyEditor?.()
      } catch {
        // editor already torn down
      }
      editorRef.current = null
      // Drop OnlyOffice's leftover DOM before React unmounts the host, so React only removes its own node.
      hostRef.current?.replaceChildren()
    }
  }, [open, documentId])

  const handleClose = async () => {
    if (!documentId) {
      onClose()
      return
    }

    const baseline = baselineAttachmentIdRef.current
    let detected = false

    // Decide whether to wait for a save: the edit event fired, OR a new version already landed
    // (autosave) even if the event was missed.
    let shouldWait = editedRef.current
    if (!shouldWait) {
      const latest = await fetchLatestAttachmentId(documentId).catch(() => null)
      if (latest && latest !== baseline) {
        shouldWait = true
        detected = true
      }
    }

    if (!shouldWait) {
      onClose()
      return
    }

    // Disconnect the editor so the Document Server flushes the final save, then wait for the new
    // version to land before telling the caller to refresh its preview.
    try {
      editorRef.current?.destroyEditor?.()
    } catch {
      // already torn down
    }
    editorRef.current = null

    setSaving(true)
    const deadline = Date.now() + SAVE_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      const latest = await fetchLatestAttachmentId(documentId).catch(() => null)
      if (latest && latest !== baseline) {
        detected = true
        break
      }
      await delay(SAVE_POLL_INTERVAL_MS)
    }
    setSaving(false)
    if (detected) onEdited?.()
    onClose()
  }

  if (typeof document === 'undefined' || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div className="min-w-0 pr-3">
          <h2 className="truncate text-lg font-semibold text-foreground">Edit Document</h2>
          <p className="truncate text-sm text-muted-foreground">{documentTitle ?? 'Document'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setChatOpen((value) => !value)}
            aria-pressed={chatOpen}
            title={chatOpen ? 'Hide chat' : 'Open chat'}
            className={cn(
              'group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2 text-sm font-semibold tracking-tight transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              chatOpen
                ? 'border border-transparent bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_10px_26px_-8px_rgba(37,99,235,0.6)] ring-1 ring-white/15'
                : 'border border-slate-200/80 bg-white/80 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm hover:-translate-y-0.5 hover:border-blue-200/80 hover:text-blue-700 hover:shadow-[0_10px_24px_-10px_rgba(37,99,235,0.35)]',
            )}
          >
            {/* soft top sheen on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            />
            <span
              aria-hidden
              className={cn(
                'relative flex h-5 w-5 items-center justify-center rounded-md transition-colors',
                chatOpen ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            <span className="relative">Chat</span>
            {chatOpen ? (
              <span
                aria-hidden
                className="relative ml-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
              />
            ) : null}
          </button>
          <Button variant="ghost" size="icon" onClick={() => void handleClose()} disabled={saving} aria-label="Close editor">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
      <div className="relative min-h-0 flex-1">
        {/* Stable host rendered first; OnlyOffice injects into a plain child of this node. */}
        <div ref={hostRef} className="absolute inset-0" />

        {/* Overlay layer always rendered last, so React appends/removes it without an insertBefore
            against the OnlyOffice-mutated host. */}
        {error ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
            <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          </div>
        ) : loading || saving ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-background/90 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {saving ? 'Saving changes...' : 'Opening editor...'}
          </div>
        ) : null}
      </div>

      {/* Chat panel on the right (same component as the global chat sidebar). */}
      <div
        className={cn(
          'h-full shrink-0 overflow-hidden border-l border-border bg-background transition-[width] duration-200',
          chatOpen ? 'w-[min(380px,90vw)]' : 'w-0 border-l-0',
        )}
      >
        {chatOpen ? <ChatSidebarPanel /> : null}
      </div>
      </div>
    </div>,
    document.body,
  )
}
