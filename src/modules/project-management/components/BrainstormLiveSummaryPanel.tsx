import { useEffect, useRef, useState } from 'react'
import { BookOpenText, ChevronDown, ChevronRight, Loader2, PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { AssistantChatMarkdown } from '@/modules/core-shell/components/AssistantChatMarkdown'
import type { IdeaDraftJobStatusResponse } from '@/lib/api/tectonaAgentRuntimeApi'
import { cn } from '@/lib/utils'
import { buildBrainstormLiveSummary, summaryTextChange, type LiveSummarySection } from '../lib/brainstormLiveSummary'
import { normalizeBrainstormSummary } from '../lib/normalizeBrainstormSummary'

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

const MARKDOWN_CLASS = 'text-sm leading-6 [&_strong]:text-foreground [&_li]:leading-6 [&_p]:my-2'

function AnimatedSummaryText({ text, reduced }: { text: string; reduced: boolean }) {
  const [display, setDisplay] = useState('')
  const displayed = useRef('')
  const [phase, setPhase] = useState<'idle' | 'deleting' | 'typing'>('idle')
  const [highlight, setHighlight] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let highlightTimer: ReturnType<typeof setTimeout>
    const publish = (value: string) => { displayed.current = value; setDisplay(value) }
    const finish = () => {
      publish(text)
      setPhase('idle')
      setHighlight(!reduced)
      highlightTimer = setTimeout(() => setHighlight(false), 1200)
    }
    if (reduced || displayed.current === text) {
      publish(text)
      setPhase('idle')
      setHighlight(false)
      return
    }
    const change = summaryTextChange(displayed.current, text)
    let remaining = change.removed.length
    let written = 0
    const eraseStep = Math.max(1, Math.ceil(remaining / 8))
    const typeStep = Math.max(1, Math.ceil(change.added.length / 20))
    const tick = () => {
      if (remaining > 0) {
        setPhase('deleting')
        remaining = Math.max(0, remaining - eraseStep)
        publish(change.prefix + change.removed.slice(0, remaining).join('') + change.suffix)
      } else {
        setPhase('typing')
        written = Math.min(change.added.length, written + typeStep)
        publish(change.prefix + change.added.slice(0, written).join('') + change.suffix)
        if (written === change.added.length) { finish(); return }
      }
      timer = setTimeout(tick, 24)
    }
    tick()
    return () => { clearTimeout(timer); clearTimeout(highlightTimer) }
  }, [text, reduced])
  return (
    <div data-summary-phase={phase} className={cn('grid rounded-sm transition-colors motion-reduce:transition-none', highlight && 'bg-emerald-50 dark:bg-emerald-950/30')}>
      <div className="invisible col-start-1 row-start-1" aria-hidden="true">
        <AssistantChatMarkdown content={normalizeBrainstormSummary(text)} className={MARKDOWN_CLASS} />
      </div>
      <div className="col-start-1 row-start-1" aria-hidden="true">
        <AssistantChatMarkdown content={normalizeBrainstormSummary(reduced ? text : display)} className={MARKDOWN_CLASS} />
      </div>
      <span className="sr-only">{text}</span>
    </div>
  )
}

function SummarySection({ section, reduced }: { section: LiveSummarySection; reduced: boolean }) {
  return (
    <section className="min-w-0 border-b border-border/60 py-4 last:border-b-0" data-summary-section={section.id}>
      <h3 className="mb-2 text-sm font-semibold leading-5 text-foreground">{section.title}</h3>
      <AnimatedSummaryText text={section.text} reduced={reduced} />
    </section>
  )
}

