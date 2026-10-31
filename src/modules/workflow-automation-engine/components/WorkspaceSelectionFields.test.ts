import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceSelectionFields, workspaceOptionDescriptions } from './WorkspaceSelectionFields'

const options = [{ id: 'bp', name: 'Business Partner' }, { id: 'portfolio', name: 'Portfolio' }]
let container: HTMLDivElement
let root: Root
let changed = vi.fn()
function Harness() {
  const [config, setConfig] = useState({ allowedWorkspaceIds: '["bp","portfolio"]', defaultWorkspaceId: 'bp', optionDescriptions: '{"bp":"Business review","portfolio":"Portfolio review"}' })
  return createElement(WorkspaceSelectionFields, {
    config, options, onChange: (updates: Record<string, string>) => { changed(updates); setConfig((value) => ({ ...value, ...updates })) },
  })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  changed = vi.fn()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('workspace option description configuration', () => {
  it('handles missing, malformed and non-object legacy values', () => {
    for (const value of [undefined, '', '{invalid', 'null', '[]', 'false']) expect(workspaceOptionDescriptions(value)).toEqual({})
    expect(workspaceOptionDescriptions('{"bp":"Business review","portfolio":42}')).toEqual({ bp: 'Business review' })
  })

  it('edits multiline descriptions independently without changing routing fields', async () => {
    await act(async () => root.render(createElement(Harness)))
    const textarea = container.querySelector<HTMLTextAreaElement>('[aria-label="Option Description for Business Partner"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Business initiatives\nReview required')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(changed).toHaveBeenCalledTimes(1)
    const update = changed.mock.calls[0][0]
    expect(Object.keys(update)).toEqual(['optionDescriptions'])
    expect(JSON.parse(update.optionDescriptions)).toEqual({ bp: 'Business initiatives\nReview required', portfolio: 'Portfolio review' })
  })

  it('removes only the description of the workspace that was removed', async () => {
    await act(async () => root.render(createElement(Harness)))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Remove Business Partner"]')!.click())
    const update = changed.mock.calls[0][0]
    expect(JSON.parse(update.allowedWorkspaceIds)).toEqual(['portfolio'])
    expect(update.defaultWorkspaceId).toBe('')
    expect(JSON.parse(update.optionDescriptions)).toEqual({ portfolio: 'Portfolio review' })
    expect(container.querySelector('[aria-label="Option Description for Business Partner"]')).toBeNull()
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Option Description for Portfolio"]')?.value).toBe('Portfolio review')
  })
})
