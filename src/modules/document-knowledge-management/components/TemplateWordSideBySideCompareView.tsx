import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RevisionDiffSegment } from '@/lib/documents/revisionContentHighlight'
import { TemplateCompareZoomFooter, type TemplateCompareFooterDocumentStats } from '@/modules/document-knowledge-management/components/TemplateCompareZoomFooter'
import {
  applyDocxHighlights,
  buildDocxHighlightSpecs,
  fitDocxPreviewToContainer,
  readDocxPreviewStats,
  resolveVisibleDocxPageIndex,
  sanitizeDocxPreviewFormFields,
  TEMPLATE_COMPARE_ZOOM_DEFAULT,
  type DocxPreviewStats,
} from '@/modules/document-knowledge-management/lib/templateCompareDocxHighlight'
import {
  buildMinimapMarkers,
  buildSideBySideChangeCards,
} from '@/modules/document-knowledge-management/lib/templateCompareSideBySide'
import { summarizeRevisionDiffSegments } from '@/modules/document-knowledge-management/lib/templateCompareText'

/** Word Online canvas + revision colors (match Office web viewer). */
const WORD_CANVAS = '#F3F2F1'
const WORD_PAGE = '#FFFFFF'
const WORD_HEADER_BG = '#FAFAFA'
const WORD_HEADER_BORDER = '#EDEBE9'
const WORD_HEADER_TEXT = '#323130'

type TemplateWordSideBySideCompareViewProps = {
  status: 'loading' | 'ready' | 'identical' | 'error'
  message: string | null
  segments: RevisionDiffSegment[] | null
  serverBlob: Blob | null
  uploadBlob: Blob | null
  serverTitle: string
  uploadTitle: string
}