export function BrainstormLiveSummaryPanel({ job, confidence, busy, error }: {
  job: IdeaDraftJobStatusResponse | null
  confidence: number
  busy: boolean
  error?: string
}) {
  const reduced = useReducedMotion()
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const candidate = JSON.stringify(buildBrainstormLiveSummary(job, confidence))
  const [snapshot, setSnapshot] = useState(() => buildBrainstormLiveSummary(busy ? null : job, busy ? 0 : confidence))
  useEffect(() => {
    // Never publish optimistic edits, partial replies, or failed request results.
    if (!busy && !error) setSnapshot(JSON.parse(candidate) as typeof snapshot)
  }, [candidate, busy, error])
  const [sections, setSections] = useState(snapshot.sections)
  useEffect(() => {
    const ids = new Set(snapshot.sections.map(section => section.id))
    setSections(previous => [...snapshot.sections, ...previous.filter(section => !ids.has(section.id)).map(section => ({ ...section, text: '' }))])
    const timer = setTimeout(() => setSections(previous => previous.filter(section => ids.has(section.id))), reduced ? 0 : 300)
    return () => clearTimeout(timer)
  }, [snapshot.sections, reduced])
  useEffect(() => {
    const wide = window.matchMedia?.('(min-width: 1440px)')
    const update = () => { if (wide?.matches) setMobileOpen(false) }
    wide?.addEventListener('change', update)
    return () => wide?.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close summary"]')?.focus()
    const keydown = (event: KeyboardEvent) => {
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
  }, [mobileOpen])
  const evidence = sections.filter(section => section.id.startsWith('evidence:'))
  const primary = sections.filter(section => !section.id.startsWith('evidence:'))
  const content = (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <h2 id="brainstorm-live-summary-title" className="flex min-w-0 items-center gap-2 text-sm font-semibold"><BookOpenText className="h-4 w-4 shrink-0" />Live AI Summary</h2>
        <button type="button" title="Collapse summary" aria-label="Collapse summary" onClick={() => { setExpanded(false); setMobileOpen(false) }} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted min-[1440px]:inline-flex"><PanelRightClose className="h-4 w-4" /></button>
        <button type="button" title="Close summary" aria-label="Close summary" onClick={() => setMobileOpen(false)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted min-[1440px]:hidden"><X className="h-4 w-4" /></button>
      </header>
      <div className="shrink-0 border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Confidence <strong className="font-semibold text-foreground">{snapshot.confidence}%</strong></span>
          <span>Confirmed evidence <strong className="font-semibold text-foreground">{snapshot.confirmed}/{snapshot.total}</strong></span>
        </div>
        <p role="status" className={cn('mt-2 flex items-start gap-1.5 text-xs leading-5', error ? 'text-destructive' : 'text-muted-foreground')}>
          {busy ? <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
          {busy ? 'Updating summary...' : error ? 'Update failed. Showing the last processed summary.' : snapshot.sections.length ? 'Based on the latest processed brainstorm response.' : 'Waiting for brainstorm evidence.'}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 [overflow-wrap:anywhere]" data-summary-scroll>
        {!snapshot.sections.length ? <p className="py-5 text-sm text-muted-foreground">No summary yet.</p> : null}
        {primary.filter(section => section.kind === 'understanding').map(section => <SummarySection key={section.id} section={section} reduced={reduced} />)}
        {evidence.length ? <div className="border-b border-border/60 py-3">
          <button type="button" className="flex min-h-9 w-full items-center justify-between gap-2 text-left text-sm font-semibold" aria-expanded={evidenceOpen} aria-controls="brainstorm-summary-evidence" onClick={() => setEvidenceOpen(value => !value)}>
            Evidence ({evidence.length}){evidenceOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <div id="brainstorm-summary-evidence" hidden={!evidenceOpen}>
            {evidence.map(section => <div key={section.id}>
              <p className={cn('pt-3 text-xs font-medium', section.kind === 'confirmed' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300')}>{section.kind === 'confirmed' ? 'Confirmed' : 'To confirm'}</p>
              <SummarySection section={section} reduced={reduced} />
            </div>)}
          </div>
        </div> : null}
        {primary.filter(section => section.kind !== 'understanding').map(section => <SummarySection key={section.id} section={section} reduced={reduced} />)}
      </div>
    </>
  )
  return (
    <>
      {mobileOpen ? <button type="button" aria-label="Close summary backdrop" className="absolute inset-0 z-40 bg-black/25 min-[1440px]:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <aside ref={panelRef} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label="Live AI Summary" data-brainstorm-summary-dialog={mobileOpen || undefined}
        className={cn('min-h-0 shrink-0 flex-col border-l border-border bg-background transition-[width] duration-200 motion-reduce:transition-none min-[1440px]:relative min-[1440px]:inset-auto min-[1440px]:z-auto min-[1440px]:flex', expanded ? 'min-[1440px]:w-[360px]' : 'min-[1440px]:w-12', mobileOpen ? 'absolute inset-y-0 right-0 z-50 flex w-[min(400px,100%)] shadow-xl' : 'hidden')}>
        <div className={cn('min-h-0 flex-1 flex-col', expanded || mobileOpen ? 'flex' : 'hidden')}>{content}</div>
        {!expanded && !mobileOpen ? <button type="button" title="Open Live AI Summary" aria-label="Open Live AI Summary" onClick={() => setExpanded(true)} className="mx-auto mt-3 inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"><PanelRightOpen className="h-4 w-4" /></button> : null}
      </aside>
      <button ref={triggerRef} type="button" title="Open Live AI Summary" aria-label="Open Live AI Summary" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background shadow-sm min-[1440px]:hidden"><BookOpenText className="h-4 w-4" /></button>
    </>
  )
}
