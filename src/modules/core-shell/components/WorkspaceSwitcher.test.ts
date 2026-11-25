import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const mocks = vi.hoisted(() => ({ setActiveTenant: vi.fn(), navigate: vi.fn() }))
vi.mock('@/auth/TenantContext', () => ({
  useTenantContext: () => ({ workspaceId: 'alpha', displayName: 'Alpha', setActiveTenant: mocks.setActiveTenant }),
}))
vi.mock('@/hooks/useWorkspaceNavigate', () => ({ useWorkspaceNavigate: () => mocks.navigate }))
vi.mock('../hooks/useUserWorkspaceOptions', () => ({
  useUserWorkspaceOptions: () => ({
    loading: false,
    fallbackOrgName: 'Example',
    options: [
      { workspaceId: 'alpha', workspaceName: 'Alpha', organizationId: 'org', organizationName: 'Example', slug: 'alpha', tenantMode: 'organization', workspaceClassification: 'Organization' },
      { workspaceId: 'beta', workspaceName: 'Beta', organizationId: 'org', organizationName: 'Example', slug: 'beta', tenantMode: 'organization', workspaceClassification: 'Division' },
      { workspaceId: 'gamma', workspaceName: 'Gamma', organizationId: 'org', organizationName: 'Example', slug: 'gamma', tenantMode: 'organization', parentWorkspaceId: 'alpha' },
      { workspaceId: 'unknown', workspaceName: 'Unknown', organizationId: '', organizationName: 'Example', slug: null, tenantMode: null },
      { workspaceId: 'personal', workspaceName: 'Personal', organizationId: 'org', organizationName: 'Example', slug: 'personal', tenantMode: 'personal', workspaceClassification: 'Organization' },
    ],
  }),
}))

let host: HTMLDivElement
let root: Root
const region = () => host.querySelector<HTMLDivElement>('[aria-label="Workspace options"]')
const trigger = () => host.querySelector<HTMLButtonElement>('[aria-label$=", switch workspace"]')!

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.clearAllMocks()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/projects'] }, createElement(WorkspaceSwitcher))))
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

async function open() {
  await act(async () => trigger().click())
}

async function search(value: string) {
  const input = host.querySelector<HTMLInputElement>('[aria-label="Search workspaces"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('workspace chooser scroll region', () => {
  it('uses directory classification, not tenant mode, for workspace icons and labels', async () => {
    await open()
    for (const [name, label, iconClass] of [
      ['Alpha', 'Organization workspace', 'lucide-building-2'],
      ['Beta', 'Division workspace', 'lucide-network'],
      ['Gamma', 'Unit workspace', 'lucide-network'],
      ['Unknown', 'Workspace', 'lucide-layers'],
      ['Personal', 'Personal workspace', 'lucide-user-round'],
    ]) {
      const nameElement = [...region()!.querySelectorAll('.truncate')]
        .find((item) => item.textContent === name)!
      expect(nameElement.nextElementSibling?.textContent).toBe(label)
      expect(nameElement.parentElement?.parentElement?.querySelector('svg.' + iconClass)?.hasAttribute('aria-hidden')).toBe(true)
    }
    await search('Division workspace')
    expect(region()!.textContent).toContain('Beta')
    expect(region()!.textContent).not.toContain('Alpha')
  })

  it('is keyboard-focusable, bounded and natively scrollable without switching workspace', async () => {
    expect(trigger().getAttribute('aria-label')).toBe(`${trigger().textContent?.trim()}, switch workspace`)
    await open()
    expect(region()?.getAttribute('role')).toBe('region')
    expect(region()?.tabIndex).toBe(0)
    expect(region()?.classList.contains('overflow-y-auto')).toBe(true)
    expect(region()?.classList.contains('max-h-64')).toBe(true)
    await act(async () => region()!.focus())
    expect(document.activeElement).toBe(region())
    const key = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
    await act(async () => region()!.dispatchEvent(key))
    expect(key.defaultPrevented).toBe(false)
    expect(mocks.setActiveTenant).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('preserves search and selecting a workspace, then resets on reopen', async () => {
    await open()
    await search('Beta')
    expect(region()!.textContent).toContain('Beta')
    expect(region()!.textContent).not.toContain('Alpha')
    const beta = [...region()!.querySelectorAll<HTMLElement>('div')]
      .find((element) => element.textContent === 'Beta' && element.classList.contains('truncate'))!
    await act(async () => beta.click())
    expect(mocks.setActiveTenant).toHaveBeenCalledOnce()
    expect(mocks.setActiveTenant).toHaveBeenCalledWith({
      workspaceId: 'beta', orgId: 'org', slug: 'beta', tenantMode: 'organization', displayName: 'Beta', selectedWorkspaceIds: undefined,
    })
    expect(mocks.navigate).toHaveBeenCalledOnce()
    expect(mocks.navigate).toHaveBeenCalledWith('/projects', { slug: 'beta', workspaceId: 'beta' })
    expect(region()).toBeNull()
    await open()
    expect(host.querySelector<HTMLInputElement>('[aria-label="Search workspaces"]')!.value).toBe('')
    expect(region()!.textContent).toContain('Alpha')
  })

  it('keeps empty search and close/reopen behavior unchanged', async () => {
    await open()
    await search('Missing')
    expect(region()!.textContent).toContain('No workspace matches')
    await act(async () => trigger().click())
    expect(region()).toBeNull()
    await open()
    expect(region()!.textContent).toContain('Alpha')
    expect(mocks.setActiveTenant).not.toHaveBeenCalled()
  })

  it('closes on Escape from the search input and returns focus to the switcher', async () => {
    await open()
    const input = host.querySelector<HTMLInputElement>('[aria-label="Search workspaces"]')!
    await act(async () => {
      input.focus()
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(region()).toBeNull()
    expect(document.activeElement).toBe(trigger())
    expect(mocks.setActiveTenant).not.toHaveBeenCalled()
  })
})
