import { createElement, type CSSProperties, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeProps } from 'reactflow'
import { ArchimateElementNode, BpmnElementNode } from './integrationArchimateNodeTypes'
import type { ArchimateElementNodeData } from '../lib/integrationArchitectureTypes'
import { DiagramInteractionContext } from '../lib/diagramInteractionContext'
import { connectionHandlePercentsForLength } from '../lib/parsePlantUmlToIntegrationGraph'

const state = vi.hoisted(() => ({ zoom: 1, nodesConnectable: true }))
vi.mock('reactflow', async importOriginal => {
  const original = await importOriginal<typeof import('reactflow')>()
  return {
    ...original,
    useNodeId: () => 'node-1',
    useUpdateNodeInternals: () => () => {},
    useReactFlow: () => ({ setNodes: () => {} }),
    useStore: (selector: (store: unknown) => unknown) => selector({
      transform: [0, 0, state.zoom], nodesConnectable: state.nodesConnectable,
      edges: [], nodeInternals: new Map(),
    }),
    Handle: ({ id, type, style, children }: { id: string; type: string; style: CSSProperties; children: ReactNode }) =>
      createElement('div', { 'data-testid': type, 'data-id': id, style }, children),
    NodeResizer: ({ isVisible, handleStyle, keepAspectRatio }: { isVisible: boolean; handleStyle: CSSProperties; keepAspectRatio: boolean }) =>
      isVisible ? createElement('div', { 'data-testid': 'corners', 'data-square': keepAspectRatio, style: handleStyle }) : null,
    NodeResizeControl: ({ position, style, keepAspectRatio }: { position: string; style: CSSProperties; keepAspectRatio: boolean }) =>
      createElement('div', { 'data-testid': 'midpoint', 'data-position': position, 'data-square': keepAspectRatio, style }),
  }
})

function render(selected = true, arrows = true, bpmn = false) {
  const props = {
    id: 'node-1', selected, width: 180, height: 96,
    data: { title: 'Node', description: [], layer: 'application', notationId: bpmn ? 'StartEvent' : '' },
  } as unknown as NodeProps<ArchimateElementNodeData>
  const html = renderToStaticMarkup(createElement(DiagramInteractionContext.Provider, {
    value: { showConnectionArrows: arrows, showConnectionPoints: true, beginResize: () => {}, endResize: () => {} },
  }, createElement(bpmn ? BpmnElementNode : ArchimateElementNode, props)))
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

beforeEach(() => { state.zoom = 1; state.nodesConnectable = true })
describe('diagram node affordances', () => {
  it('provides many evenly spaced attachment points on a normal-size node', () => {
    expect(connectionHandlePercentsForLength(120)).toEqual([12, 31, 50, 69, 88])
    expect(connectionHandlePercentsForLength(180)).toHaveLength(9)
    expect(connectionHandlePercentsForLength(600)).toHaveLength(13)
    expect(connectionHandlePercentsForLength(48)).toEqual([50])
  })
  it('adds four midpoint resize controls only while selected', () => {
    expect(render().querySelectorAll('[data-testid="midpoint"]')).toHaveLength(4)
    expect(render(false).querySelectorAll('[data-testid="midpoint"]')).toHaveLength(0)
    expect(render().querySelector('[data-testid="corners"]')).not.toBeNull()
  })
  it('keeps four arrow hit targets inside existing source handles with unchanged IDs', () => {
    const node = render()
    expect(node.querySelectorAll('.diagram-connection-arrow')).toHaveLength(4)
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const arrow = node.querySelector(`.diagram-connection-arrow-${side}`)!
      expect(arrow.parentElement?.getAttribute('data-id')).toBe(`source-${side}`)
      expect(arrow.classList.contains('source')).toBe(true)
      expect(arrow.classList.contains('react-flow__handle')).toBe(false)
    }
    expect(node.querySelectorAll('[data-testid="source"]').length).toBeGreaterThan(12)
  })
  it('keeps controls screen-sized without moving perimeter centers across zoom levels', () => {
    state.zoom = 2
    const node = render()
    expect((node.querySelector('[data-testid="midpoint"]') as HTMLElement).style.width).toBe('5px')
    const point = node.querySelector('[data-id="source-top"]') as HTMLElement
    expect(point.style.width).toBe('8px')
    expect(point.style.getPropertyValue('--diagram-control-scale')).toBe('0.5')
    expect(point.style.left).toBe('calc(50% - 4px)')
    expect(point.style.top).toBe('calc(0% - 4px)')
  })
  it('preserves square aspect ratio on BPMN corner and midpoint controls', () => {
    const node = render(true, true, true)
    expect(node.querySelector('[data-testid="corners"]')?.getAttribute('data-square')).toBe('true')
    for (const control of node.querySelectorAll('[data-testid="midpoint"]')) expect(control.getAttribute('data-square')).toBe('true')
  })
  it('removes arrow affordances when toggled off or preview connections are disabled', () => {
    expect(render(true, false).querySelectorAll('.diagram-connection-arrow')).toHaveLength(0)
    state.nodesConnectable = false
    expect(render().querySelectorAll('.diagram-connection-arrow')).toHaveLength(0)
  })
})
