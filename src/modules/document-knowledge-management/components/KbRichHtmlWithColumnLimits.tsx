import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  buildKbTableColumnVisibilityCss,
  clampKbVisibleColumnIndexes,
  defaultKbVisibleColumnIndexes,
  getKbTableColumnCount,
  KB_TABLE_MAX_VISIBLE_COLUMNS,
  readKbTableColumnLabels,
  stampKbTableIndexesInHtml,
  toggleKbVisibleColumnIndex,
  type KbTableDensityMode,
} from '@/lib/kb/kbTableColumnVisibility'

type TableColumnState = {
  labels: string[]
  columnCount: number
  visible: number[]
}

type KbRichHtmlWithColumnLimitsProps = {
  /** Already-sanitized HTML. Prefer memoizing by raw entry content at the call site. */
  html: string
  densityMode: KbTableDensityMode
  className?: string
  proseClassName: string
  wrapperClassName?: string
}

function tableStateKey(index: number): string {
  return `table-${index}`
}

/**
 * Renders sanitized KB HTML and, for each embedded table that exceeds the density
 * column cap, hides overflow columns via CSS stamped into the HTML string itself
 * (survives React dangerouslySetInnerHTML refreshes).
 * Maximize → max 5 columns; Minimize → max 2 columns.
 */
export function KbRichHtmlWithColumnLimits({
  html,
  densityMode,
  className,
  proseClassName,
  wrapperClassName,
}: KbRichHtmlWithColumnLimitsProps): ReactNode {
  const reactId = useId().replace(/:/g, '')
  const scopeId = `kb-col-scope-${reactId}`
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)
  const [tableStates, setTableStates] = useState<Record<string, TableColumnState>>({})
  const maxVisible = KB_TABLE_MAX_VISIBLE_COLUMNS[densityMode]

  // Bake data-kb-table-index into the HTML string so every React innerHTML write
  // still carries the hooks our <style> selectors need.
  const stampedHtml = useMemo(() => stampKbTableIndexesInHtml(html), [html])

  const tablesMeta = useMemo(() => {
    if (typeof document === 'undefined' || !stampedHtml) {
      return [] as Array<{ key: string; index: number; labels: string[]; columnCount: number }>
    }
    const root = document.createElement('div')
    root.innerHTML = stampedHtml
    return Array.from(root.querySelectorAll('table')).map((table, index) => {
      const el = table as HTMLTableElement
      const labels = readKbTableColumnLabels(el)
      return {
        key: tableStateKey(index),
        index,
        labels,
        columnCount: Math.max(labels.length, getKbTableColumnCount(el)),
      }
    })
  }, [stampedHtml])

  useEffect(() => {
    setTableStates((prev) => {
      let changed = false
      const next: Record<string, TableColumnState> = {}
      for (const meta of tablesMeta) {
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
      return changed ? next : prev
    })
  }, [tablesMeta, densityMode])

  useEffect(() => {
    setPickerOpenFor(null)
  }, [densityMode, stampedHtml])

  const visibilityCss = useMemo(() => {
    return tablesMeta
      .map((meta) => {
        const state = tableStates[meta.key]
        if (!state || state.columnCount <= maxVisible) return ''
        const selector = `#${scopeId} table[data-kb-table-index="${meta.index}"]`
        return buildKbTableColumnVisibilityCss(selector, state.columnCount, state.visible)
      })
      .filter(Boolean)
      .join('\n')
  }, [tablesMeta, tableStates, maxVisible, scopeId])

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

  const tablesNeedingPicker = tablesMeta.filter((meta) => meta.columnCount > maxVisible)

  return (
    <div className={cn(wrapperClassName, 'space-y-2')} id={scopeId}>
      {visibilityCss ? (
        <style data-kb-col-visibility="true">{visibilityCss}</style>
      ) : null}

      {tablesNeedingPicker.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
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
                  <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg">
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
                                    return {
                                      ...prev,
                                      [meta.key]: {
                                        ...current,
                                        visible: toggleKbVisibleColumnIndex(
                                          current.visible,
                                          columnIndex,
                                          meta.columnCount,
                                          densityMode,
                                        ),
                                      },
                                    }
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

      <div
        className={cn('kb-rich-html-root', className, proseClassName)}
        dangerouslySetInnerHTML={{ __html: stampedHtml }}
      />
    </div>
  )
}
