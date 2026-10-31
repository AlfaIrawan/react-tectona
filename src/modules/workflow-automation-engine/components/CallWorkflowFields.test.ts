import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CallWorkflowFields } from './CallWorkflowFields'
import { listWorkflows, listWorkflowVersions, type WorkflowSummaryDto, type WorkflowVersionDto } from '@/lib/api/workflowAutomationApi'

vi.mock('@/lib/api/workflowAutomationApi', () => ({ listWorkflows: vi.fn(), listWorkflowVersions: vi.fn() }))

let container: HTMLDivElement
let root: Root
let openChild = vi.fn()

function Harness() {
  const [config, setConfig] = useState({ workflowId: 'bp', workflowVersion: '21', workflowName: 'Business Partner approval' })
  return createElement(CallWorkflowFields, {
    workspaceId: 'home', currentWorkflowId: 'parent', config,
    onChange: (changes: Record<string, string>) => setConfig((value) => ({ ...value, ...changes })),
    onOpen: () => openChild(config.workflowId),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  openChild = vi.fn()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.mocked(listWorkflows).mockResolvedValue([
    { id: 'parent', name: 'Parent', status: 'Active', is_published: true },
    { id: 'bp', name: 'Business Partner approval', status: 'Active', is_published: true },
    { id: 'portfolio', name: 'Portfolio approval', status: 'Active', is_published: true },
    { id: 'draft', name: 'Draft', status: 'Draft', is_published: false },
  ] as WorkflowSummaryDto[])
  vi.mocked(listWorkflowVersions).mockImplementation(async (id) => [
    { id: `${id}-version`, version: id === 'bp' ? 21 : 4 },
  ] as WorkflowVersionDto[])
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('Call Workflow configuration', () => {
  it('reuses an existing published workflow and clears the version when its target changes', async () => {
    await act(async () => root.render(createElement(Harness)))
    const workflow = container.querySelector<HTMLSelectElement>('[aria-label="Child Workflow"]')!
    const version = container.querySelector<HTMLSelectElement>('[aria-label="Published Version"]')!
    expect(Array.from(workflow.options, (option) => option.value)).toEqual(['', 'bp', 'portfolio'])
    expect(version.value).toBe('21')
    await act(async () => { workflow.value = 'portfolio'; workflow.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(version.value).toBe('')
    await act(async () => { version.value = '4'; version.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(version.value).toBe('4')
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open child workflow"]')!.click())
    expect(openChild).toHaveBeenCalledWith('portfolio')
  })

  it('reports a version lookup failure and recovers after selecting another workflow', async () => {
    vi.mocked(listWorkflowVersions).mockRejectedValueOnce(new Error('Unavailable'))
    await act(async () => root.render(createElement(Harness)))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not load published versions')
    const workflow = container.querySelector<HTMLSelectElement>('[aria-label="Child Workflow"]')!
    await act(async () => { workflow.value = 'portfolio'; workflow.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[aria-label="Published Version"]')?.textContent).toContain('v4')
  })
})
