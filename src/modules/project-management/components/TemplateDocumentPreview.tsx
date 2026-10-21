import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import DOMPurify from 'dompurify'
import { FileText, Loader2, RotateCw } from 'lucide-react'
import {
  downloadDocumentAttachmentBlob,
  downloadTemplateAttachmentBlob,
  fetchLatestAttachmentId,
} from '@/lib/api/documentKnowledgeApi'
import { fixDocxPreviewCellDirection } from '@/lib/docxPreviewFixes'
import { visualPxToLayoutPx } from '@/lib/uiScale'
import { cn } from '@/lib/utils'
import {
  annotatePart,
  highlightTargets,
  locateParts,
  partPreviewState,
  SELECTED_CLASSES,
} from '@/modules/project-management/lib/templateDocumentPreview'
import type { PartPayload, TemplatePart, TemplatePartChoice } from '@/modules/project-management/lib/templatePartSelection'

export type TemplateDocumentPreviewSource =
  | { kind: 'document'; documentId: string; attachmentId?: string | null; projectId?: string | null; label: string }
  | { kind: 'template'; templateId: string; label: string }

function sourceKey(source: TemplateDocumentPreviewSource | null): string {
  if (!source) return ''
  // The label names the version, so a new version of the same document is opened again.
  return source.kind === 'document'
    ? `doc:${source.documentId}:${source.attachmentId ?? ''}:${source.label}`
    : `tpl:${source.templateId}`
}

/**
 * The rendered document as DOM, never as an HTML string: docx-preview puts some blocks inside a
 * paragraph (a picture is a <div> in the centred <p>), which an HTML parser would move out of the
 * paragraph — the cover logo lost its centring that way. The node is sanitized in place and cloned.
 */
async function loadSourceDom(source: TemplateDocumentPreviewSource): Promise<HTMLElement> {
  let blob: Blob
  if (source.kind === 'document') {
    const attachmentId = source.attachmentId || await fetchLatestAttachmentId(source.documentId, source.projectId)
    if (!attachmentId) throw new Error('This document has no file yet.')
    blob = (await downloadDocumentAttachmentBlob(source.documentId, attachmentId)).blob
  } else {
    blob = (await downloadTemplateAttachmentBlob(source.templateId)).blob
  }
  // docx-preview lays the document out as Word pages (size, margins, header and footer, fonts,
  // styles, page breaks); the same options as the Document repository preview.
  const { renderAsync } = await import('docx-preview')
  const holder = document.createElement('div')
  await renderAsync(blob, holder, holder, {
    className: DOCX_CLASS,
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    // Images as data URLs: they survive the page being rebuilt and pass the sanitizer.
    useBase64URL: true,
  })
  fixDocxPreviewCellDirection(holder)
  // The document's own <style> blocks are kept (scoped to DOCX_CLASS by docx-preview).
  DOMPurify.sanitize(holder, { ADD_TAGS: ['style'], IN_PLACE: true })
  return holder
}

const DOCX_CLASS = 'tpl-docx'
// docx-preview paints its wrapper gray with padding; here the pages sit on the panel itself.
const PAGE_CLASS = cn(
  'w-full',
  '[&_.tpl-docx-wrapper]:!bg-transparent [&_.tpl-docx-wrapper]:!p-0',
  '[&_.tpl-docx-wrapper>section.tpl-docx]:!mb-5 [&_.tpl-docx-wrapper>section.tpl-docx]:!shadow-md [&_.tpl-docx-wrapper>section.tpl-docx]:ring-1 [&_.tpl-docx-wrapper>section.tpl-docx]:ring-slate-200',
  // Tailwind's preflight makes every img/svg a block, so an inline Word picture ignored its
  // paragraph's alignment (the cover logo sat left instead of centred). In Word they flow as text.
  '[&_section.tpl-docx_img]:inline-block [&_section.tpl-docx_img]:align-baseline',
  '[&_section.tpl-docx_svg]:inline-block [&_section.tpl-docx_svg]:align-baseline',
  '[&_.tpl-part:hover]:bg-blue-50/60',
)

/** Pages wider than their column are zoomed out to fit (a narrow workspace, or the comment rail
 * taking room), never in. */
