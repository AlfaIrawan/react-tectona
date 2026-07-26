import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Kanban } from 'lucide-react'
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

  const boardItems = useMemo<DirectoryKanbanItem[]>(
    () => workItems.map(mapWorkItemToKanban),
    [workItems],
  )
  const [localItems, setLocalItems] = useState<DirectoryKanbanItem[]>(boardItems)

  useEffect(() => {
    setLocalItems(boardItems)
  }, [boardItems])

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

  return (
    <div
      ref={panelRef}
      id="panel-board"
      style={
        panelHeightPx != null
          ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
          : undefined
      }
      className={cn(
        'scroll-mt-24',
        'glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
          <div className="shrink-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Kanban className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                  <h2 className="text-lg font-semibold text-foreground">Project Board</h2>
                </div>
                <p className="mt-0.5 max-w-2xl text-[11px] text-muted-foreground">
                  Kanban execution board — columns match workflow status. Drag cards between columns to update status.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
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
}
