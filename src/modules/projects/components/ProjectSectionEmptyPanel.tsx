import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { getProjectPanelCatalogEntry, type ProjectPanelKey } from '../lib/projectPanelCatalog'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'

export function ProjectSectionEmptyPanel({ panelKey }: { panelKey: ProjectPanelKey }) {
  const panel = getProjectPanelCatalogEntry(panelKey)
  const PanelIcon = panel.icon
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    const panelEl = panelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [])

  return (
    <div
      ref={panelRef}
      id={`panel-${panelKey}`}
      style={
        panelHeightPx != null
          ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
          : undefined
      }
      className={cn(
        'scroll-mt-24',
        'liquid-glass-enterprise-panel flex min-h-0 flex-col overflow-hidden border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        'rounded-2xl',
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
          <div className="shrink-0 space-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <PanelIcon className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
              <h2 className="text-lg font-semibold text-foreground">Project {panel.label}</h2>
            </div>
            <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">{panel.description}</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted/10 px-6 py-10">
            {panel.illustrationSrc ? (
              <div className="flex w-full max-w-[19.2rem] flex-col items-center gap-4 text-center">
                <img
                  src={panel.illustrationSrc}
                  alt=""
                  className="h-auto w-full object-contain object-center"
                />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">{panel.label}</h3>
                  <p className="text-sm text-muted-foreground">{panel.description}</p>
                </div>
              </div>
            ) : (
              <div className="flex max-w-md flex-col items-center gap-3 text-center">
                <PanelIcon className="h-10 w-10 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">{panel.label}</h3>
                  <p className="text-sm text-muted-foreground">{panel.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
