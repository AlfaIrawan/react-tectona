import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DocViewer, { DocViewerRenderers } from 'react-doc-viewer'
import { renderAsync } from 'docx-preview'
import { ChevronLeft, ChevronRight, Eye, Loader2, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchDocumentPreviewPdfBlob } from '@/lib/api/documentKnowledgeApi'
import { DocumentOnlyOfficeEditor } from './DocumentOnlyOfficeEditor'
import {
  isRepositoryNativePdfPreview,
  isRepositoryPdfConvertiblePreview,
  loadRepositoryPreviewSource,
  normalizeRepositoryPreviewBlob,
  resolveRepositoryPreviewFileType,
  resolveRepositoryPreviewKind,
  type RepositoryPreviewSource,
} from '@/lib/documents/repositoryDocumentPreview'
import styles from './DocumentRepositoryPreviewDrawer.module.css'

const DOCX_PAGE_SELECTOR = '.docx-wrapper > section.docx, .docx-wrapper > section, section.docx, section'
const DOCX_DEFAULT_PAPER = { width: 793.7, height: 1122.5 }
const DOCX_VIEW_INSET = 12
const DOCX_WRAPPER_PADDING = 20
// Never upscale past the document's real size; only shrink to fit the frame (fit-to-page).
const DOCX_MAX_SCALE = 1

type DocxPaperSize = {
  width: number
  height: number
}

type DocxRenderMetrics = {
  paper: DocxPaperSize
  label: string
  blockWidth: number
  blockHeight: number
}

