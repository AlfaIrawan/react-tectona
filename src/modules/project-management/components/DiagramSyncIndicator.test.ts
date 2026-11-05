import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { DiagramSyncIndicator, diagramSyncKey } from './DiagramSyncIndicator'

it('shows an accessible sync icon without visible status prose', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const node = document.createElement('div')
  const root = createRoot(node)
  await act(async () => root.render(createElement(DiagramSyncIndicator, { status: 'synced' })))
  expect(node.textContent).toBe('')
  expect(node.querySelector('[role="status"]')?.getAttribute('title')).toContain('tersinkronisasi')
  expect(node.querySelector('svg')).not.toBeNull()
  const retry = vi.fn()
  await act(async () => root.render(createElement(DiagramSyncIndicator, { status: 'failed', onRetry: retry })))
  await act(async () => node.querySelector('button')!.click())
  expect(retry).toHaveBeenCalledOnce()
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('maps gallery and fullscreen names to the same persisted sync key', () => {
  expect(diagramSyncKey('c4-level-1')).toBe('brainstorm-c4-level-1')
  expect(diagramSyncKey('bpmn-high-level')).toBe('high')
  expect(diagramSyncKey('brainstorm-archimate')).toBe('brainstorm-archimate')
})
