// @refresh reset
import { useEffect, useId, useRef, useState } from 'react'
import { BookOpenText, ChevronDown, Loader2, PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { useMobileLayout } from '@/hooks/useMobileLayout'
import { BrainstormMarkdown } from './BrainstormMarkdown'
import { AssistantMermaidBlock } from '@/modules/core-shell/components/AssistantMermaidBlock'
import type { IdeaDraftJobStatusResponse } from '@/lib/api/tectonaAgentRuntimeApi'
import { cn } from '@/lib/utils'
import { attachLatestSummaryDiagrams, buildBrainstormLiveSummary, type LiveSummarySection } from '../lib/brainstormLiveSummary'
import { normalizeBrainstormSummary } from '../lib/normalizeBrainstormSummary'
import { BRAINSTORM_FLOATING_HEADER_CLASS, BRAINSTORM_FLOATING_PANEL_CLASS } from '../lib/brainstormFloatingPanel'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

const MARKDOWN_CLASS = 'text-sm leading-6 [&_strong]:font-semibold [&_strong]:text-foreground [&_li]:leading-6 [&_li]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_p]:my-2 [&_em]:text-muted-foreground'

function AnimatedSummaryText({ text, reduced, active }: { text: string; reduced: boolean; active: boolean }) {
  const previous = useRef(text)
  const [highlight, setHighlight] = useState(false)
  useEffect(() => {
    const changed = previous.current !== text
    previous.current = text
    const start = setTimeout(() => setHighlight(changed && active && !reduced), 0)
    const finish = setTimeout(() => setHighlight(false), 1200)
    return () => { clearTimeout(start); clearTimeout(finish) }
  }, [text, reduced, active])
  // Animation readiness must never gate readable content, including on resume.
  // Keep only a non-blocking update highlight, not deletion/typewriter frames.
  return (
    <div data-summary-phase="idle" className={cn('rounded-sm transition-colors motion-reduce:transition-none', highlight && active && !reduced && 'bg-emerald-50 dark:bg-emerald-950/30')}>
      <div aria-hidden="true">
        <BrainstormMarkdown content={normalizeBrainstormSummary(text)} className={MARKDOWN_CLASS} />
      </div>
      <span className="sr-only">{text}</span>
    </div>
  )
}

function SummarySection({ section, reduced, active }: { section: LiveSummarySection; reduced: boolean; active: boolean }) {
  return (
    <section className="min-w-0 border-b border-border/60 py-4 last:border-b-0" data-summary-section={section.id}>
      <h3 className="mb-3 border-b border-border/70 border-l-2 border-l-primary pb-2 pl-2 text-sm font-semibold leading-5 text-foreground">{section.title}</h3>
      <AnimatedSummaryText text={section.text} reduced={reduced} active={active} />
      {section.diagram && active ? <figure className="mt-3 min-w-0" data-summary-diagram={section.diagram.lane} data-diagram-version={section.diagram.version} data-diagram-status={section.diagram.status}>
        <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted-foreground"><span>{section.diagram.lane === 'as_is' ? 'AS-IS' : 'TO-BE'}</span><span>{section.diagram.status === 'confirmed' ? 'Confirmed' : section.diagram.status === 'proposed' ? 'Proposed' : 'Awaiting confirmation'}</span></figcaption>
        <AssistantMermaidBlock source={section.diagram.source} notation="bpmn" compact />
      </figure> : null}
    </section>
  )
}

export function BrainstormLiveSummaryPanel({ job, busy, requestFailed = false, mobileExpanded, onToggleMobile }: {
  job: IdeaDraftJobStatusResponse | null
  busy: boolean
  requestFailed?: boolean
  mobileExpanded?: boolean
  onToggleMobile?: () => void
}) {
  const mobile = useMobileLayout()
  const contentId = useId()
  const reduced = useReducedMotion()
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const inlineOpen = mobileExpanded ?? mobileOpen
  const [present, setPresent] = useState(false)
  const [entered, setEntered] = useState(false)
  const [textReady, setTextReady] = useState(false)
  const [unread, setUnread] = useState(false)
  const firstSummarySeen = useRef(false)
  const previousSummary = useRef('')
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const readyRevisionInvalid = job?.live_summary?.status === 'ready'
    && (!job.revision || job.live_summary.source_revision !== job.revision)
  const candidate = JSON.stringify(buildBrainstormLiveSummary(readyRevisionInvalid ? null : job))
  const summaryUnavailable = job?.live_summary?.status === 'unavailable'
    || readyRevisionInvalid
  // A remount loses local snapshot state, not the server's validated persisted summary.
  // Require explicit revision equality before displaying a persisted ready snapshot.
  const seedCandidate = !busy && job?.live_summary?.status === 'ready'
    && Boolean(job.revision) && job.live_summary.source_revision === job.revision
    ? candidate : JSON.stringify(buildBrainstormLiveSummary(null))
  const [snapshot, setSnapshot] = useState(() => JSON.parse(seedCandidate) as ReturnType<typeof buildBrainstormLiveSummary>)
  const snapshotJob = useRef(job?.job_id)
  const diagramMessages = JSON.stringify(job?.brainstorm_messages ?? [])
  useEffect(() => {
    // Only saved summary status/revision governs publication, not composer request errors.
    if (snapshotJob.current !== job?.job_id) {
      snapshotJob.current = job?.job_id
      setSnapshot(buildBrainstormLiveSummary(null))
      firstSummarySeen.current = false
    }
    if (busy) {
      // Keep the previous processed snapshot while a request is in flight.
      return
    }
    setSnapshot(previous => {
      const next = !summaryUnavailable ? JSON.parse(candidate) as typeof previous : previous
      return attachLatestSummaryDiagrams(next, JSON.parse(diagramMessages))
    })
  }, [candidate, seedCandidate, diagramMessages, busy, summaryUnavailable, job?.job_id])
  const hasSummary = snapshot.sections.some(section => Boolean(section.text.trim()))
  const summaryText = snapshot.sections.map(section => section.text + (section.diagram ? section.diagram.source + section.diagram.status : '')).join('\n\n')
  useEffect(() => {
    let frame = 0, nextFrame = 0
    let timer: ReturnType<typeof setTimeout>
    if (hasSummary) {
      setPresent(true)
      if (reduced) { setEntered(true); setTextReady(true) }
      else {
        frame = requestAnimationFrame(() => {
          nextFrame = requestAnimationFrame(() => {
            setEntered(true)
            timer = setTimeout(() => setTextReady(true), 240)
          })
        })
      }
    } else {
      setEntered(false)
      setTextReady(false)
      timer = setTimeout(() => setPresent(false), reduced ? 0 : 240)
    }
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame); clearTimeout(timer) }
  }, [hasSummary, reduced])
  useEffect(() => {
    if (!summaryText) { previousSummary.current = ''; setUnread(false); setMobileOpen(false); return }
    const wide = window.matchMedia?.('(min-width: 1440px)').matches
    if (!firstSummarySeen.current) {
      firstSummarySeen.current = true
      if (!wide && !mobile) setMobileOpen(true)
    } else if (summaryText !== previousSummary.current && (mobile ? !inlineOpen : !wide ? !mobileOpen : !expanded)) {
      setUnread(true)
    }
    previousSummary.current = summaryText
  }, [summaryText, expanded, mobileOpen, mobile, inlineOpen])
  useEffect(() => {
    const wide = window.matchMedia?.('(min-width: 1440px)')
    const update = () => { if (wide?.matches) setMobileOpen(false) }
    wide?.addEventListener('change', update)
    return () => wide?.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!mobileOpen || !present || mobile) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close summary"]')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-label="Fullscreen diagram"]')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setMobileOpen(false)
      }
      if (event.key === 'Tab') {
        const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') ?? [])]
          .filter(element => element.getClientRects().length > 0 && !element.closest('[hidden]'))
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', keydown, true)
    return () => { window.removeEventListener('keydown', keydown, true); (previous ?? triggerRef.current)?.focus() }
  }, [mobileOpen, present, mobile])
  if (!present) return null
  const openDesktop = () => { setExpanded(true); setUnread(false) }
  const openMobile = () => { setMobileOpen(true); setUnread(false) }
  const content = (
    <>
      {!mobile && <header className={BRAINSTORM_FLOATING_HEADER_CLASS}>
        <h2 id="brainstorm-live-summary-title" className="flex min-w-0 items-center gap-2 text-sm font-semibold"><BookOpenText className="h-4 w-4 shrink-0" />Live AI Summary</h2>
        <button type="button" title="Collapse summary" aria-label="Collapse summary" onClick={() => { setExpanded(false); setMobileOpen(false) }} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted min-[1440px]:inline-flex"><PanelRightClose className="h-4 w-4" /></button>
        <button type="button" title="Close summary" aria-label="Close summary" onClick={() => setMobileOpen(false)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted min-[1440px]:hidden"><X className="h-4 w-4" /></button>
      </header>}
      {busy || summaryUnavailable ? <div className="shrink-0 border-b border-border/70 px-4 py-3">
        <p role="status" className={cn('flex items-start gap-1.5 text-xs leading-5', summaryUnavailable ? 'text-destructive' : 'text-muted-foreground')}>
          {busy ? <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
          {busy ? 'Updating summary...' : 'Update failed. Showing the last processed summary.'}
        </p>
      </div> : null}
      {!busy && !summaryUnavailable && requestFailed ? <p role="status" className="shrink-0 border-b border-border/70 px-4 py-3 text-xs leading-5 text-muted-foreground">Showing the last successfully loaded summary. The separate request error is shown in the conversation.</p> : null}
      {!busy && !summaryUnavailable && job?.live_summary?.recovery_mode === 'evidence_rebuild' ? <p role="status" className="shrink-0 border-b border-border/70 px-4 py-3 text-xs leading-5 text-muted-foreground">Summary rebuilt from saved evidence.</p> : null}
      <div role="region" aria-label="Idea summary" tabIndex={0} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-5 [overflow-wrap:anywhere]" data-summary-scroll>
        {snapshot.sections.map(section => <SummarySection key={section.id} section={section} reduced={reduced} active={textReady && (expanded || mobileOpen)} />)}
      </div>
    </>
  )
  if (mobile) {
    return (
      <aside aria-label="Live AI Summary" className="brainstorm-summary-inline min-w-0 shrink-0 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <button ref={triggerRef} type="button" aria-expanded={inlineOpen} aria-controls={contentId} onClick={() => { if (onToggleMobile) onToggleMobile(); else setMobileOpen(value => !value); setUnread(false) }} className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left" title={inlineOpen ? 'Collapse Live AI Summary' : 'Open Live AI Summary'}>
          <BookOpenText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-semibold">Live AI Summary</span>
          {unread ? <span role="status" className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-label="Summary updated" /> : null}
          {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-label="Updating summary" /> : null}
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', inlineOpen && 'rotate-180')} aria-hidden />
        </button>
        <div id={contentId} hidden={!inlineOpen} className="max-h-[28dvh] overflow-y-auto overscroll-contain border-t border-border/60">
          {content}
        </div>
      </aside>
    )
  }
  return (
    <>
      <div aria-hidden="true" data-summary-space className={cn('hidden shrink-0 transition-[width] duration-[240ms] motion-reduce:transition-none min-[1440px]:block', !entered ? 'w-0' : expanded ? 'w-[432px]' : 'w-[72px]')} />
      {mobileOpen ? <button type="button" aria-label="Close summary backdrop" className="absolute inset-0 z-40 bg-black/25 min-[1440px]:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <aside ref={panelRef} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label="Live AI Summary" data-summary-floating data-brainstorm-summary-dialog={mobileOpen || undefined} data-summary-entered={entered}
        className={cn(BRAINSTORM_FLOATING_PANEL_CLASS, 'min-[1440px]:right-6 min-[1440px]:top-6 min-[1440px]:bottom-auto min-[1440px]:z-20 min-[1440px]:flex', !entered ? 'translate-x-4 opacity-0' : 'translate-x-0 opacity-100', expanded ? 'min-[1440px]:w-96 min-[1440px]:max-h-[min(760px,calc(100%_-_3rem))]' : 'min-[1440px]:h-12 min-[1440px]:w-12', mobileOpen ? 'bottom-3 right-3 top-3 z-50 flex w-[min(400px,calc(100%_-_1.5rem))]' : 'hidden')}>
        <div className={cn('min-h-0 flex-1 flex-col transition-[transform,opacity] duration-[240ms] motion-reduce:transition-none min-[1440px]:w-96', entered ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0', expanded || mobileOpen ? 'flex' : 'hidden')}>{content}</div>
        {!expanded && !mobileOpen ? <button type="button" title={unread ? 'Open Live AI Summary - updated' : 'Open Live AI Summary'} aria-label="Open Live AI Summary" onClick={openDesktop} className="relative m-auto inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"><PanelRightOpen className="h-4 w-4" />{unread ? <span role="status" aria-label="Summary updated" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-600" /> : null}</button> : null}
      </aside>
      <button ref={triggerRef} type="button" title={unread ? 'Open Live AI Summary - updated' : 'Open Live AI Summary'} aria-label="Open Live AI Summary" aria-expanded={mobileOpen} onClick={openMobile} className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background shadow-sm min-[1440px]:hidden"><BookOpenText className="h-4 w-4" />{unread ? <span role="status" aria-label="Summary updated" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-600" /> : null}</button>
    </>
  )
}
