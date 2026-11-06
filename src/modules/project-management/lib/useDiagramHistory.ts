import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { diagramGraphKey, recordDiagramEdit, redoDiagramEdit, undoDiagramEdit, type DiagramGraph, type DiagramHistory } from './diagramHistory'

export function useDiagramHistory<T extends DiagramGraph>(graph: T, restore: (graph: T) => void,
  scope: string, root: RefObject<HTMLElement | null>, enabled = true) {
  const timeline = useRef<DiagramHistory<T>>({ past: [], present: graph, future: [] })
  const latest = useRef(graph)
  const restoreRef = useRef(restore)
  const scopeRef = useRef(scope)
  const resetPending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [, refresh] = useState(0)
  latest.current = graph
  restoreRef.current = restore
  const key = diagramGraphKey(graph)
  if (scopeRef.current !== scope) {
    scopeRef.current = scope
    timeline.current = { past: [], present: graph, future: [] }
    resetPending.current = true
  }
  const busy = graph.nodes.some(node => node.dragging || (node as NodeWithResize).resizing)
  const cancelTimer = () => { if (timer.current !== undefined) clearTimeout(timer.current); timer.current = undefined }
  const travel = useCallback((direction: 'undo' | 'redo') => {
    cancelTimer()
    if (resetPending.current) {
      timeline.current = { past: [], present: latest.current, future: [] }
      resetPending.current = false
      refresh(value => value + 1)
      return
    }
    const current = recordDiagramEdit(timeline.current, latest.current)
    const next = direction === 'undo' ? undoDiagramEdit(current) : redoDiagramEdit(current)
    timeline.current = next
    if (next !== current) {
      latest.current = next.present
      restoreRef.current(next.present)
    }
    refresh(value => value + 1)
  }, [])
  const undo = useCallback(() => travel('undo'), [travel])
  const redo = useCallback(() => travel('redo'), [travel])

  useEffect(() => {
    cancelTimer()
    if (!enabled || busy) return
    timer.current = setTimeout(() => {
      timeline.current = resetPending.current ? { past: [], present: latest.current, future: [] }
        : recordDiagramEdit(timeline.current, latest.current)
      resetPending.current = false
      refresh(value => value + 1)
    }, 250)
    return cancelTimer
  }, [busy, enabled, key, scope])

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey) return
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (target && target !== document.body && !root.current?.contains(target)) return
      const command = event.key.toLowerCase()
      if (command !== 'z' && command !== 'y') return
      event.preventDefault()
      if (command === 'y' || event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, redo, root, undo])

  return { undo, redo,
    canUndo: !resetPending.current && (timeline.current.past.length > 0 || diagramGraphKey(timeline.current.present) !== key),
    canRedo: !resetPending.current && timeline.current.future.length > 0 && diagramGraphKey(timeline.current.present) === key }
}

type NodeWithResize = { resizing?: boolean }
