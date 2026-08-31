import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChatSidebarPanel } from '@/modules/core-shell/components/ChatSidebarPanel'
import { useTectonaPageContextReporter } from '@/lib/chat/useTectonaPageContextReporter'
import {
  fetchLatestAttachmentId,
  fetchLatestTemplateAttachmentId,
  fetchOnlyOfficeEditorConfig,
  fetchTemplateOnlyOfficeEditorConfig,
} from '@/lib/api/documentKnowledgeApi'

export type DocEditorInstance = {
  destroyEditor?: () => void
  // Hands over the "second" document for Review > Compare Documents — but only meaningfully
  // callable in response to the onRequestSelectDocument event; OnlyOffice has no config field
  // that pre-loads compare mode on open (there's no automatable, zero-click path).
  setRequestedDocument?: (payload: { c: string; fileType: string; url: string; token: string }) => void
}
export type DocsApi = { DocEditor: new (placeholderId: string, config: Record<string, unknown>) => DocEditorInstance }

declare global {
  interface Window {
    DocsAPI?: DocsApi
  }
}

import { resolveWorkingDocumentServerUrl } from '@/lib/onlyofficeDocumentServerUrl'

const PLACEHOLDER_ID = 'document-editor-surface'
const SAVE_POLL_TIMEOUT_MS = 30_000
const SAVE_POLL_INTERVAL_MS = 1_500

type OnlyOfficeErrorPayload = {
  errorCode?: unknown
  errorDescription?: unknown
}

function extractOnlyOfficeError(code: unknown): { code: number | null; description: string | null } {
  if (code && typeof code === 'object') {
    const payload = code as OnlyOfficeErrorPayload
    const rawCode = payload.errorCode
    const parsedCode =
      typeof rawCode === 'number'
        ? rawCode
        : typeof rawCode === 'string' && rawCode.trim() !== ''
          ? Number(rawCode)
          : Number.NaN
    const description =
      typeof payload.errorDescription === 'string' && payload.errorDescription.trim()
        ? payload.errorDescription.trim()
        : null
    return {
      code: Number.isFinite(parsedCode) ? parsedCode : null,
      description,
    }
  }
  if (typeof code === 'number') return { code, description: null }
  if (typeof code === 'string' && code.trim() !== '') {
    const parsed = Number(code)
    return Number.isFinite(parsed) ? { code: parsed, description: null } : { code: null, description: code.trim() }
  }
  return { code: null, description: null }
}

export function describeOnlyOfficeError(code: unknown): string {
  const { code: num, description } = extractOnlyOfficeError(code)
  if (description) {
    const lower = description.toLowerCase()
    if (lower.includes('minio') || lower.includes('object storage')) {
      return `${description} Pastikan container minio berjalan (docker start minio).`
    }
  }
  switch (num) {
    case -2:
      return (
        'OnlyOffice timeout saat memproses dokumen. Coba tutup editor, tunggu beberapa detik, lalu buka lagi.'
      )
    case -3:
      return 'File .docx tidak bisa dibuka OnlyOffice (rusak atau format tidak didukung). Jika baru saja menerapkan edit dari Assistant, coba buat ulang dari template atau attachment sebelumnya.'
    case -4:
      return 'OnlyOffice tidak bisa mengunduh file dari Document Knowledge Management. Biasanya masalah jaringan antar container (Document Server → DKM) atau layanan DKM/MinIO belum siap.'
    case -5:
      return 'Dokumen dilindungi password — OnlyOffice tidak bisa membukanya.'
    case -6:
      return 'OnlyOffice Document Server mengalami error database internal.'
    case -7:
      return 'Konfigurasi editor tidak valid (input error).'
    case -8:
      return 'Token JWT OnlyOffice tidak valid. Pastikan TECTONA_ONLYOFFICE_JWT_SECRET sama di container Document Server dan document-knowledge-management.'
    case -1:
    default:
      if (description) return description
      return 'OnlyOffice melaporkan error saat membuka dokumen. Periksa log container onlyoffice-documentserver dan document-knowledge-management.'
  }
}

const scriptPromises = new Map<string, Promise<void>>()
export function loadDocumentServerApi(documentServerUrl: string): Promise<void> {
  const cached = scriptPromises.get(documentServerUrl)
  if (cached) return cached

  const promise = resolveWorkingDocumentServerUrl(documentServerUrl)
    .then((base) => {
      if (!(window as Window & { DocsAPI?: unknown }).DocsAPI) {
        throw new Error(`Document editor failed to initialize (${base}).`)
      }
    })
    .catch((error) => {
      scriptPromises.delete(documentServerUrl)
      throw error
    })
  scriptPromises.set(documentServerUrl, promise)
  return promise
}

const delay = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms) })

type DocumentOnlyOfficeEditorProps = {
  open: boolean
  documentId?: string | null
  templateId?: string | null
  documentTitle: string | null
  onClose: () => void
  onEdited?: () => void
}

