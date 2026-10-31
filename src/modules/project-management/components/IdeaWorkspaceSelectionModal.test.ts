import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaWorkspaceSelectionModal } from './IdeaWorkspaceSelectionModal'
import type { IdeaWorkspaceSelectionPolicy } from '../lib/ideaWorkspaceSelection'

const policy: IdeaWorkspaceSelectionPolicy = {
  workflow_id: 'parent', allowed_workspace_ids: ['bp', 'portfolio'], default_workspace_id: 'bp',
  selection_required: true, popup_title: 'Select Workspace',
}
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(description?: string, onContinue = vi.fn()) {
  await act(async () => root.render(createElement(IdeaWorkspaceSelectionModal, {
    policy: { ...policy, popup_description: description },
    options: [{ workspaceId: 'bp', workspaceName: 'IT Business Partner WS' }, { workspaceId: 'portfolio', workspaceName: 'IT Portfolio WS' }],
    onClose: vi.fn(), onContinue,
  })))
  return document.querySelector('[role="dialog"]')!
}

describe('workspace popup description', () => {
  it.each([undefined, '', '  \n '])('keeps the default description for missing or blank configuration: %s', async (value) => {
    const dialog = await render(value)
    expect(dialog.textContent).toContain('Choose the workspace that will own this idea.')
  })

  it('renders multiline content as plain text and keeps workspace selection unchanged', async () => {
    const onContinue = vi.fn()
    const description = 'Business initiatives\n<script>not executable</script>'
    const dialog = await render(description, onContinue)
    expect(dialog.textContent).toContain(description)
    expect(dialog.querySelector('script')).toBeNull()
    expect(dialog.querySelector('.whitespace-pre-line')?.textContent).toBe(description)
    await act(async () => dialog.querySelector<HTMLInputElement>('input[value="portfolio"]')!.click())
    const button = Array.from(dialog.querySelectorAll('button')).find((item) => item.textContent?.includes('Continue'))!
    await act(async () => button.click())
    expect(onContinue).toHaveBeenCalledWith('portfolio')
  })
})