function parseCssPixel(value: string): number {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function readDocxPagePaperSize(page: HTMLElement): DocxPaperSize {
  const computed = getComputedStyle(page)
  const width = parseCssPixel(page.style.width) || parseCssPixel(computed.width)
  const height =
    parseCssPixel(page.style.minHeight)
    || parseCssPixel(computed.minHeight)
    || parseCssPixel(page.style.height)
    || parseCssPixel(computed.height)

  return {
    width: width > 0 ? width : DOCX_DEFAULT_PAPER.width,
    height: height > 0 ? height : DOCX_DEFAULT_PAPER.height,
  }
}

function resolveCanonicalDocxPaperSize(pages: NodeListOf<Element>): DocxPaperSize {
  let width = 0
  let height = 0

  pages.forEach((page) => {
    const size = readDocxPagePaperSize(page as HTMLElement)
    width = Math.max(width, size.width)
    height = Math.max(height, size.height)
  })

  return {
    width: width > 0 ? width : DOCX_DEFAULT_PAPER.width,
    height: height > 0 ? height : DOCX_DEFAULT_PAPER.height,
  }
}

function resolveDocxPaperLabel(width: number, height: number): string {
  const shortSide = Math.min(width, height)
  const longSide = Math.max(width, height)
  const close = (value: number, target: number, tolerance: number) => Math.abs(value - target) <= tolerance

  if (close(shortSide, 793.7, 24) && close(longSide, 1122.5, 30)) return 'A4'
  if (close(shortSide, 816, 24) && close(longSide, 1056, 30)) return 'Letter'
  if (close(shortSide, 612, 20) && close(longSide, 792, 25)) return 'A5'
  if (close(shortSide, 595, 20) && close(longSide, 842, 25)) return 'A4'

  return `${Math.round(shortSide)} × ${Math.round(longSide)} px`
}

function measureVisiblePageWidth(pages: NodeListOf<Element>, paperWidth: number): number {
  let maxWidth = paperWidth

  pages.forEach((_page, index) => {
    pages.forEach((candidate, candidateIndex) => {
      candidate.classList.toggle('docx-page-active', candidateIndex === index)
    })

    const activePage = pages[index] as HTMLElement
    maxWidth = Math.max(maxWidth, activePage.offsetWidth, activePage.clientWidth)
  })

  pages.forEach((page, index) => {
    page.classList.toggle('docx-page-active', index === 0)
  })

  return maxWidth
}

function readActivePageHeight(body: HTMLElement, paperHeight: number): number {
  const activePage = body.querySelector('section.docx-page-active, section.docx.docx-page-active') as HTMLElement | null
  if (!activePage) return paperHeight

  const measured = activePage.offsetHeight
  const maxAllowed = paperHeight * 1.35
  return Math.max(paperHeight, Math.min(measured, maxAllowed))
}

function buildDocxRenderMetrics(pages: NodeListOf<Element>): DocxRenderMetrics | null {
  if (pages.length === 0) return null

  const paper = resolveCanonicalDocxPaperSize(pages)
  const maxPageWidth = measureVisiblePageWidth(pages, paper.width)

  return {
    paper,
    label: resolveDocxPaperLabel(paper.width, paper.height),
    blockWidth: maxPageWidth + DOCX_WRAPPER_PADDING,
    blockHeight: paper.height + DOCX_WRAPPER_PADDING,
  }
}

function resolveDocxFitScale(
  frameWidth: number,
  frameHeight: number,
  blockWidth: number,
  blockHeight: number,
): number {
  if (frameWidth <= 0 || frameHeight <= 0 || blockWidth <= 0 || blockHeight <= 0) return 1
  return Math.min(frameWidth / blockWidth, frameHeight / blockHeight)
}

type DocumentRepositoryPreviewDrawerProps = {
  open: boolean
  documentId: string | null
  documentTitle: string | null
  localFile?: File | null
  projectId?: string | null
  attachmentId?: string | null
  fileNameHint?: string | null
  /** Incremented by callers (e.g. after an external edit) to force the PDF preview to re-fetch. */
  externalRefreshSignal?: number
  capabilityCode?: string | null
  capabilityOptions?: Array<{ code: string; name: string }>
  capabilityBusy?: boolean
  onCapabilityChange?: (capabilityCode: string | null) => void
  onClose: () => void
}

export function DocumentRepositoryPreviewDrawer({
  open,
  documentId,
  documentTitle,
  localFile,
  projectId,
  attachmentId,
  fileNameHint,
  externalRefreshSignal,
  capabilityCode = null,
  capabilityOptions = [],
  capabilityBusy = false,
  onCapabilityChange,
  onClose,
}: DocumentRepositoryPreviewDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<RepositoryPreviewSource | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const docxBodyRef = useRef<HTMLDivElement | null>(null)
  const docxStyleRef = useRef<HTMLDivElement | null>(null)
  const docxStageRef = useRef<HTMLDivElement | null>(null)
  const docxFitFrameRef = useRef<HTMLDivElement | null>(null)
  const docxScaleSlotRef = useRef<HTMLDivElement | null>(null)
  const docxMetricsRef = useRef<DocxRenderMetrics | null>(null)
  const [docxPageIndex, setDocxPageIndex] = useState(0)
  const [docxPageCount, setDocxPageCount] = useState(0)
  const [docxPaperLabel, setDocxPaperLabel] = useState<string | null>(null)
  // Accurate server-rendered PDF preview (docx→PDF via LibreOffice/Gotenberg). Matches the
  // original document exactly; falls back to client-side docx-preview only if conversion fails.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfFailed, setPdfFailed] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  // Bumped after the editor closes so the (possibly edited) PDF preview is re-fetched.
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)

  const syncDocxPageFit = useCallback(() => {
    const fitFrame = docxFitFrameRef.current
    const body = docxBodyRef.current
    const slot = docxScaleSlotRef.current
    const metrics = docxMetricsRef.current
    if (!fitFrame || !body || !slot || !metrics) return

    const wrapper = body.querySelector('.docx-wrapper') as HTMLElement | null
    if (!wrapper) return

    wrapper.style.transform = 'none'
    wrapper.style.width = ''
    wrapper.style.height = ''
    void wrapper.offsetHeight

    const activePageHeight = readActivePageHeight(body, metrics.paper.height)
    const scaleBlockWidth = metrics.blockWidth
    const scaleBlockHeight = activePageHeight + DOCX_WRAPPER_PADDING
    // Fit the WHOLE page (real width × height, true document aspect ratio) inside the frame so the
    // user never has to scroll. Capped at 1 so a small page is shown at its real size, not upscaled.
    const scale = Math.min(
      resolveDocxFitScale(
        fitFrame.clientWidth - DOCX_VIEW_INSET,
        fitFrame.clientHeight - DOCX_VIEW_INSET,
        scaleBlockWidth,
        scaleBlockHeight,
      ),
      DOCX_MAX_SCALE,
    )

    wrapper.style.transformOrigin = 'top left'
    wrapper.style.transform = `scale(${scale})`
    slot.style.width = `${scaleBlockWidth * scale}px`
    slot.style.height = `${scaleBlockHeight * scale}px`

    setDocxPaperLabel(metrics.label)
  }, [])

  const previewKind = useMemo(
    () => (source ? resolveRepositoryPreviewKind(source.fileName, source.contentType) : null),
    [source],
  )
  const isNativePdf = useMemo(
    () => (source ? isRepositoryNativePdfPreview(source.fileName, source.contentType) : false),
    [source],
  )

  // Stored convertible non-PDF → accurate server-side PDF (hidden MinIO cache, warmed on upload/edit).
  // Local pre-upload files keep client-side docx-preview only.
  const isServerConvertible = Boolean(
    documentId
    && !localFile
    && source
    && isRepositoryPdfConvertiblePreview(source.fileName, source.contentType),
  )
  const usePdfPreview = isServerConvertible && !pdfFailed
  const renderDocxClientSide = previewKind === 'docx' && !usePdfPreview

  useEffect(() => {
    if (!open || !documentId) {
      setSource(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setSource(null)

    void (async () => {
      try {
        const loaded = await loadRepositoryPreviewSource(documentId, localFile, {
          projectId,
          attachmentId,
          fileNameHint,
        })
        if (cancelled) return
        setSource(loaded)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load document preview.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, documentId, localFile, projectId, attachmentId, fileNameHint])

  useEffect(() => {
    setDocxPageIndex(0)
    setDocxPageCount(0)
    setDocxPaperLabel(null)
    docxMetricsRef.current = null
  }, [documentId, source])

  useEffect(() => {
    if (!open) setEditorOpen(false)
  }, [open, documentId])

  // Fetch the accurate server-rendered PDF for stored convertible Office documents.
  useEffect(() => {
    if (!open || !isServerConvertible || !documentId) return

    let cancelled = false
    setPdfLoading(true)
    setPdfFailed(false)
    setPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })

    void (async () => {
      try {
        const { blob } = await fetchDocumentPreviewPdfBlob(documentId)
        if (cancelled) return
        setPdfUrl(URL.createObjectURL(blob))
      } catch {
        // Conversion service unavailable → fall back to client-side docx-preview rendering.
        if (!cancelled) setPdfFailed(true)
      } finally {
        if (!cancelled) setPdfLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, isServerConvertible, documentId, previewRefreshKey, externalRefreshSignal])

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  useEffect(() => {
    if (!source || previewKind !== 'docviewer') {
      setObjectUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      return
    }

    const previewBlob = normalizeRepositoryPreviewBlob(source.blob, source.fileName, source.contentType)
    const nextUrl = URL.createObjectURL(previewBlob)
    setObjectUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [source, previewKind])

  useEffect(() => {
    if (!source || !renderDocxClientSide) return

    const bodyContainer = docxBodyRef.current
    if (!bodyContainer) return

    bodyContainer.replaceChildren()
    docxStyleRef.current?.replaceChildren()

    let cancelled = false

    void (async () => {
      try {
        await renderAsync(source.blob, bodyContainer, docxStyleRef.current ?? undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        })
        if (cancelled) return

        const pages = bodyContainer.querySelectorAll(DOCX_PAGE_SELECTOR)
        const pageCount = pages.length > 0 ? pages.length : 1
        setDocxPageCount(pageCount)
        setDocxPageIndex(0)

        if (pages.length > 0) {
          docxMetricsRef.current = buildDocxRenderMetrics(pages)
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) syncDocxPageFit()
          })
        })
      } catch (renderError) {
        if (cancelled) return
        setError(renderError instanceof Error ? renderError.message : 'Unable to render DOCX preview.')
      }
    })()

    return () => {
      cancelled = true
      bodyContainer.replaceChildren()
      docxStyleRef.current?.replaceChildren()
    }
  }, [source, renderDocxClientSide, syncDocxPageFit])

  useEffect(() => {
    if (previewKind !== 'docx') return

    const bodyContainer = docxBodyRef.current
    if (!bodyContainer) return

    const pages = bodyContainer.querySelectorAll(DOCX_PAGE_SELECTOR)
    if (pages.length === 0) return

    pages.forEach((page, index) => {
      page.classList.toggle('docx-page-active', index === docxPageIndex)
    })

    requestAnimationFrame(() => {
      syncDocxPageFit()
    })
  }, [docxPageIndex, previewKind, loading, docxPageCount, syncDocxPageFit])

  useEffect(() => {
    if (previewKind !== 'docx' || docxPageCount <= 0) return

    const stage = docxStageRef.current
    const fitFrame = docxFitFrameRef.current
    const target = fitFrame ?? stage
    if (!target) return

    const observer = new ResizeObserver(() => {
      syncDocxPageFit()
    })
    observer.observe(target)
    if (stage && target !== stage) observer.observe(stage)

    return () => observer.disconnect()
  }, [previewKind, docxPageCount, syncDocxPageFit])

  useEffect(() => {
    if (!open || previewKind !== 'docx' || docxPageCount <= 1) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setDocxPageIndex((current) => Math.max(0, current - 1))
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setDocxPageIndex((current) => Math.min(docxPageCount - 1, current + 1))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, previewKind, docxPageCount])

  const docViewerDocuments = useMemo(() => {
    if (!source || !objectUrl || previewKind !== 'docviewer' || isNativePdf) return []
    return [{
      uri: objectUrl,
      fileType: resolveRepositoryPreviewFileType(source.fileName, source.contentType),
    }]
  }, [isNativePdf, objectUrl, previewKind, source])

  const usesFilledPreviewFrame =
    !loading
    && !error
    && (
      (isNativePdf && !!objectUrl)
      || ((previewKind === 'docx' || previewKind === 'office') && (usePdfPreview || renderDocxClientSide))
    )

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-[1110] flex w-[min(820px,94vw)] max-w-[94vw] flex-col transition-all duration-300',
        'border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl',
        open && documentId ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none',
      )}
      style={{
        top: 0,
        bottom: 0,
        margin: 0,
        padding: 0,
        boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 backdrop-blur-sm">
        <div className="min-w-0 pr-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Eye className="h-5 w-5 text-primary" />
            View Document
          </h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {documentTitle ?? 'Document preview'}
          </p>
          {onCapabilityChange ? (
            <div className="mt-3 flex max-w-sm items-center gap-2">
              <label htmlFor="repository-capability-picker" className="shrink-0 text-xs font-medium text-muted-foreground">
                Capability
              </label>
              <select
                id="repository-capability-picker"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={capabilityCode ?? ''}
                disabled={capabilityBusy}
                onChange={(event) => {
                  const value = event.target.value.trim()
                  onCapabilityChange(value || null)
                }}
              >
                <option value="">Unclassified</option>
                {capabilityOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isServerConvertible ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => setEditorOpen(true)}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close document preview">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className={cn(styles.previewBody, usesFilledPreviewFrame ? styles.previewBodyDocx : null)}>
        {loading ? (
          <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Streaming document preview...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6">
            <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          </div>
        ) : null}

        {!loading && !error && (previewKind === 'docx' || previewKind === 'office') && usePdfPreview ? (
          pdfLoading || !pdfUrl ? (
            <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Opening preview...
            </div>
          ) : (
            <div className={styles.pdfHost}>
              <iframe
                title="Document preview"
                src={`${pdfUrl}#toolbar=1&navpanes=0`}
                className={styles.pdfFrame}
              />
            </div>
          )
        ) : null}

        {!loading && !error && previewKind === 'office' && pdfFailed ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Preview is temporarily unavailable. Try again in a moment, or use Download to open the original file.
          </div>
        ) : null}

        {!loading && !error && previewKind === 'docx' && renderDocxClientSide ? (
          <>
            <div ref={docxStageRef} className={styles.docxStage}>
              <div ref={docxFitFrameRef} className={styles.docxFitFrame}>
                <div ref={docxScaleSlotRef} className={styles.docxScaleSlot}>
                  <div ref={docxStyleRef} className={styles.docxStyles} aria-hidden />
                  <div ref={docxBodyRef} className={styles.docxPages} />
                </div>
              </div>
            </div>
            {docxPageCount > 0 ? (
              <div className={styles.docxPageControls}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  disabled={docxPageIndex <= 0}
                  onClick={() => setDocxPageIndex((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Previous
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                  Page {docxPageIndex + 1} of {docxPageCount}
                  {docxPaperLabel ? ` · ${docxPaperLabel}` : ''}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  disabled={docxPageIndex >= docxPageCount - 1}
                  onClick={() => setDocxPageIndex((current) => Math.min(docxPageCount - 1, current + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && !error && isNativePdf && objectUrl ? (
          <div className={styles.pdfHost}>
            <iframe
              title="Document preview"
              src={`${objectUrl}#toolbar=1&navpanes=0`}
              className={styles.pdfFrame}
            />
          </div>
        ) : null}

        {!loading && !error && previewKind === 'docviewer' && !isNativePdf && docViewerDocuments.length > 0 ? (
          <div className={styles.docViewerHost}>
            <DocViewer
              documents={docViewerDocuments}
              pluginRenderers={DocViewerRenderers}
              config={{
                header: {
                  disableHeader: true,
                },
              }}
              style={{ height: '100%' }}
            />
          </div>
        ) : null}

        {!loading && !error && previewKind === 'unsupported' ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Preview is not supported for this file type yet. Use Download to open the attachment.
          </div>
        ) : null}
      </div>

      <DocumentOnlyOfficeEditor
        open={editorOpen}
        documentId={documentId}
        documentTitle={documentTitle}
        onClose={() => setEditorOpen(false)}
        onEdited={() => {
          // Edits were persisted as a new version → refresh the preview to show them.
          setPdfFailed(false)
          setPreviewRefreshKey((key) => key + 1)
        }}
      />
    </div>,
    document.body,
  )
}
