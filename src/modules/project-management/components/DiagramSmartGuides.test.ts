import { act, createElement, useLayoutEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { applyNodeChanges, type Node, type NodeChange, type ReactFlowProps } from 'reactflow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiagramInteractions } from '../lib/diagramInteractionContext'
import { IntegrationArchitectureFlow } from './IntegrationArchitectureFlow'
import type { ArchimateNodeData } from '../lib/integrationArchitectureTypes'

const state = vi.hoisted(() => ({ flow: null as ReactFlowProps | null, nodes: [] as Node[], zoom: 1,
  store: { onError: null, connectionStartHandle: null, cancelConnection: vi.fn() } }))
let interaction: ReturnType<typeof useDiagramInteractions>
function Probe() {
  const value = useDiagramInteractions()
  useLayoutEffect(() => { interaction = value }, [value])
  return null
}
vi.mock('reactflow', async importOriginal => ({
  ...await importOriginal<typeof import('reactflow')>(),
  ReactFlow: (props: ReactFlowProps) => { state.flow = props; return createElement('div', null, createElement(Probe), props.children) },
  Controls: () => null, MiniMap: () => null,
  useStore: (selector: (store: unknown) => unknown) => selector({ transform: [30, 40, state.zoom] }),
  useStoreApi: () => ({ getState: () => state.store, setState: (value: object) => Object.assign(state.store, value) }),
  useReactFlow: () => ({ getNodes: () => state.nodes, setEdges: vi.fn(), screenToFlowPosition: (point: object) => point }),
}))

let host: HTMLDivElement, root: Root
const fixture = (): Node<ArchimateNodeData>[] => [
  { id: 'a', position: { x: 100, y: 200 }, width: 100, height: 80 },
  { id: 'b', position: { x: 100, y: 0 }, width: 120, height: 120 },
].map(node => ({ ...node, type: 'archimateElement', data: { kind: 'element', layer: 'application', notationId: 'task', stereotype: 'task', title: node.id, description: [] } }))
function Harness({ guides = true, arrows = true, points = true, preview = false } = {}) {
  const [nodes, setNodes] = useState(fixture)
  useLayoutEffect(() => { state.nodes = nodes }, [nodes])
  return createElement(IntegrationArchitectureFlow, { nodes, edges: [], showGrid: false, showRuler: false,
    showGuides: guides, showConnectionArrows: arrows, showConnectionPoints: points, preview,
    onNodesChange: changes => setNodes(current => applyNodeChanges(changes, current)),
  })
}
const change = async (changes: NodeChange[]) => act(async () => state.flow!.onNodesChange!(changes))
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); state.zoom = 1
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('canvas smart guide integration', () => {
  it('renders transformed center guides during a drag and clears them on release', async () => {
    await act(async () => root.render(createElement(Harness)))
    await change([{ type: 'position', id: 'a', position: { x: 113, y: 200 }, dragging: true }])
    expect(state.nodes[0].position.x).toBe(110)
    expect(host.querySelector('[data-diagram-guide="alignment"] line')?.getAttribute('x1')).toBe('190')
    await change([{ type: 'position', id: 'a', position: { x: 113, y: 200 }, dragging: false }])
    expect(state.nodes[0].position.x).toBe(110)
    expect(host.querySelector('.diagram-smart-guides')).toBeNull()
  })
  it('shows the matched model-pixel size, then clears on resize end and Escape', async () => {
    state.zoom = 2
    await act(async () => root.render(createElement(Harness)))
    await act(async () => interaction.beginResize('a', { minWidth: 60, minHeight: 40, keepAspectRatio: false }))
    await change([{ type: 'dimensions', id: 'a', dimensions: { width: 118, height: 121 }, resizing: true }])
    expect(host.querySelector('[data-diagram-size]')?.textContent).toBe('120 × 120 px')
    expect(host.querySelectorAll('[data-diagram-guide="dimension"]')).toHaveLength(4)
    await act(async () => interaction.endResize())
    expect(host.querySelector('.diagram-smart-guides')).toBeNull()
    await act(async () => interaction.beginResize('a', { minWidth: 60, minHeight: 40, keepAspectRatio: false }))
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(host.querySelector('.diagram-smart-guides')).toBeNull()
  })
  it('turns alignment snapping off with Guides but retains the resize measurement', async () => {
    await act(async () => root.render(createElement(Harness, { guides: false })))
    await change([{ type: 'position', id: 'a', position: { x: 113, y: 200 }, dragging: true }])
    expect(state.nodes[0].position.x).toBe(113)
    await act(async () => interaction.beginResize('a', { minWidth: 60, minHeight: 40, keepAspectRatio: false }))
    await change([{ type: 'dimensions', id: 'a', dimensions: { width: 118, height: 121 }, resizing: true }])
    expect(host.querySelector('[data-diagram-size]')?.textContent).toBe('118 × 121 px')
    expect(host.querySelector('[data-diagram-guide]')).toBeNull()
  })
  it('allows arrows independently of point visibility and disables both in preview', async () => {
    await act(async () => root.render(createElement(Harness, { arrows: true, points: false })))
    expect(state.flow!.nodesConnectable).toBe(true)
    expect(interaction.showConnectionArrows).toBe(true); expect(interaction.showConnectionPoints).toBe(false)
    await act(async () => root.render(createElement(Harness, { arrows: false, points: false })))
    expect(state.flow!.nodesConnectable).toBe(false)
    await act(async () => root.render(createElement(Harness, { preview: true })))
    expect(state.flow!.nodesConnectable).toBe(false)
    expect(interaction.showConnectionArrows).toBe(false)
  })
})
