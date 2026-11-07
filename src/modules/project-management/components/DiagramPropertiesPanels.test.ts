import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node, Edge } from 'reactflow'
import { IntegrationNodePropertiesPanel } from './IntegrationNodePropertiesPanel'
import { DiagramEdgePropertiesPanel, splitEdgeLabel, joinEdgeLabel } from './DiagramEdgePropertiesPanel'
import type { ArchimateElementNodeData, ArchimateNodeData } from '../lib/integrationArchitectureTypes'
import { buildIntegrationNodeBoxStyle, buildIntegrationNodeTextStyle } from '../lib/integrationNodeAppearance'

let host: HTMLDivElement, root: Root
const update = vi.fn(), size = vi.fn(), position = vi.fn(), layer = vi.fn(), rotate = vi.fn()
const node: Node<ArchimateElementNodeData> = { id: 'n', type: 'archimateElement', position: { x: 0, y: 0 }, style: { width: 200, height: 100 }, data: { kind: 'element', title: 'Title', stereotype: 'Application', notationId: 'application-component', description: ['First'], layer: 'application' } }
const edge: Edge = { id: 'e', source: 'a', target: 'b', label: 'uses [HTTPS]' }
const drag = { isDragging: false, onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn() }
async function mountNode(value: Node<ArchimateNodeData> = node) { await act(async () => root.render(createElement(IntegrationNodePropertiesPanel, { selectedNode: value, onUpdateData: update, onUpdateSize: size, onUpdatePosition: position, onLayerAction: layer, onRotate90: rotate }))) }
async function mountEdge(value = edge) { await act(async () => root.render(createElement(DiagramEdgePropertiesPanel, { edge: value, onChange: update, dragHandleProps: drag }))) }
async function click(text: string) { const button = [...host.querySelectorAll('button')].find(b => b.textContent === text || b.getAttribute('aria-label') === text); expect(button, text).toBeTruthy(); await act(async () => button!.click()) }
async function change(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value)
  await act(async () => input.dispatchEvent(new Event('input', { bubbles: true })))
}
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('node property controls', () => {
  it('offers image alternative text instead of inapplicable font controls', async () => {
    await mountNode({ ...node, data: { kind: 'image', src: 'fixture.png', alt: 'Old description' } }); await click('Text')
    expect(host.querySelector('[aria-label="Bold"]')).toBeNull()
    await change(host.querySelector<HTMLInputElement>('[aria-label="Alternative text"]')!, 'Updated description')
    expect(update).toHaveBeenLastCalledWith({ alt: 'Updated description' })
    expect(host.textContent).toContain('do not apply to image pixels')
  })
  it('shows fixed-legend limitations without editable no-op inputs', async () => {
    await mountNode({ ...node, data: { kind: 'legend' } })
    expect(host.querySelector('input')).toBeNull()
    await click('Text'); expect(host.querySelector('input')).toBeNull()
    expect(host.textContent).toContain('fixed notation samples')
  })

  it('writes every style checkbox without discarding previous style fields', async () => {
    await mountNode({ ...node, data: { ...node.data, visual: { lineWidth: 3 } } })
    for (const checkbox of host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) {
      await act(async () => checkbox.click())
      expect(update.mock.lastCall![0].visual.lineWidth).toBe(3)
    }
    expect(update).toHaveBeenCalledTimes(6)
  })
  it('allows negative offsets and position through decrement buttons', async () => {
    await mountNode(); await click('Text'); await click('Decrease Offset X')
    expect(update).toHaveBeenLastCalledWith({ textStyle: { offsetX: -1 } })
    await click('Arrange'); await click('Decrease Left'); expect(position).toHaveBeenLastCalledWith(-1, 0)
  })
  it('preserves newlines and blank lines while editing description', async () => {
    await mountNode(); await click('Text')
    await change(host.querySelectorAll('textarea')[1], 'First\n\n')
    expect(update).toHaveBeenLastCalledWith({ description: ['First', '', ''] })
  })
  it('routes size, proportional resizing, layering and rotation', async () => {
    await mountNode({ ...node, data: { ...node.data, arrange: { constrainProportions: true } } }); await click('Arrange')
    await click('Increase Width'); expect(size).toHaveBeenLastCalledWith(201, 101)
    for (const [label, action] of [['Bring to Front','front'], ['Send to Back','back'], ['Bring Forward','forward'], ['Send Backward','backward']]) { await click(label); expect(layer).toHaveBeenLastCalledWith(action) }
    const rotateButton = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Rotate'))!
    await act(async () => rotateButton.click()); expect(rotateButton.disabled).toBe(true); expect(rotate).not.toHaveBeenCalled()
  })
  it('can disable word wrap with an explicit text box', async () => {
    await mountNode({ ...node, data: { ...node.data, textStyle: { wordWrap: false, boxWidth: 120 } } }); await click('Text')
    const label = [...host.querySelectorAll('label')].find(l => l.textContent === 'Word Wrap')!
    expect(label.querySelector('input')!.checked).toBe(false)
  })
})

