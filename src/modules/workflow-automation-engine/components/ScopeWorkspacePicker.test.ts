import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ScopeWorkspacePicker } from './ScopeWorkspacePicker'

let container: HTMLDivElement
let root: Root
let changed = vi.fn()
function Harness() {
  const [ids, setIds] = useState(['bp'])
  return createElement(ScopeWorkspacePicker, { selectedIds: ids, options: [{ id: 'bp', name: 'IT Business Partner WS' }, { id: 'pf', name: 'IT Portfolio WS' }], onChange: (next: string[]) => { changed(next); setIds(next) } })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  changed = vi.fn()
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
async function search(value: string) {
  await act(async () => {
    const input = container.querySelector('input')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('shows selected workspace badges without changing the stored ids or showing the directory', async () => {
  await act(async () => root.render(createElement(Harness)))
  expect(container.querySelector('[aria-label="Selected scope workspaces"]')?.textContent).toContain('IT Business Partner WS')
  expect(container.querySelector('[aria-label="Scope workspace search results"]')).toBeNull()
  expect(changed).not.toHaveBeenCalled()
  await search('  ')
  expect(container.querySelector('[aria-label="Scope workspace search results"]')).toBeNull()
})

it('filters by name, excludes selected ids and clears results after adding a workspace', async () => {
  await act(async () => root.render(createElement(Harness)))
  await search('business')
  expect(container.querySelector('[role="status"]')?.textContent).toBe('No matching workspaces.')
  await search('  PORTFOLIO  ')
  const button = container.querySelector<HTMLButtonElement>('[aria-label="Scope workspace search results"] button')!
  expect(button.textContent).toBe('IT Portfolio WS')
  await act(async () => button.click())
  expect(changed).toHaveBeenCalledWith(['bp', 'pf'])
  expect(container.querySelector('input')?.value).toBe('')
  expect(container.querySelector('[aria-label="Scope workspace search results"]')).toBeNull()
  expect(document.activeElement).toBe(container.querySelector('input'))
})

it('removes only the chosen badge and preserves unknown selected ids while the directory loads', async () => {
  await act(async () => root.render(createElement(Harness)))
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Remove IT Business Partner WS from scope"]')!.click())
  expect(changed).toHaveBeenCalledWith([])
  changed.mockClear()
  await act(async () => root.render(createElement(ScopeWorkspacePicker, { selectedIds: ['unloaded-id'], options: [], onChange: changed })))
  expect(container.textContent).toContain('unloaded-id')
  expect(changed).not.toHaveBeenCalled()
})
