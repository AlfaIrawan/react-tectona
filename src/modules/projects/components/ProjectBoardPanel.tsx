import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Kanban, Maximize2, Minimize2 } from 'lucide-react'
import type { WorkItemApiModel, WorkStatus } from '@/lib/api/workApi'
import { patchWorkItem } from '@/lib/api/workApi'
import {
  DirectoryKanbanView,
  type DirectoryKanbanItem,
} from '@/modules/task-work-management/components/DirectoryKanbanView'
import { cn } from '@/lib/utils'
import { mapWorkItemToKanban } from '../lib/mapWorkItemToKanban'
import type { ProjectTemplate } from '../data/projectTemplates'
import type { Project } from '../store/projectStore'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'

const boardToolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

export function ProjectBoardPanel({
  project: _project,
  template: _template,
  ownerName: _ownerName,
  workItems,
  usesApiItems,
  onWorkItemsChange,
}: {
  project: Project
  template?: ProjectTemplate
  ownerName: string
  workItems: WorkItemApiModel[]
  usesApiItems: boolean
  onWorkItemsChange?: () => void | Promise<void>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const boardItems = useMemo<DirectoryKanbanItem[]>(
    () => workItems.map(mapWorkItemToKanban),
    [workItems],
  )
  const [localItems, setLocalItems] = useState<DirectoryKanbanItem[]>(boardItems)

  useEffect(() => {
    setLocalItems(boardItems)
  }, [boardItems])

  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreen])

  useLayoutEffect(() => {
    if (isFullscreen) {
      setPanelHeightPx(null)
      return
    }

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
  }, [isFullscreen])

  const handleStatusChange = useCallback(
    async (itemId: string, status: WorkStatus) => {
      setLocalItems((previous) =>
        previous.map((item) => (item.id === itemId ? { ...item, status } : item)),
      )
      if (!usesApiItems) return
      try {
        await patchWorkItem(itemId, { status })
        await onWorkItemsChange?.()
      } catch {
        setLocalItems(boardItems)
      }
    },
    [boardItems, onWorkItemsChange, usesApiItems],
  )

  const handleTitleChange = useCallback(
    async (itemId: string, title: string) => {
      setLocalItems((previous) =>
        previous.map((item) => (item.id === itemId ? { ...item, title } : item)),
      )
      if (!usesApiItems) return
      try {
        await patchWorkItem(itemId, { title })
        await onWorkItemsChange?.()
      } catch {
        setLocalItems(boardItems)
      }
    },
    [boardItems, onWorkItemsChange, usesApiItems],
  )

  const panel = (
    <div
      ref={panelRef}
      id="panel-board"
      style={
        isFullscreen
          ? { height: 'calc(100dvh - 3rem)', maxHeight: 'calc(100dvh - 3rem)' }
          : panelHeightPx != null
            ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
            : undefined
      }
      className={cn(
        'scroll-mt-24',
        'glass-card flex min-h-0 flex-col overflow-hidden border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        isFullscreen
          ? 'fixed inset-x-0 top-12 bottom-0 z-50 rounded-none border-0 bg-background'
          : 'rounded-2xl',
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
            isFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
          )}
        >
          <div className="shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Kanban className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                <h2 className="text-lg font-semibold text-foreground">Project Board</h2>
              </div>
              <button
                type="button"
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Exit board fullscreen' : 'Expand board to fullscreen'}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (header stays visible)'}
                onClick={() => setIsFullscreen((prev) => !prev)}
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                  boardToolbarFocusClass,
                  isFullscreen && 'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                )}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                Kanban execution board — columns match workflow status. Drag cards between columns to update status.
              </p>
              <p className="shrink-0 text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{localItems.length}</span> work items
              </p>
            </div>
          </div>

          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-muted/10">
            <DirectoryKanbanView
              items={localItems}
              hideProjectChrome
              onItemClick={() => undefined}
              onStatusChange={handleStatusChange}
              onTitleChange={handleTitleChange}
            />
          </div>
        </div>
      </div>
    </div>
  )

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="min-h-[50vh]" aria-hidden />
        {createPortal(panel, document.body)}
      </>
    )
  }

  return panel
}
