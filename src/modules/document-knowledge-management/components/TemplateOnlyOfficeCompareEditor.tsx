import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  describeOnlyOfficeError,
  loadDocumentServerApi,
  type DocEditorInstance,
  type DocsApi,
} from '@/modules/document-knowledge-management/components/DocumentOnlyOfficeEditor'
import {
  fetchDocumentCompareOnlyOfficeConfig,
  fetchTemplateCompareOnlyOfficeConfig,
  stageDocumentCompareUpload,
  stageTemplateCompareUpload,
} from '@/lib/api/documentKnowledgeApi'

declare global {
  interface Window {
    DocsAPI?: DocsApi
  }
}

const PLACEHOLDER_ID = 'onlyoffice-compare-editor-surface'

export type OnlyOfficeCompareSession = {
  kind: 'template' | 'document'
  entityId: string
  entityTitle: string
  pendingFile: File
}

type OnlyOfficeCompareEditorProps = {
  open: boolean
  session: OnlyOfficeCompareSession | null
  onClose: () => void
}

/** Opens the server template/document and the about-to-be-uploaded file together in OnlyOffice's
 * own Review > Compare Documents mode — real Word-compatible rendering and diffing, instead of
 * hand-rolling docx layout/pagination/diff-highlighting ourselves. The pending file only exists
 * as an in-browser File at this point, so it's first staged server-side (a TTL'd, ticket-gated
 * upload OnlyOffice's Document Server can fetch) before the compare config can be built. Neither
 * document has a save callback wired up (see build_compare_editor_config on the backend) — any
 * in-editor edits are local to this OnlyOffice session and are never persisted.
 *
 * OnlyOffice has no config field that pre-loads compare mode on open — there is no zero-click
 * path. The editor only hands over control of "which second document to compare" via the
 * onRequestSelectDocument event, fired when the user clicks Review > Compare Documents >
 * "Document from Storage" inside the editor itself. This component listens for that event and
 * responds with setRequestedDocument(...) so the user doesn't have to browse for the file
 * themselves — they still have to trigger Compare Documents from the Review tab once. */
export function TemplateOnlyOfficeCompareEditor({ open, session, onClose }: OnlyOfficeCompareEditorProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<DocEditorInstance | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const compareDocumentRef = useRef<{ c: string; fileType: string; url: string; token: string } | null>(null)

  useEffect(() => {
    if (!open || !session || !hostRef.current) return

    let cancelled = false
    setLoading(true)
    setError(null)
    compareDocumentRef.current = null

    void (async () => {
      try {
        const { staging_id: stagingId } =
          session.kind === 'template'
            ? await stageTemplateCompareUpload(session.pendingFile)
            : await stageDocumentCompareUpload(session.pendingFile)
        if (cancelled) return

        const { documentServerUrl, config, compareDocument } =
          session.kind === 'template'
            ? await fetchTemplateCompareOnlyOfficeConfig(session.entityId, stagingId)
            : await fetchDocumentCompareOnlyOfficeConfig(session.entityId, stagingId)
        if (cancelled) return
        compareDocumentRef.current = compareDocument

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
            onRequestSelectDocument: (event: { data?: { c?: string } }) => {
              const compareDoc = compareDocumentRef.current
              if (!compareDoc) return
              editorRef.current?.setRequestedDocument?.({
                c: event?.data?.c ?? compareDoc.c,
                fileType: compareDoc.fileType,
                url: compareDoc.url,
                token: compareDoc.token,
              })
            },
            onError: (event: { data?: unknown }) => {
              if (cancelled) return
              console.error('[OnlyOffice compare] onError', event?.data)
              setError(describeOnlyOfficeError(event?.data))
            },
          },
        })
      } catch (openError) {
        if (!cancelled) {
          setError(openError instanceof Error ? openError.message : 'Unable to open the comparison.')
        }
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
  }, [open, session])

  if (typeof document === 'undefined' || !open || !session) return null

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div className="min-w-0 pr-3">
          <h2 className="truncate text-lg font-semibold text-foreground">Compare with server version</h2>
          <p className="truncate text-sm text-muted-foreground">{session.entityTitle}</p>
        </div>
        <p className="hidden max-w-md shrink-0 text-xs text-muted-foreground sm:block">
          In the editor: <span className="font-medium text-foreground">Review</span> tab →{' '}
          <span className="font-medium text-foreground">Compare Documents</span> →{' '}
          <span className="font-medium text-foreground">Document from Storage</span> — your upload is
          already selected, just confirm.
        </p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close comparison">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        {error ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
            <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          </div>
        ) : loading ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-background/90 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Preparing comparison...
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
