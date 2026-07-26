import { useCallback, useEffect, useState, type RefObject } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'tectona:layout-debug-visible'
const MAIN_CONTENT_PADDING_X = 80 // px-10 × 2

export type LayoutDebugMetrics = {
  viewportW: number
  viewportH: number
  rowW: number
  rowH: number
  bodyW: number
  bodyH: number
  panelW: number
  panelH: number
  contentW: number
  bodyPct: number
  panelPct: number
  panelPctStore: number
  panelOpen: boolean
  panelKind: 'chat' | 'email' | null
}

type LayoutDebugIndicatorProps = {
  metrics: LayoutDebugMetrics
}

function readVisiblePreference(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'false') return false
    return true
  } catch {
    return true
  }
}

export function useLayoutDebugMetrics(options: {
  rowRef: RefObject<HTMLElement | null>
  bodyRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
  panelOpen: boolean
  panelKind: 'chat' | 'email' | null
  panelPctStore: number
  remeasureKey?: number
}): LayoutDebugMetrics {
  const { rowRef, bodyRef, panelRef, panelOpen, panelKind, panelPctStore, remeasureKey = 0 } = options
  const [metrics, setMetrics] = useState<LayoutDebugMetrics>(() => ({
    viewportW: 0,
    viewportH: 0,
    rowW: 0,
    rowH: 0,
    bodyW: 0,
    bodyH: 0,
    panelW: 0,
    panelH: 0,
    contentW: 0,
    bodyPct: 0,
    panelPct: 0,
    panelPctStore,
    panelOpen,
    panelKind,
  }))

  const measure = useCallback(() => {
    const rowEl = rowRef.current
    const bodyEl = bodyRef.current
    const panelEl = panelRef.current
    const rowW = rowEl?.clientWidth ?? 0
    const rowH = rowEl?.clientHeight ?? 0
    const bodyW = bodyEl?.clientWidth ?? 0
    const bodyH = bodyEl?.clientHeight ?? 0
    const panelW = panelOpen ? (panelEl?.clientWidth ?? 0) : 0
    const panelH = panelOpen ? (panelEl?.clientHeight ?? 0) : 0
    const contentW = Math.max(0, bodyW - MAIN_CONTENT_PADDING_X)

    setMetrics({
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      rowW,
      rowH,
      bodyW,
      bodyH,
      panelW,
      panelH,
      contentW,
      bodyPct: rowW > 0 ? (bodyW / rowW) * 100 : 0,
      panelPct: rowW > 0 ? (panelW / rowW) * 100 : 0,
      panelPctStore,
      panelOpen,
      panelKind,
    })
  }, [rowRef, bodyRef, panelRef, panelOpen, panelKind, panelPctStore])

  useEffect(() => {
    measure()
    const rowEl = rowRef.current
    const bodyEl = bodyRef.current
    const panelEl = panelRef.current
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (rowEl) ro?.observe(rowEl)
    if (bodyEl) ro?.observe(bodyEl)
    if (panelEl) ro?.observe(panelEl)
    window.addEventListener('resize', measure)
    const raf = requestAnimationFrame(measure)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, rowRef, bodyRef, panelRef, remeasureKey])

  return metrics
}

export function LayoutDebugIndicator({ metrics }: LayoutDebugIndicatorProps) {
  const [visible, setVisible] = useState(readVisiblePreference)

  if (!import.meta.env.DEV || !visible) {
    if (import.meta.env.DEV && !visible) {
      return (
        <button
          type="button"
          className="fixed bottom-3 left-3 z-[1350] rounded-md border border-amber-500/40 bg-amber-950/90 px-2 py-1 text-[10px] font-mono text-amber-100 shadow-lg backdrop-blur-sm hover:bg-amber-900/95"
          onClick={() => {
            setVisible(true)
            try {
              localStorage.setItem(STORAGE_KEY, 'true')
            } catch {
              // ignore
            }
          }}
        >
          Layout debug
        </button>
      )
    }
    return null
  }

  const panelLabel =
    metrics.panelKind === 'chat' ? 'Chat' : metrics.panelKind === 'email' ? 'Email' : 'Panel'

  return (
    <div
      className="fixed bottom-3 left-3 z-[1350] max-w-[min(92vw,320px)] rounded-lg border border-amber-500/35 bg-slate-950/92 px-3 py-2.5 font-mono text-[10px] leading-relaxed text-amber-50 shadow-xl backdrop-blur-md"
      aria-live="polite"
      aria-label="Layout debug metrics"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-amber-500/25 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">Layout debug</span>
        <button
          type="button"
          className="rounded p-0.5 text-amber-200/80 hover:bg-amber-500/20 hover:text-amber-50"
          aria-label="Sembunyikan layout debug"
          onClick={() => {
            setVisible(false)
            try {
              localStorage.setItem(STORAGE_KEY, 'false')
            } catch {
              // ignore
            }
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span className="text-slate-400">Viewport</span>
        <span>
          {metrics.viewportW} × {metrics.viewportH}px
        </span>
        <span className="text-slate-400">Row (below topbar)</span>
        <span>
          {metrics.rowW} × {metrics.rowH}px
        </span>
        <span className="text-emerald-300">Body</span>
        <span>
          {metrics.bodyW} × {metrics.bodyH}px ({metrics.bodyPct.toFixed(1)}%)
        </span>
        <span className="text-sky-300">Content (−80px pad)</span>
        <span>{metrics.contentW}px</span>
        <span className="text-violet-300">{panelLabel}</span>
        <span>
          {metrics.panelOpen
            ? `${metrics.panelW} × ${metrics.panelH}px (${metrics.panelPct.toFixed(1)}% · store ${metrics.panelPctStore.toFixed(0)}%)`
            : 'closed'}
        </span>
      </div>
    </div>
  )
}