function DocxPane({
  blob,
  label,
  labelClassName,
  scrollRef,
  onScroll,
  segments,
  side,
  zoom,
  onRendered,
  trackVisiblePage,
  onVisiblePageChange,
}: {
  blob: Blob | null
  label: string
  labelClassName: string
  scrollRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  segments: RevisionDiffSegment[] | null
  side: 'server' | 'upload'
  zoom: number
  onRendered?: (stats: DocxPreviewStats) => void
  trackVisiblePage?: boolean
  onVisiblePageChange?: (page: number) => void
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const styleRef = useRef<HTMLDivElement | null>(null)
  const zoomRef = useRef(zoom)
  const lastReportedPageRef = useRef(1)
  const [rendering, setRendering] = useState(true)
  const [renderError, setRenderError] = useState<string | null>(null)

  const onRenderedRef = useRef(onRendered)
  const onVisiblePageChangeRef = useRef(onVisiblePageChange)
  onRenderedRef.current = onRendered
  onVisiblePageChangeRef.current = onVisiblePageChange
  zoomRef.current = zoom

  const reportVisiblePage = useCallback((page: number) => {
    if (page === lastReportedPageRef.current) return
    lastReportedPageRef.current = page
    onVisiblePageChangeRef.current?.(page)
  }, [])

  const highlights = useMemo(
    () => (segments ? buildDocxHighlightSpecs(segments, side) : []),
    [segments, side],
  )

  useEffect(() => {
    if (!blob || !bodyRef.current) return

    let cancelled = false
    setRendering(true)
    setRenderError(null)
    bodyRef.current.replaceChildren()
    styleRef.current?.replaceChildren()

    void (async () => {
      try {
        const { renderAsync } = await import('docx-preview')
        if (cancelled || !bodyRef.current) return

        await renderAsync(blob, bodyRef.current, styleRef.current ?? undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
        })

        if (cancelled || !bodyRef.current || !scrollRef.current) return
        applyDocxHighlights(bodyRef.current, highlights)
        sanitizeDocxPreviewFormFields(bodyRef.current)
        const wrapper = bodyRef.current.querySelector('.docx-wrapper') as HTMLElement | null
        if (wrapper) delete wrapper.dataset.compareScaleKey
        fitDocxPreviewToContainer(scrollRef.current, zoomRef.current)
        onRenderedRef.current?.(readDocxPreviewStats(bodyRef.current))
        if (trackVisiblePage && scrollRef.current) {
          reportVisiblePage(resolveVisibleDocxPageIndex(scrollRef.current))
        }
      } catch (error) {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : 'Failed to render Word document.')
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [blob, highlights, scrollRef, trackVisiblePage, reportVisiblePage])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const applyScale = () => {
      const wrapper = container.querySelector('.docx-wrapper') as HTMLElement | null
      if (wrapper) delete wrapper.dataset.compareScaleKey
      fitDocxPreviewToContainer(container, zoomRef.current)
    }

    applyScale()

    let resizeFrame = 0
    let lastWidth = container.clientWidth
    const observer = new ResizeObserver(() => {
      const nextWidth = container.clientWidth
      if (Math.abs(nextWidth - lastWidth) < 1) return
      lastWidth = nextWidth
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(applyScale)
    })
    observer.observe(container)

    return () => {
      window.cancelAnimationFrame(resizeFrame)
      observer.disconnect()
    }
  }, [scrollRef, zoom])

  const handleScroll = () => {
    if (trackVisiblePage && scrollRef.current) {
      reportVisiblePage(resolveVisibleDocxPageIndex(scrollRef.current))
    }
    onScroll()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: WORD_HEADER_BG }}>
      <div
        className={cn('shrink-0 border-b px-4 py-2 text-xs font-semibold', labelClassName)}
        style={{
          backgroundColor: WORD_HEADER_BG,
          borderColor: WORD_HEADER_BORDER,
          color: WORD_HEADER_TEXT,
        }}
      >
        {label}
      </div>
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-scroll py-6 [scrollbar-gutter:stable]"
        style={{ backgroundColor: WORD_CANVAS }}
        onScroll={handleScroll}
      >
        <div className="mx-auto w-full max-w-[820px] px-4">
          <div ref={styleRef} className="hidden" aria-hidden />
          <div ref={bodyRef} className="template-compare-docx-root" />
        </div>
        {rendering ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-xs text-[#605E5C]"
            style={{ backgroundColor: `${WORD_CANVAS}CC` }}
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Rendering Word…
          </div>
        ) : null}
        {renderError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-center text-xs text-red-700">
            {renderError}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function TemplateWordSideBySideCompareView({
  status,
  message,
  segments,
  serverBlob,
  uploadBlob,
  serverTitle,
  uploadTitle,
}: TemplateWordSideBySideCompareViewProps) {
  const leftScrollRef = useRef<HTMLDivElement | null>(null)
  const rightScrollRef = useRef<HTMLDivElement | null>(null)
  const syncingScrollRef = useRef(false)
  const [zoom, setZoom] = useState(TEMPLATE_COMPARE_ZOOM_DEFAULT)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [serverWordCount, setServerWordCount] = useState(0)
  const [uploadWordCount, setUploadWordCount] = useState(0)

  const diffCounts = useMemo(() => {
    if (!segments || status !== 'ready') {
      return { removed: null, added: null } as const
    }
    const items = summarizeRevisionDiffSegments(segments)
    return {
      removed: items.filter((item) => item.kind === 'removed').length,
      added: items.filter((item) => item.kind === 'added').length,
    }
  }, [segments, status])

  const footerDocumentStats = useMemo<TemplateCompareFooterDocumentStats>(
    () => ({
      currentPage,
      pageCount,
      serverWordCount,
      uploadWordCount,
      removedCount: diffCounts.removed,
      addedCount: diffCounts.added,
    }),
    [currentPage, pageCount, serverWordCount, uploadWordCount, diffCounts],
  )

  const handleServerRendered = useCallback((stats: DocxPreviewStats) => {
    setPageCount(stats.pageCount)
    setServerWordCount(stats.wordCount)
    setCurrentPage(1)
  }, [])

  const handleUploadRendered = useCallback((stats: DocxPreviewStats) => {
    setUploadWordCount(stats.wordCount)
    setPageCount((previous) => Math.max(previous, stats.pageCount))
  }, [])

  const changeCards = useMemo(
    () => (segments ? buildSideBySideChangeCards(segments) : []),
    [segments],
  )
  const minimapMarkers = useMemo(() => buildMinimapMarkers(changeCards), [changeCards])

  const syncScroll = useCallback((source: 'left' | 'right') => {
    if (syncingScrollRef.current) return
    const from = source === 'left' ? leftScrollRef.current : rightScrollRef.current
    const to = source === 'left' ? rightScrollRef.current : leftScrollRef.current
    if (!from || !to) return

    syncingScrollRef.current = true
    const fromMax = Math.max(from.scrollHeight - from.clientHeight, 1)
    const toMax = Math.max(to.scrollHeight - to.clientHeight, 1)
    const ratio = from.scrollTop / fromMax
    to.scrollTop = ratio * toMax

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        syncingScrollRef.current = false
      })
    })
  }, [])

  const scrollToChange = (changeId: string) => {
    const leftTarget = leftScrollRef.current?.querySelector(`[data-change-id="${changeId}"]`) as HTMLElement | null
    const rightTarget = rightScrollRef.current?.querySelector(`[data-change-id="${changeId}"]`) as HTMLElement | null
    const target = leftTarget ?? rightTarget
    const container = leftTarget ? leftScrollRef.current : rightScrollRef.current
    if (!target || !container || !leftScrollRef.current || !rightScrollRef.current) return

    const targetTop = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    const centered = Math.max(0, targetTop - container.clientHeight * 0.35)
    leftScrollRef.current.scrollTop = centered
    rightScrollRef.current.scrollTop = centered
  }

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Preparing side-by-side comparison…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {message || 'Failed to load comparison.'}
        </div>
      </div>
    )
  }

  if (!serverBlob || !uploadBlob) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Compare files are not ready.
      </div>
    )
  }

  const showDiff = status === 'ready' && segments

  return (
    <>
      <style>{`
        .template-compare-docx-root .docx-wrapper {
          background: ${WORD_CANVAS} !important;
          padding: 0 !important;
          margin: 0 auto !important;
          will-change: transform;
        }
        .template-compare-docx-root .docx-wrapper > section {
          background: ${WORD_PAGE} !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04) !important;
          margin: 0 auto 24px auto !important;
        }
        .template-compare-mark {
          border-radius: 1px;
          padding: 0 1px;
        }
        .template-compare-mark--removed {
          background: #ffb4ab;
          color: inherit;
          text-decoration: line-through;
          text-decoration-color: #e81123;
          text-decoration-thickness: 1px;
        }
        .template-compare-mark--added {
          background: #b4d7ff;
          color: inherit;
        }
      `}</style>

      <div className="absolute inset-0 flex flex-col">
        <div
          className="flex min-h-0 flex-1 divide-x"
          style={{ backgroundColor: WORD_CANVAS, borderColor: WORD_HEADER_BORDER }}
        >
          <DocxPane
            blob={serverBlob}
            label={`Server — ${serverTitle}`}
            labelClassName="border-l-[3px] border-l-[#107C10]"
            scrollRef={leftScrollRef}
            onScroll={() => syncScroll('left')}
            segments={showDiff ? segments : null}
            side="server"
            zoom={zoom}
            onRendered={handleServerRendered}
            trackVisiblePage
            onVisiblePageChange={setCurrentPage}
          />

          {showDiff && minimapMarkers.length > 0 ? (
            <div className="relative w-10 shrink-0" style={{ backgroundColor: WORD_CANVAS }} aria-label="Change map">
              {minimapMarkers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  title="Jump to change"
                  className="absolute left-0 right-0 h-2 -translate-y-1/2 border-0 bg-transparent p-0"
                  style={{ top: `${marker.ratio * 100}%` }}
                  onClick={() => scrollToChange(marker.id)}
                >
                  <span
                    className={cn(
                      'absolute top-0 h-2 w-1/2 rounded-r-sm',
                      marker.kind === 'removed' || marker.kind === 'changed' ? 'left-0 bg-[#E81123]' : 'left-0 opacity-0',
                    )}
                  />
                  <span
                    className={cn(
                      'absolute top-0 h-2 w-1/2 rounded-l-sm',
                      marker.kind === 'added' || marker.kind === 'changed' ? 'right-0 bg-[#0078D4]' : 'right-0 opacity-0',
                    )}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="w-px shrink-0" style={{ backgroundColor: WORD_HEADER_BORDER }} aria-hidden />
          )}

          <DocxPane
            blob={uploadBlob}
            label={`Your upload — ${uploadTitle}`}
            labelClassName="border-l-[3px] border-l-[#0078D4]"
            scrollRef={rightScrollRef}
            onScroll={() => syncScroll('right')}
            segments={showDiff ? segments : null}
            side="upload"
            zoom={zoom}
            onRendered={handleUploadRendered}
          />
        </div>

        <TemplateCompareZoomFooter
          zoom={zoom}
          onZoomChange={setZoom}
          documentStats={footerDocumentStats}
        />
      </div>

      {status === 'identical' ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
          <div className="max-w-lg rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-2 text-xs text-emerald-900 shadow-sm">
            {message || 'Content is identical — only the file name or family conflicted.'}
          </div>
        </div>
      ) : null}
    </>
  )
}
