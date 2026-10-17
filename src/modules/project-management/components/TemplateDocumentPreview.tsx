import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { FileText, Loader2, RotateCw } from 'lucide-react'
import {
  downloadDocumentAttachmentBlob,
  downloadTemplateAttachmentBlob,
  fetchLatestAttachmentId,
} from '@/lib/api/documentKnowledgeApi'
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

async function loadSourceHtml(source: TemplateDocumentPreviewSource): Promise<string> {
  let blob: Blob
  if (source.kind === 'document') {
    const attachmentId = source.attachmentId || await fetchLatestAttachmentId(source.documentId, source.projectId)
    if (!attachmentId) throw new Error('This document has no file yet.')
    blob = (await downloadDocumentAttachmentBlob(source.documentId, attachmentId)).blob
  } else {
    blob = (await downloadTemplateAttachmentBlob(source.templateId)).blob
  }
  const mammoth = await import('mammoth')
  const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() })
  return DOMPurify.sanitize(result.value ?? '')
}

// A Word-like page: mammoth gives plain HTML, so tables and headings get their look here.
const PAGE_CLASS = cn(
  'mx-auto w-full max-w-[860px] bg-white px-6 py-8 text-[13px] leading-6 text-slate-900 shadow-sm ring-1 ring-slate-200 sm:px-10',
  '[&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:font-semibold [&_p]:my-1.5',
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:inline-block [&_img]:max-w-full',
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top',
  '[&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td_p]:my-0.5',
  '[&_.tpl-part:hover]:bg-blue-50/60',
)

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
  className?: string
}) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [locatedCount, setLocatedCount] = useState(0)
  const [rebuilt, setRebuilt] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const templateRef = useRef<HTMLTemplateElement | null>(null)
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
    loadSourceHtml(source)
      .then((value) => {
        if (cancelled) return
        const template = document.createElement('template')
        template.innerHTML = value
        templateRef.current = template
        setHtml(value)
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
    page.replaceChildren(template.content.cloneNode(true))
    const current = currentVersion !== null ? payloads[currentVersion] : undefined
    const located = locateParts(page, parts, current)
    for (const part of parts) {
      const found = located.get(part.key)
      if (found) annotatePart(found, part, partPreviewState(part, choices[part.key], payloads))
    }
    const order = Array.from(located.values())
      .sort((a, b) => (a.elements[0].compareDocumentPosition(b.elements[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((item) => item.key)
    setLocatedCount(order.length)
    const orderKey = order.join('|')
    if (orderKey !== lastOrderRef.current) {
      lastOrderRef.current = orderKey
      onLocatedChange?.(order)
    }
    setRebuilt((count) => count + 1)
  }, [html, parts, choices, payloads, currentVersion, onLocatedChange])

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
          ref={pageRef}
          className={cn(PAGE_CLASS, (loading || error || !source || !html) && 'hidden')}
          onClick={handlePageClick}
        />
      </div>
    </div>
  )
}