export function DocumentOnlyOfficeEditor({
  open,
  documentId = null,
  templateId = null,
  documentTitle,
  onClose,
  onEdited,
}: DocumentOnlyOfficeEditorProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  // Bumped when the Tectona Assistant chat applies an edit directly into this document (see
  // `tectonaAgentActions.ts`'s `document.apply_chat_edit` executor) — added to the init effect's
  // dependency array below to force a full destroy+reinit of the editor with the freshly-mutated
  // attachment, since there's no live in-place reload mechanism for an already-open DocsAPI
  // instance (a new attachment id always means OnlyOffice's `document.key` is fresh, so this is
  // guaranteed to never serve stale cached content).
  const [reloadNonce, setReloadNonce] = useState(0)
  const editorRef = useRef<DocEditorInstance | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const baselineAttachmentIdRef = useRef<string | null>(null)
  const editedRef = useRef(false)

  const resourceKey = templateId ? `template:${templateId}` : documentId ? `document:${documentId}` : null
  const isTemplate = Boolean(templateId)

  // The editor opens as a full-screen overlay on top of whatever page was already active — it
  // never changes the URL. Without reporting its own page context, the chat assistant still
  // sees whatever the underlying page (e.g. Idea Detail, some tab) last published, so an opening
  // greeting would talk about "the Docs tab" instead of "the document you're editing right now."
  const editorPageContext = useMemo(() => {
    if (!open || !resourceKey) return null
    return {
      module_label: 'Document & Knowledge Management',
      page_title: isTemplate ? 'Edit Master Template' : 'Edit Document',
      view_label: isTemplate ? 'Edit Master Template' : 'Edit Document',
      entity_type: isTemplate ? 'template' : 'document',
      entity_id: templateId ?? documentId ?? null,
      entity_title: documentTitle,
    }
  }, [open, resourceKey, isTemplate, templateId, documentId, documentTitle])
  useTectonaPageContextReporter(`document-editor:${resourceKey ?? 'none'}`, editorPageContext)

  useEffect(() => {
    if (!open || isTemplate || !documentId) return
    const handleDocumentEdited = (event: Event) => {
      const detail = (event as CustomEvent<{ documentId?: string }>).detail
      if (detail?.documentId === documentId) setReloadNonce((n) => n + 1)
    }
    window.addEventListener('tectona:document-edited', handleDocumentEdited)
    return () => window.removeEventListener('tectona:document-edited', handleDocumentEdited)
  }, [open, isTemplate, documentId])

  useEffect(() => {
    if (!open || !resourceKey) return
    if (isTemplate && !templateId) return
    if (!isTemplate && !documentId) return

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
          isTemplate
            ? fetchTemplateOnlyOfficeEditorConfig(templateId!)
            : fetchOnlyOfficeEditorConfig(documentId!),
          isTemplate
            ? fetchLatestTemplateAttachmentId(templateId!).catch(() => null)
            : fetchLatestAttachmentId(documentId!).catch(() => null),
        ])
        if (cancelled) return
        baselineAttachmentIdRef.current = baselineId

        await loadDocumentServerApi(documentServerUrl)
        if (cancelled || !hostRef.current) return
        if (!window.DocsAPI) throw new Error('Document editor failed to initialize.')

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
            onError: (event: { data?: unknown }) => {
              if (cancelled) return
              const payload = event?.data
              const parsed = extractOnlyOfficeError(payload)
              console.error('[OnlyOffice] onError', {
                errorCode: parsed.code,
                errorDescription: parsed.description,
                documentId,
                templateId,
              })
              setError(describeOnlyOfficeError(payload))
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
      hostRef.current?.replaceChildren()
    }
  }, [open, resourceKey, isTemplate, templateId, documentId, reloadNonce])

  const resolveLatestAttachmentId = async (): Promise<string | null> => {
    if (isTemplate && templateId) return fetchLatestTemplateAttachmentId(templateId).catch(() => null)
    if (documentId) return fetchLatestAttachmentId(documentId).catch(() => null)
    return null
  }

  const handleClose = async () => {
    if (!resourceKey) {
      onClose()
      return
    }

    const baseline = baselineAttachmentIdRef.current
    let detected = false

    let shouldWait = editedRef.current
    if (!shouldWait) {
      const latest = await resolveLatestAttachmentId()
      if (latest && latest !== baseline) {
        shouldWait = true
        detected = true
      }
    }

    if (!shouldWait) {
      onClose()
      return
    }

    try {
      editorRef.current?.destroyEditor?.()
    } catch {
      // already torn down
    }
    editorRef.current = null

    setSaving(true)
    const deadline = Date.now() + SAVE_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      const latest = await resolveLatestAttachmentId()
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
          <h2 className="truncate text-lg font-semibold text-foreground">
            {isTemplate ? 'Edit Master Template' : 'Edit Document'}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{documentTitle ?? (isTemplate ? 'Template' : 'Document')}</p>
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
          <div ref={hostRef} className="absolute inset-0" />
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

        <div
          className={cn(
            'h-full shrink-0 overflow-hidden border-l border-border bg-background transition-[width] duration-200',
            chatOpen ? 'w-[min(380px,90vw)]' : 'w-0 border-l-0',
          )}
        >
          {chatOpen ? (
            <ChatSidebarPanel
              documentContext={documentId ? { documentId, documentTitle } : null}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
