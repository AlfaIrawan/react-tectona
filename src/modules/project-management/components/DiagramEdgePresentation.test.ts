import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Position, type EdgeProps } from 'reactflow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnchoredSmoothStepEdge } from './AnchoredSmoothStepEdge'
import { ErdCrowfootEdge } from './ErdCrowfootEdge'
import { DiagramReconnectContext } from '../lib/useDiagramReconnect'
const state = vi.hoisted(() => ({ setEdges: vi.fn() }))
vi.mock('reactflow', async original => ({ ...await original<typeof import('reactflow')>(),
  EdgeLabelRenderer: ({ children }: { children: import('react').ReactNode }) => createElement('foreignObject', null, children),
  useReactFlow: () => ({ setNodes: vi.fn(), setEdges: state.setEdges, screenToFlowPosition: (p: unknown) => p }),
  useStore: (select: (s: unknown) => unknown) => select({ transform: [0, 0, 1], nodeInternals: new Map() }),
}))
let host: HTMLDivElement, root: Root
const props = (data = {}): EdgeProps => ({ id: 'edge', source: 'a', target: 'b', sourceX: 0, sourceY: 0, targetX: 200, targetY: 100, sourcePosition: Position.Right, targetPosition: Position.Left, label: '<b>Example</b>', selected: true, data } as EdgeProps)
const context = { subscribe: () => () => {}, getPreview: () => null, start: vi.fn() }
async function render(data = {}, writable = true, erd = false) {
  await act(async () => root.render(createElement(DiagramReconnectContext.Provider, { value: writable ? context as never : null }, createElement('svg', null, createElement(erd ? ErdCrowfootEdge : AnchoredSmoothStepEdge, props(data))))))
}
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; state.setEdges.mockClear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
describe('rendered edge property controls', () => {
  it.each(['include', 'extend'])('preserves literal UML %s labels while still sanitizing HTML', async relation => {
    const edge = { ...props({ textStyle: { formattedText: true } }), label: `<<${relation}>> <img src=x onerror=alert(1)><b>safe</b>` }
    await act(async () => root.render(createElement(DiagramReconnectContext.Provider, { value: context as never }, createElement('svg', null, createElement(AnchoredSmoothStepEdge, edge)))))
    const label = host.querySelector('[role=button]')!
    expect(label.textContent).toBe(`<<${relation}>> safe`)
    expect(label.querySelector('img')).toBeNull()
    expect(label.querySelector(relation)).toBeNull()
    expect(label.querySelector('b')?.textContent).toBe('safe')
  })

  it('applies shared ERD line and label styles without losing cardinality glyphs', async () => {
    await render({ sourceMany: true, targetOptional: true, visual: { lineWidth: 4, lineStyle: 'dashed', opacity: 40 }, textStyle: { formattedText: true, fontSize: 20 }, arrange: { movable: false } }, true, true)
    const path = host.querySelector('.react-flow__edge-path') as SVGElement
    expect(path.style.strokeWidth).toBe('4')
    expect(path.style.strokeDasharray).toBe('12 8')
    expect(path.style.opacity).toBe('0.4')
    expect(host.querySelector('polygon')).toBeNull()
    expect(host.querySelector('circle[r="3.5"]')).not.toBeNull()
    expect(host.querySelector('[role=button] b')?.textContent).toBe('Example')
    expect((host.querySelector('[role=button]') as HTMLElement).style.fontSize).toBe('20px')
    expect(host.querySelector('[role=separator]')).toBeNull()
  })
  it('renders sanitized formatting, switches to literal text, and honors sized label nowrap/right alignment', async () => {
    await render({ textStyle: { formattedText: true, wordWrap: false, boxWidth: 200, align: 'right' } })
    const label = host.querySelector('[role=button]') as HTMLElement
    expect(label.querySelector('b')?.textContent).toBe('Example')
    expect(label.style.whiteSpace).toBe('nowrap')
    expect((label.querySelector('span') as HTMLElement).style.textAlign).toBe('right')
    await render({ textStyle: { formattedText: false } })
    expect(host.querySelector('[role=button]')?.textContent).toBe('<b>Example</b>')
    expect(host.querySelector('b')).toBeNull()
  })
  it('blocks read-only and non-editable double clicks but permits editable labels', async () => {
    for (const [writable, editable] of [[false, true], [true, false], [true, true]]) {
      await render({ arrange: { editable } }, writable)
      await act(async () => host.querySelector('[role=button]')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
      expect(Boolean(host.querySelector('input'))).toBe(writable && editable)
    }
  })
  it('hides mutation handles for immovable edges and honors unfilled classic markers', async () => {
    await render({ arrange: { movable: false, fillOpacity: 30 }, visual: { endFill: false } })
    expect(host.querySelector('[role=separator]')).toBeNull()
    expect(host.querySelector('[data-diagram-endpoint-hit]')).toBeNull()
    const marker = host.querySelector('polygon')!
    expect(marker.getAttribute('fill')).toBe('white')
    expect((marker.parentElement as unknown as SVGElement).style.fillOpacity).toBe('0.3')
  })
})
