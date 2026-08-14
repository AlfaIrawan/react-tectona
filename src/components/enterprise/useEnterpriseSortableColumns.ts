import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

/** Generic column chrome (drag-reorder, drag-resize, freeze-first-column, right-click column menu) for
 * enterprise data tables — ported from the Workspace Directory table so any table can adopt the same
 * interactive design without duplicating ~300 lines of dnd/resize plumbing per page. */

const DEFAULT_MIN_WIDTH_PX = 80
const DEFAULT_MAX_WIDTH_PX = 520

export interface EnterpriseHeaderContextMenuState<K extends string> {
  x: number
  y: number
  columnKey: K
}

export interface EnterpriseColumnWidthDialogState<K extends string> {
  open: boolean
  columnKey: K
  valuePx: string
}

export interface UseEnterpriseSortableColumnsOptions<K extends string> {
  initialOrder: K[]
  /** Always first, not draggable, not hideable (e.g. the primary "name" column). */
  pinnedFirstKey: K
  /** Columns hidden by default (e.g. so the table fits without horizontal scroll) — the user can
   * always re-show them via the column visibility control. */
  initialHiddenColumns?: K[]
  /** Hard cap on how many columns may be visible at once (pinned column included). Past this count,
   * the visibility control disables the remaining "show" options — a fixed, deterministic limit
   * instead of trying to predict real browser layout (fragile: container/table resize timing,
   * animations, and sub-pixel rounding all make live overflow detection unreliable). */
  maxVisibleColumns?: number
  minWidthPx?: number
  maxWidthPx?: number
  /** Whether a leading selection-checkbox <th>/<td> precedes the data columns (excluded when
   * measuring/snapshotting column widths from the live table). */
  hasSelectionColumn: boolean
  /** Called when a column transitions from visible to hidden (e.g. so the page can clear a
   * "group by"/"sort by" that referenced it). Not called when a column is re-shown. */
  onColumnHidden?: (key: K) => void
}

