import { act, createElement, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiagramHistory } from './useDiagramHistory'
import type { DiagramGraph } from './diagramHistory'

const initial = (): DiagramGraph => ({ nodes: [{ id: 'task', position: { x: 0, y: 0 }, style: { width: 100, height: 60 }, data: {} }], edges: [], source: 'Task' })
describe('diagram undo interaction', () => {
  let host: HTMLDivElement, root: Root, graph: DiagramGraph, history: ReturnType<typeof useDiagramHistory<DiagramGraph>>
  let change: (value: DiagramGraph) => void, scope: (value: string) => void
  beforeEach(async () => {
    vi.useFakeTimers()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
    function Harness() {
      const [value, setValue] = useState(initial), [id, setId] = useState('first')
      const ref = useRef<HTMLDivElement>(null)
      graph = value; change = setValue; scope = setId
      history = useDiagramHistory(value, setValue, id, ref)
      return createElement('div', { ref, tabIndex: 0 }, createElement('input', { 'aria-label': 'source' }))
    }
    await act(async () => root.render(createElement(Harness)))
    await act(async () => vi.advanceTimersByTime(300))
  })
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.useRealTimers()
  })
  const move = async (x: number, dragging = false) => act(async () => change({ ...graph, nodes: [{ ...graph.nodes[0], position: { x, y: 0 }, dragging }] }))
  it('groups a continuous drag into one undo and supports redo', async () => {
    await move(10, true); await act(async () => vi.advanceTimersByTime(500))
    await move(30, true); await act(async () => vi.advanceTimersByTime(500))
    await move(50); await act(async () => vi.advanceTimersByTime(300))
    await act(async () => history.undo())
    expect(graph.nodes[0].position.x).toBe(0)
    expect(history.canUndo).toBe(false)
    await act(async () => history.redo())
    expect(graph.nodes[0].position.x).toBe(50)
  })
  it('handles pending edits immediately and leaves text editor undo alone', async () => {
    await move(20)
    await act(async () => host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })))
    expect(graph.nodes[0].position.x).toBe(20)
    await act(async () => host.firstElementChild!.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })))
    expect(graph.nodes[0].position.x).toBe(0)
    await act(async () => host.firstElementChild!.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true })))
    expect(graph.nodes[0].position.x).toBe(20)
  })
  it('does not undo into another diagram while its saved graph hydrates', async () => {
    await move(30); await act(async () => vi.advanceTimersByTime(300))
    await act(async () => scope('second'))
    await move(200); await act(async () => vi.advanceTimersByTime(300))
    expect(history.canUndo).toBe(false)
    await act(async () => history.undo())
    expect(graph.nodes[0].position.x).toBe(200)
  })
})
