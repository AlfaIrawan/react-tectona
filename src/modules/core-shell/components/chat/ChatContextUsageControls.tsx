import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { ContextUsageReport, RuntimeChatUiContext } from '@/lib/api/tectonaAgentRuntimeApi'
import { useChatContextUsage } from '@/modules/core-shell/hooks/useChatContextUsage'

import { ChatContextUsagePanel } from './ChatContextUsagePanel'
import { ChatContextUsageRing } from './ChatContextUsageRing'

const PANEL_WIDTH = 360
const PANEL_FALLBACK_HEIGHT = 320
const VIEWPORT_MARGIN = 12
const ANCHOR_GAP = 8

export interface ChatContextUsageControlsProps {
  workspaceId?: string | null
  userId?: string | null
  sessionId?: string | null
  carryoverFromSessionId?: string | null
  draftMessage?: string
  ui?: RuntimeChatUiContext | null
  lastResponseReport?: ContextUsageReport | null
  enabled?: boolean
  className?: string
}

type PanelPosition = {
  top: number
  left: number
  width: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function computePanelPosition(anchor: DOMRect, panelHeight: number): PanelPosition {
  const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
  const height = Math.max(120, panelHeight)

  let left = anchor.right - width
  left = clamp(left, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)

  const spaceAbove = anchor.top - VIEWPORT_MARGIN - ANCHOR_GAP
  const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_MARGIN - ANCHOR_GAP
  const openAbove = spaceAbove >= height || spaceAbove >= spaceBelow

  let top = openAbove ? anchor.top - ANCHOR_GAP - height : anchor.bottom + ANCHOR_GAP

  if (openAbove && top < VIEWPORT_MARGIN) {
    top = anchor.bottom + ANCHOR_GAP
  } else if (!openAbove && top + height > window.innerHeight - VIEWPORT_MARGIN) {
    top = anchor.top - ANCHOR_GAP - height
  }

  top = clamp(top, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN)

  return { top, left, width }
}

export function ChatContextUsageControls({
  workspaceId,
  userId,
  sessionId,
  carryoverFromSessionId,
  draftMessage = '',
  ui,
  lastResponseReport = null,
  enabled = true,
  className = '',
}: ChatContextUsageControlsProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null)

  const { report, loading } = useChatContextUsage({
    workspaceId,
    userId,
    sessionId,
    carryoverFromSessionId,
    draftMessage,
    ui,
    enabled,
    externalReport: lastResponseReport,
  })

  const updatePanelPosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) return

    const measuredHeight = panelRef.current?.getBoundingClientRect().height ?? PANEL_FALLBACK_HEIGHT
    setPanelPos(computePanelPosition(rect, measuredHeight))
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null)
      return undefined
    }

    updatePanelPosition()
    const raf = window.requestAnimationFrame(updatePanelPosition)

    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, report, updatePanelPosition])

  useLayoutEffect(() => {
    if (!open) return undefined

    const panel = panelRef.current
    if (!panel || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(() => updatePanelPosition())
    observer.observe(panel)
    return () => observer.disconnect()
  }, [open, updatePanelPosition])

  useLayoutEffect(() => {
    if (!enabled) setOpen(false)
  }, [enabled])

  if (!enabled || !report) return null

  return (
    <>
      <div className={`relative inline-flex items-center ${className}`}>
        <button
          ref={anchorRef}
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
          title="Show context usage"
          aria-label="Show context usage"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <ChatContextUsageRing usagePercent={report.usage_percent} level={report.level} size={22} strokeWidth={2.5} />
          {loading ? (
            <span className="pointer-events-none absolute inset-0 animate-pulse rounded-full ring-1 ring-border" />
          ) : null}
        </button>
      </div>

      {open
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[200] cursor-default bg-transparent"
                aria-label="Close context usage"
                onClick={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                className="fixed z-[201]"
                style={{
                  top: panelPos?.top ?? -9999,
                  left: panelPos?.left ?? -9999,
                  width: panelPos?.width ?? PANEL_WIDTH,
                  visibility: panelPos ? 'visible' : 'hidden',
                }}
              >
                <ChatContextUsagePanel report={report} onClose={() => setOpen(false)} />
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
