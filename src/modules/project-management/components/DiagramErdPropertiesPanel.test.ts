import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge } from 'reactflow'
import { DiagramEdgePropertiesPanel } from './DiagramEdgePropertiesPanel'
import { parseUmlDiagram, serializeUmlDiagram, umlLinkFromCanvasEdge } from '../lib/classErdPlantUml'
let host: HTMLDivElement, root: Root
const update = vi.fn()
const drag = { isDragging: false, onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn() }
const fixture = (): Edge => ({ id: 'e', source: 'a', target: 'b', type: 'erd', label: 'owns', style: { stroke: '#123456' }, data: { sourceMany: false, sourceOptional: false, targetMany: true, targetOptional: true, visual: { lineColor: '#123456', lineStyle: 'dashed' }, segmentRoute: { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] } } })
async function mount(edge: Edge) { await act(async () => root.render(createElement(DiagramEdgePropertiesPanel, { edge, onChange: update, dragHandleProps: drag }))) }
async function choose(end: string, value: string) { const select = host.querySelector(`select[aria-label="${end} cardinality"]`) as HTMLSelectElement; await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) }) }
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
describe('ERD cardinality property controls', () => {
  it('disables irrelevant arrows but retains working spacing and pattern controls', async () => {
    await mount(fixture())
    expect(host.textContent).toContain('Crowfoot markers encode cardinality')
    for (const label of ['Line start', 'Line end']) expect((host.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement).disabled).toBe(true)
    for (const label of ['Start marker size', 'End marker size']) expect((host.querySelector(`[aria-label="${label}"]`) as HTMLFieldSetElement).disabled).toBe(true)
    expect(host.querySelector('[aria-label="Line end Classic"]')?.closest('fieldset')?.disabled).toBe(true)
    expect(host.querySelector('[aria-label="Increase Spacing"]')?.closest('fieldset')?.disabled ?? false).toBe(false)
    const properties = [...host.querySelectorAll('button')].find(button => button.textContent === 'Properties')
    if (properties) await act(async () => properties.click())
    for (const label of ['Start fill', 'End fill']) expect((host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement)?.disabled).toBe(true)
  })
  it('roundtrips all sixteen source/target cardinality combinations without changing style or authored routes', async () => {
    for (const from of ['one', 'zero-or-one', 'many', 'zero-or-many']) for (const to of ['one', 'zero-or-one', 'many', 'zero-or-many']) {
      let edge = fixture(); await mount(edge); await choose('From', from); edge = { ...edge, ...update.mock.lastCall![0] }; await mount(edge); await choose('To', to); edge = { ...edge, ...update.mock.lastCall![0] }
      expect(edge.data.visual).toEqual(fixture().data.visual)
      expect(edge.data.segmentRoute).toEqual(fixture().data.segmentRoute)
      expect(edge.style).toEqual(fixture().style)
      const source = serializeUmlDiagram({ view: 'erd', boxes: [{ id: 'a', title: 'a', kind: 'entity', members: [] }, { id: 'b', title: 'b', kind: 'entity', members: [] }], links: [umlLinkFromCanvasEdge(edge, 'erd')] })
      const parsed = parseUmlDiagram(source, 'erd').links[0]
      expect(parsed.sourceEnd).toEqual({ many: from.endsWith('many'), optional: from.startsWith('zero-or-') })
      expect(parsed.targetEnd).toEqual({ many: to.endsWith('many'), optional: to.startsWith('zero-or-') })
      expect(parsed.lineStyle).toBe('dashed')
    }
  })
  it('leaves ordinary relation arrows enabled', async () => {
    await mount({ ...fixture(), type: 'smoothstep' })
    expect(host.querySelector('[aria-label="From cardinality"]')).toBeNull()
    expect((host.querySelector('[aria-label="Line end"]') as HTMLSelectElement).disabled).toBe(false)
  })
})
