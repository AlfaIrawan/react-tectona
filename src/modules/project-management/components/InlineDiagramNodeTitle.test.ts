import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InlineDiagramNodeTitle } from './InlineDiagramNodeTitle'

const state = vi.hoisted(() => ({ nodes: [{ id: 'task', data: { title: 'Review' } }], editable: true }))
vi.mock('reactflow', () => ({ useReactFlow: () => ({ setNodes: (change: (nodes: typeof state.nodes) => typeof state.nodes) => { state.nodes = change(state.nodes) } }), useStore: (select: (state: { elementsSelectable: boolean }) => boolean) => select({ elementsSelectable: state.editable }) }))
let host: HTMLDivElement, root: Root
beforeEach(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  state.nodes = [{ id: 'task', data: { title: 'Review' } }]; state.editable = true
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await act(async () => root.render(createElement(InlineDiagramNodeTitle, { nodeId: 'task', value: 'Review' })))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
describe('direct node title editing', () => {
  it('opens an editor on double click and commits without changing the node identity', async () => {
    await act(async () => host.firstElementChild!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    const input = host.querySelector('input')!
    expect(input.getAttribute('aria-label')).toBe('Edit node title')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Approved')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(state.nodes).toEqual([{ id: 'task', data: { title: 'Approved' } }])
    expect(host.querySelector('input')).toBeNull()
  })
  it('cancels with Escape and leaves preview labels read-only', async () => {
    await act(async () => host.firstElementChild!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await act(async () => host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(host.querySelector('input')).toBeNull()
    expect(state.nodes[0].data.title).toBe('Review')
    state.editable = false
    await act(async () => root.render(createElement(InlineDiagramNodeTitle, { nodeId: 'task', value: 'Review' })))
    await act(async () => host.firstElementChild!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(host.querySelector('input')).toBeNull()
  })
})
