import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  applyKbTableColumnVisibility,
  buildKbTableColumnVisibilityCss,
  clampKbVisibleColumnIndexes,
  defaultKbVisibleColumnIndexes,
  getKbTableColumnCount,
  KB_TABLE_MAX_VISIBLE_COLUMNS,
  readKbTableColumnLabels,
  toggleKbVisibleColumnIndex,
  type KbTableDensityMode,
} from '@/lib/kb/kbTableColumnVisibility'

type TableColumnState = {
  labels: string[]
  columnCount: number
  visible: number[]
}

type TableMeta = {
  key: string
  index: number
  labels: string[]
  columnCount: number
}

type KbEditorTableColumnLimitsProps = {
  editorRef: RefObject<HTMLElement | null>
  densityMode: KbTableDensityMode
  active: boolean
  /** Bump when editor HTML is replaced from outside (open/seed). */
  revision?: string | number
}

function tableStateKey(index: number): string {
  return `table-${index}`
}

function metaSignature(meta: TableMeta[]): string {
  return meta
    .map((item) => `${item.index}:${item.columnCount}:${item.labels.join('\u001f')}`)
    .join('|')
}

function scanEditorTables(editor: HTMLElement): TableMeta[] {
  const tables = Array.from(editor.querySelectorAll('table')) as HTMLTableElement[]
  return tables.map((table, index) => {
    table.setAttribute('data-kb-table-index', String(index))
    table.classList.add('kb-table-column-limited')
    if (table.hasAttribute('width')) table.removeAttribute('width')
    if (table.style.width) table.style.removeProperty('width')
    const labels = readKbTableColumnLabels(table)
    return {
      key: tableStateKey(index),
      index,
      labels,
      columnCount: Math.max(labels.length, getKbTableColumnCount(table)),
    }
  })
}

/**
 * Column cap + picker for the KB contentEditable editor.
 * Minimize → max 2; Maximize (full window) → max 5.
 * Hidden columns remain in DOM so save keeps full table data.
 */
