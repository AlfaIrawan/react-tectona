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
    const input = container.querySelector<HTMLInputElement>('[aria-label="Search scope workspaces"]')!
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

function PersonalHarness() {
  const [ids, setIds] = useState(['chosen-personal'])
  return createElement(ScopeWorkspacePicker, { selectedIds: ids, options: [
    { id: 'chosen-personal', name: 'Alfa Personal WS', tenant_mode: 'personal' },
    { id: 'mode-personal', name: 'Alfa Profile', tenant_mode: 'personal' },
    { id: 'metadata-personal', name: 'Alfa Work', tenant_mode: 'organization', metadata: { tectona_workspace_classification: 'Personal' } },
    { id: 'organization', name: 'Alfa Team', tenant_mode: 'organization', metadata: { tectona_workspace_classification: 'Division' } },
    { id: 'legacy', name: 'Personal Research WS' },
  ], onChange: (next: string[]) => { changed(next); setIds(next) } })
}

it('hides personal search results by classification, not by name, while preserving selected badges', async () => {
  await act(async () => root.render(createElement(PersonalHarness)))
  expect(container.querySelector('[role="switch"]')).toBeNull()
  expect(container.textContent).not.toContain('Include personal workspaces')
  expect(container.querySelector('[aria-label="Selected scope workspaces"]')?.textContent).toContain('Alfa Personal WS')
  await search('Alfa')
  const results = () => container.querySelector('[aria-label="Scope workspace search results"]')!
  expect(results().textContent).toContain('Alfa Team')
  expect(results().textContent).not.toContain('Alfa Profile')
  expect(results().textContent).not.toContain('Alfa Work')
  expect(results().querySelectorAll('button')).toHaveLength(1)
  expect(container.querySelector('[aria-label="Selected scope workspaces"]')?.textContent).toContain('Alfa Personal WS')
  await search('Personal Research')
  expect(results().textContent).toContain('Personal Research WS')
  expect(changed).not.toHaveBeenCalled()
})

it('places differently colored badges before the mode control and search', async () => {
  await act(async () => root.render(createElement(ScopeWorkspacePicker, {
    selectedIds: ['bp', 'pf'], options: [{ id: 'bp', name: 'Business Partner' }, { id: 'pf', name: 'Portfolio' }], onChange: changed,
  }, createElement('select', { 'aria-label': 'Scope mode' }))))
  const badges = container.querySelector('[aria-label="Selected scope workspaces"]')!
  expect(badges.children[0].className).not.toBe(badges.children[1].className)
  expect(badges.nextElementSibling?.getAttribute('aria-label')).toBe('Scope mode')
  expect(badges.nextElementSibling?.nextElementSibling?.getAttribute('aria-label')).toBe('Search scope workspaces')
  expect(changed).not.toHaveBeenCalled()
})

it('does not show workspace search in organization mode', async () => {
  await act(async () => root.render(createElement(ScopeWorkspacePicker, { selectedIds: [], options: [], onChange: changed, searchEnabled: false })))
  expect(container.querySelector('input')).toBeNull()
  expect(container.textContent).not.toContain('No workspaces found')
})