describe('edge property controls', () => {
  it('preserves a trailing space while composing multi-word relation text', () => {
    expect(splitEdgeLabel(joinEdgeLabel('sends ', 'HTTPS')).text).toBe('sends ')
    expect(splitEdgeLabel(joinEdgeLabel('sends a request', 'HTTPS')).text).toBe('sends a request')
  })
  it('writes every exposed style/arrange checkbox and retains metadata', async () => {
    await mountEdge({ ...edge, data: { link: 'https://example.com', custom: 'preserve' } })
    const checkboxes = [...host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].filter(input => !input.closest('fieldset[disabled]'))
    for (const checkbox of checkboxes) { await act(async () => checkbox.click()); expect(update.mock.lastCall![0].data.custom).toBe('preserve'); expect(update.mock.lastCall![0].data.link).toBe('https://example.com') }
    expect(checkboxes.length).toBeGreaterThan(15)
  })
  it('disables unsupported routing controls without changing saved values', async () => {
    await mountEdge({ ...edge, data: { arrange: { snapToPoint: true, loopRouting: false }, visual: { lineJumps: 'arc' } } })
    const fields = [...host.querySelectorAll('fieldset[disabled]')]
    expect(fields.length).toBe(7)
    for (const input of host.querySelectorAll<HTMLInputElement>('fieldset[disabled] input')) await act(async () => input.click())
    expect(update).not.toHaveBeenCalled()
  })
  it('retains technology when editing label and reverses handles', async () => {
    await mountEdge({ ...edge, sourceHandle: 'source-right-25', targetHandle: 'target-left' }); await click('Text')
    await change(host.querySelector('input')!, 'sends')
    expect(update.mock.lastCall![0].label).toBe('sends [HTTPS]')
    await click('Arrange'); await click('Reverse')
    expect(update.mock.lastCall![0]).toMatchObject({ source: 'b', target: 'a', sourceHandle: 'source-left', targetHandle: 'target-right-25' })
  })
})

describe('property rendering helpers', () => {
  it('keeps glass valid for transparent and rgba fills', () => {
    expect(buildIntegrationNodeBoxStyle({ glass: true, fillEnabled: false }).backgroundColor).toBe('transparent')
    expect(buildIntegrationNodeBoxStyle({ glass: true, fillColor: 'rgba(1,2,3,0.5)' }).backgroundColor).toBe('color-mix(in srgb, rgba(1,2,3,0.5) 80%, transparent)')
  })
  it('maps text properties and bounds invalid opacity/size', () => {
    expect(buildIntegrationNodeTextStyle({ bold: true, italic: true, underline: true, align: 'right', verticalAlign: 'bottom', angle: -90, opacity: 150, fontSize: -5, wordWrap: false })).toMatchObject({ fontWeight: 700, fontStyle: 'italic', textDecoration: 'underline', textAlign: 'right', justifyContent: 'flex-end', transform: 'rotate(-90deg)', opacity: 1, fontSize: 1, whiteSpace: 'nowrap' })
    expect(buildIntegrationNodeBoxStyle({ opacity: -10, lineWidth: -2 })).toMatchObject({ opacity: 0, borderWidth: 0 })
  })
})