function fitPagesToWidth(page: HTMLElement) {
  const wrapper = page.querySelector<HTMLElement>(`.${DOCX_CLASS}-wrapper`)
  const firstPage = wrapper?.querySelector<HTMLElement>(`section.${DOCX_CLASS}`)
  const column = page.parentElement
  if (!wrapper || !firstPage || !column) return
  wrapper.style.zoom = ''
  const available = column.clientWidth
  const pageWidth = firstPage.offsetWidth
  if (pageWidth > 0 && available > 0 && pageWidth > available) wrapper.style.zoom = String(available / pageWidth)
}

/** Where each marked part starts, in layout px from the top of the scrolled content. */
export type PartAnchors = Record<string, number>

function partAnchors(page: HTMLElement, content: HTMLElement): PartAnchors {
  const origin = content.getBoundingClientRect().top
  const anchors: PartAnchors = {}
  page.querySelectorAll<HTMLElement>('[data-part-key]').forEach((el) => {
    const key = el.dataset.partKey
    if (!key || key in anchors) return
    // Rects are visual px (ui-scale-lock zooms <html>); the rail is positioned in layout px.
    anchors[key] = Math.max(0, Math.round(visualPxToLayoutPx(el.getBoundingClientRect().top - origin)))
  })
  return anchors
}

function sameAnchors(a: PartAnchors, b: PartAnchors): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

/**
 * The document the generator will write, shown as a page: the current version (or the template for
 * a new document) with every part it can find marked and shown as chosen. Selecting a part on the
 * left lights it up here and scrolls to it; clicking a marked part here selects it on the left.
 */
