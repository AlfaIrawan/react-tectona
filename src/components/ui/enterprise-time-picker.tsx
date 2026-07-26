import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiOverlayStore } from '@/stores/ui-overlay-store'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

function parseHm(value: string): { h: string; m: string } {
  const t = value?.trim() ?? ''
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return { h: '12', m: '00' }
  let hh = parseInt(m[1], 10)
  let mm = parseInt(m[2], 10)
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) hh = 12
  if (!Number.isFinite(mm) || mm < 0 || mm > 59) mm = 0
  return { h: String(hh).padStart(2, '0'), m: String(mm).padStart(2, '0') }
}

export interface EnterpriseTimePickerProps {
  id?: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function EnterpriseTimePicker({
  id: idProp,
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel = 'Time',
}: EnterpriseTimePickerProps) {
  const genId = useId()
  const triggerId = idProp ?? `enterprise-time-${genId.replace(/:/g, '')}`
  const panelId = `${triggerId}-panel`

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hourScrollRef = useRef<HTMLDivElement>(null)
  const minuteScrollRef = useRef<HTMLDivElement>(null)

  const { h: hour, m: minute } = parseHm(value)
  const display = value?.trim() && /^\d{1,2}:\d{2}$/.test(value.trim()) ? `${hour}:${minute}` : ''

  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const panelW = 200
    const panelH = 220
    const margin = 6
    let top = r.bottom + margin
    if (top + panelH > window.innerHeight - 8) {
      top = Math.max(8, r.top - panelH - margin)
    }
    let left = r.right - panelW
    left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8))
    setPanelStyle({
      top,
      left,
      position: 'fixed',
      width: panelW,
      zIndex: 260,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    useUiOverlayStore.getState().incBlockingOverlay()
    return () => useUiOverlayStore.getState().decBlockingOverlay()
  }, [open])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    const onResize = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [open])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const hs = hourScrollRef.current
      const ms = minuteScrollRef.current
      if (hs) {
        const btn = hs.querySelector(`[data-hour="${hour}"]`) as HTMLElement | null
        btn?.scrollIntoView({ block: 'center' })
      }
      if (ms) {
        const btn = ms.querySelector(`[data-minute="${minute}"]`) as HTMLElement | null
        btn?.scrollIntoView({ block: 'center' })
      }
    })
  }, [open, hour, minute])

  const pickHour = (h: string) => {
    onChange(`${h}:${minute}`)
  }

  const pickMinute = (m: string) => {
    onChange(`${hour}:${m}`)
  }

  return (
    <div className={cn('relative w-full', className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? panelId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-left text-sm shadow-sm',
          'text-slate-900 transition-[border-color,box-shadow]',
          'hover:border-slate-300 focus:outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50 dark:hover:border-slate-500 dark:focus-visible:ring-slate-500/30'
        )}
      >
        <span className={cn('tabular-nums', !display && 'text-slate-400 dark:text-slate-500')}>
          {display || '--:--'}
        </span>
        <Clock className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      </button>

      {open
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[259] bg-transparent"
                aria-hidden
                onMouseDown={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                id={panelId}
                role="listbox"
                aria-label={ariaLabel}
                className={cn(
                  'fixed flex overflow-hidden rounded-lg border border-slate-200/95 bg-white',
                  'shadow-[0_10px_40px_-10px_rgba(15,23,42,0.18),0_4px_12px_-4px_rgba(15,23,42,0.08)]',
                  'dark:border-slate-600 dark:bg-slate-950'
                )}
                style={panelStyle}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  ref={hourScrollRef}
                  className="max-h-52 w-1/2 overflow-y-auto border-r border-slate-200 py-1.5 dark:border-slate-700 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Hour
                  </p>
                  {HOURS.map((h) => {
                    const selected = h === hour
                    return (
                      <button
                        key={h}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-hour={h}
                        className={cn(
                          'flex w-full items-center justify-center py-2.5 text-sm font-medium tabular-nums transition-colors',
                          selected
                            ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80'
                        )}
                        onClick={() => pickHour(h)}
                      >
                        {h}
                      </button>
                    )
                  })}
                </div>
                <div
                  ref={minuteScrollRef}
                  className="max-h-52 w-1/2 overflow-y-auto py-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Min
                  </p>
                  {MINUTES.map((m) => {
                    const selected = m === minute
                    return (
                      <button
                        key={m}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-minute={m}
                        className={cn(
                          'flex w-full items-center justify-center py-2.5 text-sm font-medium tabular-nums transition-colors',
                          selected
                            ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80'
                        )}
                        onClick={() => pickMinute(m)}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  )
}