export function useEnterpriseSortableColumns<K extends string>({
  initialOrder,
  pinnedFirstKey,
  initialHiddenColumns,
  maxVisibleColumns,
  minWidthPx = DEFAULT_MIN_WIDTH_PX,
  maxWidthPx = DEFAULT_MAX_WIDTH_PX,
  hasSelectionColumn,
  onColumnHidden,
}: UseEnterpriseSortableColumnsOptions<K>) {
  const tableRef = useRef<HTMLTableElement | null>(null)
  const resizeRef = useRef<{ columnKey: K; startX: number; startWidth: number } | null>(null)

  const [columnOrder, setColumnOrder] = useState<K[]>(() => [...initialOrder])
  const [hiddenColumns, setHiddenColumns] = useState<Set<K>>(() => new Set(initialHiddenColumns ?? []))
  const [columnWidthsPx, setColumnWidthsPx] = useState<Partial<Record<K, number>>>({})
  const [resizingKey, setResizingKey] = useState<K | null>(null)
  const [freezeFirstColumn, setFreezeFirstColumn] = useState(false)
  const [headerContextMenu, setHeaderContextMenu] = useState<EnterpriseHeaderContextMenuState<K> | null>(null)
  const [columnWidthDialog, setColumnWidthDialog] = useState<EnterpriseColumnWidthDialogState<K> | null>(null)

  const visibleColumnOrder = useMemo(
    () => columnOrder.filter((key) => !hiddenColumns.has(key)),
    [columnOrder, hiddenColumns],
  )

  const toggleColumnVisibility = useCallback(
    (key: K) => {
      const isHidden = hiddenColumns.has(key)
      if (!isHidden) {
        const visibleCount = columnOrder.filter((col) => !hiddenColumns.has(col)).length
        if (visibleCount <= 1) return
        onColumnHidden?.(key)
      }
      setHiddenColumns((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    [columnOrder, hiddenColumns, onColumnHidden],
  )

  const showAllColumns = useCallback(() => setHiddenColumns(new Set()), [])

  /** Whether re-showing this currently-hidden column would exceed `maxVisibleColumns`. Always true
   * for already-visible columns (hiding is handled by the separate "last visible column" guard) and
   * when no cap is configured. */
  const canShowColumn = useCallback(
    (key: K): boolean => {
      if (!hiddenColumns.has(key)) return true
      if (maxVisibleColumns == null) return true
      return visibleColumnOrder.length < maxVisibleColumns
    },
    [hiddenColumns, visibleColumnOrder, maxVisibleColumns],
  )

  const clampWidthPx = useCallback(
    (px: number) => Math.max(minWidthPx, Math.min(maxWidthPx, Math.round(px))),
    [minWidthPx, maxWidthPx],
  )

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return
      if (active.id === over.id) return
      if (active.id === pinnedFirstKey) return
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as K)
        let newIndex = prev.indexOf(over.id as K)
        if (oldIndex < 0 || newIndex < 0) return prev
        if (newIndex === 0) newIndex = 1
        const next = arrayMove(prev, oldIndex, newIndex)
        if (next[0] === pinnedFirstKey) return next
        const rest = next.filter((key) => key !== pinnedFirstKey)
        return [pinnedFirstKey, ...rest]
      })
    },
    [pinnedFirstKey],
  )

  const isPinnedColumn = useCallback((key: K) => key === pinnedFirstKey, [pinnedFirstKey])
  const isFirstColumn = useCallback((key: K) => visibleColumnOrder[0] === key, [visibleColumnOrder])
  const isSecondColumn = useCallback((key: K) => visibleColumnOrder[1] === key, [visibleColumnOrder])
  const isThirdColumnOrLater = useCallback(
    (key: K) => visibleColumnOrder.indexOf(key) >= 2,
    [visibleColumnOrder],
  )
  const isLastColumn = useCallback(
    (key: K) => visibleColumnOrder[visibleColumnOrder.length - 1] === key,
    [visibleColumnOrder],
  )
  const getColumnIndex = useCallback((key: K) => columnOrder.indexOf(key), [columnOrder])

  const moveColumnToFirst = useCallback(
    (key: K) => {
      setColumnOrder((prev) => {
        const index = prev.indexOf(key)
        if (index <= 1) return prev
        const next = [...prev]
        const [item] = next.splice(index, 1)
        next.splice(1, 0, item)
        if (next[0] === pinnedFirstKey) return next
        const rest = next.filter((col) => col !== pinnedFirstKey)
        return [pinnedFirstKey, ...rest]
      })
    },
    [pinnedFirstKey],
  )
  const moveColumnLeft = useCallback((key: K) => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(key)
      if (index <= 1) return prev
      return arrayMove(prev, index, index - 1)
    })
  }, [])
  const moveColumnRight = useCallback((key: K) => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(key)
      if (index < 0 || index >= prev.length - 1) return prev
      return arrayMove(prev, index, index + 1)
    })
  }, [])
  const moveColumnToLast = useCallback((key: K) => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(key)
      if (index < 0 || index >= prev.length - 1) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.push(item)
      return next
    })
  }, [])

  const columnWidthStyle = useCallback(
    (key: K): React.CSSProperties | undefined => {
      const px = columnWidthsPx[key]
      if (!px || px <= 0) return undefined
      const hasCustomWidths = Object.values(columnWidthsPx).some(
        (value) => typeof value === 'number' && value > 0,
      )
      const isLastVisible = visibleColumnOrder[visibleColumnOrder.length - 1] === key
      if (hasCustomWidths && isLastVisible) {
        return { minWidth: px, width: 'auto' }
      }
      return { width: px, minWidth: px, maxWidth: px }
    },
    [columnWidthsPx, visibleColumnOrder],
  )

  const hasAnyCustomWidth = useMemo(
    () => Object.values(columnWidthsPx).some((px) => typeof px === 'number' && px > 0),
    [columnWidthsPx],
  )

  const snapshotColumnWidthsFromTable = useCallback(
    (tableEl?: HTMLTableElement | null): Partial<Record<K, number>> => {
      const table = tableEl ?? tableRef.current
      if (!table) return {}
      const headerRow = table.querySelector('thead tr')
      if (!headerRow) return {}
      const ths = Array.from(headerRow.querySelectorAll('th'))
      const dataThs = hasSelectionColumn ? ths.slice(1) : ths
      const snapshot: Partial<Record<K, number>> = {}
      visibleColumnOrder.forEach((key, index) => {
        const th = dataThs[index]
        if (th) snapshot[key] = clampWidthPx(Math.round(th.getBoundingClientRect().width))
      })
      return snapshot
    },
    [visibleColumnOrder, hasSelectionColumn, clampWidthPx],
  )

  const setColumnWidthsWithSnapshot = useCallback(
    (
      updater: (prev: Partial<Record<K, number>>) => Partial<Record<K, number>>,
      tableEl?: HTMLTableElement | null,
    ) => {
      setColumnWidthsPx((prev) => {
        const base = Object.keys(prev).length > 0 ? prev : snapshotColumnWidthsFromTable(tableEl)
        return updater(base)
      })
    },
    [snapshotColumnWidthsFromTable],
  )

  const measureColumnContentWidthPx = useCallback(
    (key: K, tableEl: HTMLTableElement): number => {
      const headerRow = tableEl.querySelector('thead tr')
      if (!headerRow) return minWidthPx
      const ths = Array.from(headerRow.querySelectorAll('th'))
      const dataThs = hasSelectionColumn ? ths.slice(1) : ths
      const colIndex = visibleColumnOrder.indexOf(key)
      if (colIndex < 0) return minWidthPx

      let maxWidth = 0
      const th = dataThs[colIndex] as HTMLElement | undefined
      if (th) maxWidth = Math.max(maxWidth, th.scrollWidth)

      tableEl.querySelectorAll('tbody tr').forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td'))
        const dataCells = hasSelectionColumn ? cells.slice(1) : cells
        if (dataCells.length === 1 && (dataCells[0]?.colSpan ?? 1) > 1) return
        const td = dataCells[colIndex] as HTMLElement | undefined
        if (td) maxWidth = Math.max(maxWidth, td.scrollWidth)
      })

      return clampWidthPx(maxWidth + 16)
    },
    [visibleColumnOrder, hasSelectionColumn, minWidthPx, clampWidthPx],
  )

  const autoResizeColumn = useCallback(
    (key: K) => {
      const table = tableRef.current
      if (!table) return
      const width = measureColumnContentWidthPx(key, table)
      setColumnWidthsWithSnapshot((prev) => ({ ...prev, [key]: width }), table)
    },
    [measureColumnContentWidthPx, setColumnWidthsWithSnapshot],
  )

  const resetAllColumnWidths = useCallback(() => setColumnWidthsPx({}), [])

  const beginColumnResize = useCallback(
    (columnKey: K, startX: number, thElement: HTMLTableCellElement) => {
      const table = thElement.closest('table')
      const measuredWidth = Math.round(thElement.getBoundingClientRect().width)
      let startWidth = columnWidthsPx[columnKey] ?? measuredWidth

      if (Object.keys(columnWidthsPx).length === 0) {
        const snapshot = snapshotColumnWidthsFromTable(table)
        setColumnWidthsPx(snapshot)
        startWidth = snapshot[columnKey] ?? measuredWidth
      }

      resizeRef.current = { columnKey, startX, startWidth }
      setResizingKey(columnKey)
    },
    [columnWidthsPx, snapshotColumnWidthsFromTable],
  )

  useEffect(() => {
    if (!resizingKey) return
    const onMove = (event: MouseEvent) => {
      const active = resizeRef.current
      if (!active) return
      const next = clampWidthPx(active.startWidth + (event.clientX - active.startX))
      setColumnWidthsPx((prev) => ({ ...prev, [active.columnKey]: next }))
    }
    const onUp = () => {
      resizeRef.current = null
      setResizingKey(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingKey, clampWidthPx])

  const frozenColumnHeaderClass = freezeFirstColumn
    ? 'sticky left-0 z-20 bg-slate-50/95 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.12)] dark:bg-slate-800/55 dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]'
    : ''
  const frozenColumnBodyClass = freezeFirstColumn
    ? 'sticky left-0 z-10 bg-slate-50/70 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] dark:bg-slate-800/35 dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.35)]'
    : ''
  const firstColumnTintHeaderClass = 'bg-slate-50/95 dark:bg-slate-800/55'
  const firstColumnTintBodyClass = 'bg-slate-50/70 dark:bg-slate-800/35'

  return {
    tableRef,
    columnOrder,
    visibleColumnOrder,
    hiddenColumns,
    toggleColumnVisibility,
    showAllColumns,
    canShowColumn,
    dndSensors,
    handleColumnDragEnd,
    setColumnWidthsWithSnapshot,
    isPinnedColumn,
    isFirstColumn,
    isSecondColumn,
    isThirdColumnOrLater,
    isLastColumn,
    getColumnIndex,
    moveColumnToFirst,
    moveColumnLeft,
    moveColumnRight,
    moveColumnToLast,
    columnWidthStyle,
    hasAnyCustomWidth,
    autoResizeColumn,
    resetAllColumnWidths,
    beginColumnResize,
    resizingKey,
    freezeFirstColumn,
    setFreezeFirstColumn,
    frozenColumnHeaderClass,
    frozenColumnBodyClass,
    firstColumnTintHeaderClass,
    firstColumnTintBodyClass,
    headerContextMenu,
    setHeaderContextMenu,
    columnWidthDialog,
    setColumnWidthDialog,
  }
}

export type UseEnterpriseSortableColumnsResult<K extends string> = ReturnType<
  typeof useEnterpriseSortableColumns<K>
>