export function KbEditorTableColumnLimits({
  editorRef,
  densityMode,
  active,
  revision = 0,
}: KbEditorTableColumnLimitsProps) {
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)
  const [tableStates, setTableStates] = useState<Record<string, TableColumnState>>({})
  const [tablesMeta, setTablesMeta] = useState<TableMeta[]>([])
  const metaSigRef = useRef('')
  const suppressObserverRef = useRef(false)
  const maxVisible = KB_TABLE_MAX_VISIBLE_COLUMNS[densityMode]

  const applyVisibilityToDom = (
    editor: HTMLElement,
    meta: TableMeta[],
    states: Record<string, TableColumnState>,
  ) => {
    suppressObserverRef.current = true
    try {
      for (const item of meta) {
        const table = editor.querySelector(
          `table[data-kb-table-index="${item.index}"]`,
        ) as HTMLTableElement | null
        if (!table) continue
        const state = states[item.key]
        if (!state) continue
        if (state.columnCount <= maxVisible) {
          applyKbTableColumnVisibility(
            table,
            Array.from({ length: state.columnCount }, (_, i) => i),
          )
        } else {
          applyKbTableColumnVisibility(table, state.visible)
        }
      }
    } finally {
      window.setTimeout(() => {
        suppressObserverRef.current = false
      }, 0)
    }
  }

  const refreshTables = () => {
    const editor = editorRef.current
    if (!editor) return false

    const nextMeta = scanEditorTables(editor)
    const signature = metaSignature(nextMeta)
    if (signature !== metaSigRef.current) {
      metaSigRef.current = signature
      setTablesMeta(nextMeta)
    }

    setTableStates((prev) => {
      let changed = false
      const next: Record<string, TableColumnState> = {}
      for (const meta of nextMeta) {
        const existing = prev[meta.key]
        const visible = existing
          ? clampKbVisibleColumnIndexes(existing.visible, meta.columnCount, densityMode)
          : defaultKbVisibleColumnIndexes(meta.columnCount, densityMode)
        const rowChanged = !existing
          || existing.columnCount !== meta.columnCount
          || existing.labels.join('\0') !== meta.labels.join('\0')
          || existing.visible.join(',') !== visible.join(',')
        if (rowChanged) changed = true
        next[meta.key] = {
          labels: meta.labels,
          columnCount: meta.columnCount,
          visible,
        }
      }
      if (Object.keys(prev).length !== Object.keys(next).length) changed = true
      const resolved = changed ? next : prev
      // Apply immediately so columns hide even before React re-renders CSS.
      applyVisibilityToDom(editor, nextMeta, resolved)
      return resolved
    })

    return nextMeta.length > 0
  }

  useLayoutEffect(() => {
    if (!active) {
      setTablesMeta([])
      setTableStates({})
      setPickerOpenFor(null)
      metaSigRef.current = ''
      return
    }

    let cancelled = false
    let debounceTimer: number | null = null
    let retryTimers: number[] = []
    let observer: MutationObserver | null = null

    const scheduleRefresh = () => {
      if (cancelled || suppressObserverRef.current) return
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        if (!cancelled && !suppressObserverRef.current) refreshTables()
      }, 30)
    }

    const attachObserver = (editor: HTMLElement) => {
      if (observer) observer.disconnect()
      observer = new MutationObserver(scheduleRefresh)
      observer.observe(editor, { childList: true, subtree: true, characterData: true })
      editor.addEventListener('input', scheduleRefresh)
    }

    const boot = () => {
      const editor = editorRef.current
      if (!editor) return false
      attachObserver(editor)
      refreshTables()
      return true
    }

    // Seed HTML is applied in a sibling effect — retry until the editor exists and has tables.
    if (!boot()) {
      retryTimers.push(window.setTimeout(() => { if (!cancelled) boot() }, 0))
      retryTimers.push(window.setTimeout(() => { if (!cancelled) boot() }, 50))
      retryTimers.push(window.setTimeout(() => { if (!cancelled) boot() }, 150))
      retryTimers.push(window.setTimeout(() => { if (!cancelled) boot() }, 400))
    } else {
      // Re-scan after parent seed effect likely replaced innerHTML.
      retryTimers.push(window.setTimeout(() => { if (!cancelled) refreshTables() }, 0))
      retryTimers.push(window.setTimeout(() => { if (!cancelled) refreshTables() }, 80))
      retryTimers.push(window.setTimeout(() => { if (!cancelled) refreshTables() }, 250))
    }

    return () => {
      cancelled = true
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      retryTimers.forEach((id) => window.clearTimeout(id))
      const editor = editorRef.current
      if (editor) editor.removeEventListener('input', scheduleRefresh)
      observer?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, densityMode, revision])

  // Re-apply DOM visibility whenever selection/density changes.
  useLayoutEffect(() => {
    if (!active) return
    const editor = editorRef.current
    if (!editor || tablesMeta.length === 0) return
    applyVisibilityToDom(editor, tablesMeta, tableStates)
  }, [active, tablesMeta, tableStates, densityMode, maxVisible, editorRef])

  useEffect(() => {
    setPickerOpenFor(null)
  }, [densityMode, revision])

  useEffect(() => {
    if (pickerOpenFor === null) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest?.('[data-kb-col-picker]')) return
      setPickerOpenFor(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [pickerOpenFor])

  // CSS backup using stable #kb-content id (survives attribute races).
  const visibilityCss = useMemo(() => {
    if (!active) return ''
    return tablesMeta
      .map((meta) => {
        const state = tableStates[meta.key]
        if (!state || state.columnCount <= maxVisible) return ''
        const selector = `#kb-content table[data-kb-table-index="${meta.index}"]`
        return buildKbTableColumnVisibilityCss(selector, state.columnCount, state.visible)
      })
      .filter(Boolean)
      .join('\n')
  }, [active, tablesMeta, tableStates, maxVisible])

  const tablesNeedingPicker = tablesMeta.filter((meta) => meta.columnCount > maxVisible)
  if (!active) return null
  if (tablesNeedingPicker.length === 0 && !visibilityCss) return null

  return (
    <>
      {visibilityCss ? <style data-kb-col-visibility="edit">{visibilityCss}</style> : null}
      {tablesNeedingPicker.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
          {tablesNeedingPicker.map((meta, pickerIndex) => {
            const state = tableStates[meta.key]
            const visibleCount = state?.visible.length ?? Math.min(meta.columnCount, maxVisible)
            const open = pickerOpenFor === pickerIndex
            return (
              <div key={meta.key} className="relative" data-kb-col-picker>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-[11px]"
                  onClick={() => setPickerOpenFor(open ? null : pickerIndex)}
                  aria-expanded={open}
                  title={`Choose which columns to show (max ${maxVisible})`}
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns {visibleCount}/{meta.columnCount}
                  <span className="text-muted-foreground">· max {maxVisible}</span>
                </Button>
                {open && state ? (
                  <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg">
                    <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Show columns ({densityMode === 'maximize' ? 'Maximize' : 'Minimize'})
                    </p>
                    <ul className="max-h-52 space-y-0.5 overflow-y-auto">
                      {state.labels.map((label, columnIndex) => {
                        const checked = state.visible.includes(columnIndex)
                        const atMax = state.visible.length >= maxVisible && !checked
                        return (
                          <li key={`${meta.key}-${columnIndex}`}>
                            <label
                              className={cn(
                                'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-muted/60',
                                atMax && 'cursor-not-allowed opacity-50',
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-sky-600"
                                checked={checked}
                                disabled={atMax}
                                onChange={() => {
                                  setTableStates((prev) => {
                                    const current = prev[meta.key]
                                    if (!current) return prev
                                    const nextVisible = toggleKbVisibleColumnIndex(
                                      current.visible,
                                      columnIndex,
                                      meta.columnCount,
                                      densityMode,
                                    )
                                    const next = {
                                      ...prev,
                                      [meta.key]: { ...current, visible: nextVisible },
                                    }
                                    const editor = editorRef.current
                                    if (editor) applyVisibilityToDom(editor, tablesMeta, next)
                                    return next
                                  })
                                }}
                              />
                              <span className="truncate">{label}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                    <p className="mt-1.5 border-t border-border/60 px-1 pt-1.5 text-[10px] text-muted-foreground">
                      {densityMode === 'maximize' ? 'Maximize' : 'Minimize'} mode: max {maxVisible} columns.
                    </p>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
