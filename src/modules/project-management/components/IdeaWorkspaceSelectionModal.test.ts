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

async function render(description?: string, onContinue = vi.fn(), optionDescriptions?: Record<string, string>) {
  await act(async () => root.render(createElement(IdeaWorkspaceSelectionModal, {
    policy: { ...policy, popup_description: description, option_descriptions: optionDescriptions },
    options: [{ workspaceId: 'bp', workspaceName: 'IT Business Partner WS' }, { workspaceId: 'portfolio', workspaceName: 'IT Portfolio WS' }],
    onClose: vi.fn(), onContinue,
  })))
  return document.querySelector('[role="dialog"]')!
}

describe('workspace popup description', () => {
  it('shows each option description as plain text without changing its workspace id', async () => {
    const onContinue = vi.fn()
    const dialog = await render('General guidance', onContinue, {
      bp: 'Business initiatives\nBusiness Partner review',
      portfolio: '<b>Portfolio initiatives</b>',
      outside: 'Must not be displayed',
    })
    const bp = dialog.querySelector<HTMLInputElement>('input[value="bp"]')!
    const portfolio = dialog.querySelector<HTMLInputElement>('input[value="portfolio"]')!
    expect(bp.getAttribute('aria-label')).toBe('IT Business Partner WS')
    expect(document.getElementById(bp.getAttribute('aria-describedby')!)?.textContent).toBe('Business initiatives\nBusiness Partner review')
    expect(document.getElementById(portfolio.getAttribute('aria-describedby')!)?.textContent).toBe('<b>Portfolio initiatives</b>')
    expect(dialog.querySelector('b')).toBeNull()
    expect(dialog.textContent).not.toContain('Must not be displayed')
    await act(async () => portfolio.click())
    const button = Array.from(dialog.querySelectorAll('button')).find((item) => item.textContent?.includes('Continue'))!
    await act(async () => button.click())
    expect(onContinue).toHaveBeenCalledWith('portfolio')
  })

  it('leaves undescribed options name-only', async () => {
    const dialog = await render('', vi.fn(), { bp: '  \n ' })
    expect(dialog.querySelectorAll('[aria-describedby]')).toHaveLength(0)
    expect(dialog.querySelectorAll('input[type="radio"]')).toHaveLength(2)
  })

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