export function TemplateDocumentPreview({
  source,
  parts,
  choices,
  payloads,
  currentVersion,
  selectedKey,
  onSelect,
  onLocatedChange,
  drafts,
  proposals,
  renderRail,
  className,
}: {
  source: TemplateDocumentPreviewSource | null
  parts: TemplatePart[]
  choices: Record<string, TemplatePartChoice>
  payloads: Record<number, PartPayload | undefined>
  /** The version whose payload holds the current values (to find fields by their text). */
  currentVersion: number | null
  selectedKey: string | null
  onSelect: (key: string) => void
  /** The keys found in the document, in document order. */
  onLocatedChange?: (keys: string[]) => void
  /** Accepted comment texts by part key (shown for parts set to 'draft'). */
  drafts?: Record<string, string>
  /** Open comment proposals by part key (shown, not applied). */
  proposals?: Record<string, string>
  /** A column beside the pages (the comment rail), given where each part starts. */
  renderRail?: (anchors: PartAnchors) => ReactNode
  className?: string
}) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [anchors, setAnchors] = useState<PartAnchors>({})
  const measureAnchors = useCallback(() => {
    const page = pageRef.current
    const content = contentRef.current
    if (!page || !content) return
    const next = partAnchors(page, content)
    setAnchors((prev) => (sameAnchors(prev, next) ? prev : next))
  }, [])
  // Changes each time a document is loaded; the rendered DOM itself is in templateRef.
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [locatedCount, setLocatedCount] = useState(0)
  const [rebuilt, setRebuilt] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const templateRef = useRef<HTMLElement | null>(null)
  const lastOrderRef = useRef('')
  const selectedFromPageRef = useRef(false)
  const key = sourceKey(source)

  useEffect(() => {
    if (!source) {
      setHtml('')
      setError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    loadSourceDom(source)
      .then((rendered) => {
        if (cancelled) return
        templateRef.current = rendered
        setHtml(`${key}:${Date.now()}`)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Couldn't open the document.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // The source object is rebuilt on every render; its key says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload])

  // Rebuild the page whenever a choice or a loaded version changes.
  useLayoutEffect(() => {
    const page = pageRef.current
    const template = templateRef.current
    if (!page) return
    if (!html || !template) {
      page.replaceChildren()
      return
    }
    page.replaceChildren(...Array.from((template.cloneNode(true) as HTMLElement).childNodes))
    const current = currentVersion !== null ? payloads[currentVersion] : undefined
    const located = locateParts(page, parts, current)
    for (const part of parts) {
      const found = located.get(part.key)
      if (found) {
        const comment = { draft: drafts?.[part.key], proposal: proposals?.[part.key] }
        annotatePart(found, part, partPreviewState(part, choices[part.key], payloads, comment))
      }
    }
    const order = Array.from(located.values())
      .sort((a, b) => (a.elements[0].compareDocumentPosition(b.elements[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((item) => item.key)
    fitPagesToWidth(page)
    measureAnchors()
    setLocatedCount(order.length)
    const orderKey = order.join('|')
    if (orderKey !== lastOrderRef.current) {
      lastOrderRef.current = orderKey
      onLocatedChange?.(order)
    }
    setRebuilt((count) => count + 1)
  }, [html, parts, choices, payloads, currentVersion, onLocatedChange, drafts, proposals, measureAnchors])

  // Keep the pages fitted and the rail aligned when the panel or the pages resize (the workspace
  // switches to tabs, the rail appears, pictures finish loading).
  useEffect(() => {
    const scroller = scrollRef.current
    const page = pageRef.current
    if (!scroller || !page || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      fitPagesToWidth(page)
      measureAnchors()
    })
    observer.observe(scroller)
    observer.observe(page)
    return () => observer.disconnect()
  }, [html, measureAnchors])

  // Light up the selected part; scroll to it unless it was clicked here.
  useEffect(() => {
    const page = pageRef.current
    const scroller = scrollRef.current
    if (!page || !scroller) return
    page.querySelectorAll<HTMLElement>('[data-selected-part]').forEach((el) => {
      el.classList.remove(...SELECTED_CLASSES)
      el.removeAttribute('data-selected-part')
    })
    if (!selectedKey) return
    const targets = highlightTargets(page, selectedKey)
    targets.forEach((el) => {
      el.classList.add(...SELECTED_CLASSES)
      el.setAttribute('data-selected-part', '')
    })
    if (selectedFromPageRef.current) {
      selectedFromPageRef.current = false
      return
    }
    const first = targets[0]
    if (!first) return
    // Rects are visual px; scrollTop is layout px (ui-scale-lock zooms <html>).
    const top = visualPxToLayoutPx(first.getBoundingClientRect().top - scroller.getBoundingClientRect().top) + scroller.scrollTop
    scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 4), behavior: 'smooth' })
  }, [selectedKey, rebuilt])

  const handlePageClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const marked = (event.target as HTMLElement).closest<HTMLElement>('[data-part-key]')
    const partKey = marked?.dataset.partKey
    if (!partKey) return
    selectedFromPageRef.current = true
    onSelect(partKey)
  }, [onSelect])

  const selectedPart = selectedKey ? parts.find((part) => part.key === selectedKey) : undefined
  const selectedMissing = Boolean(selectedPart && html && !loading && pageRef.current
    && highlightTargets(pageRef.current, selectedPart.key).length === 0)

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Document preview</p>
        <p className="text-[11px] text-muted-foreground">
          {source ? source.label : 'No document'}
          {html && parts.length > 0 ? ` · ${locatedCount} of ${parts.length} parts marked` : ''}
        </p>
      </div>
      {selectedMissing ? (
        <p className="mb-2 shrink-0 rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          “{selectedPart?.label}” couldn't be found in this document, so it isn't marked.
        </p>
      ) : null}
      <div ref={scrollRef} className="scroll-reveal min-h-0 flex-1 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-5">
        {loading ? (
          <div className="flex h-full min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Opening {source?.label ?? 'document'}…
          </div>
        ) : error ? (
          <div role="alert" className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>Couldn't open the document for the preview. {error}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
              onClick={() => setReload((count) => count + 1)}
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          </div>
        ) : !source ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-5 w-5" aria-hidden />
            Select a template to see the document.
          </div>
        ) : null}
        <div
          ref={contentRef}
          className={cn('relative flex min-w-0 items-start gap-4', (loading || error || !source || !html) && 'hidden')}
        >
          <div className="min-w-0 flex-1">
            <div ref={pageRef} className={PAGE_CLASS} onClick={handlePageClick} />
          </div>
          {renderRail ? <div className="relative w-[300px] shrink-0 self-stretch">{renderRail(anchors)}</div> : null}
        </div>
      </div>
    </div>
  )
}
