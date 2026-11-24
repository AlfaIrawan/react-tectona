import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceSlugLayout } from '@/auth/WorkspaceSlugLayout'

const evaluateWorkspaceSlugAccess = vi.fn()
const setActiveTenant = vi.fn()

vi.mock('@/auth/authService', () => ({
  getSession: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/auth/TenantContext', () => ({
  useTenantContext: () => ({ setActiveTenant, workspaceId: null }),
}))

vi.mock('@/lib/workspaceSlugAccess', () => ({
  evaluateWorkspaceSlugAccess: (...args: unknown[]) => evaluateWorkspaceSlugAccess(...args),
}))

function renderAt(path: string) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null,
        createElement(Route, {
          path: '/w/:workspaceSlug/*',
          element: createElement(WorkspaceSlugLayout),
        }, createElement(Route, {
          path: 'idea-backlog',
          element: createElement('div', null, 'Idea backlog open'),
        })),
        createElement(Route, { path: '/login', element: createElement('div', null, 'Login page') }),
        createElement(Route, { path: '/access-denied', element: createElement('div', null, 'Access denied') }),
      ),
    ))
  })
  return { host, root }
}

describe('WorkspaceSlugLayout disruption warning', () => {
  let root: Root | undefined

  beforeEach(() => {
    evaluateWorkspaceSlugAccess.mockReset()
    setActiveTenant.mockReset()
    vi.stubEnv('VITE_TECTONA_SUPPORT_PORTAL_URL', '')
  })

  afterEach(() => {
    act(() => root?.unmount())
    document.body.innerHTML = ''
    vi.unstubAllEnvs()
  })

  it('names the failed check, retries, and opens the page when the service recovers', async () => {
    evaluateWorkspaceSlugAccess
      .mockResolvedValueOnce({ allowed: false, reason: 'unavailable', dependency: 'workspace-directory' })
      .mockResolvedValueOnce({
        allowed: true,
        slug: {
          workspace_id: 'ws-1',
          slug: 'adira-finance-ws',
          org_id: 'org-1',
          display_name: 'Adira Finance WS',
          tenant_mode: 'personal',
        },
        workspace: { id: 'ws-1' },
      })

    const view = renderAt('/w/adira-finance-ws/idea-backlog')
    root = view.root
    await act(async () => {
      await Promise.resolve()
    })

    expect(view.host.textContent).toContain('Workspace directory unavailable')
    expect(view.host.textContent).not.toContain('Server unavailable')
    expect(view.host.textContent).not.toContain('Go back')
    expect(view.host.textContent).not.toContain('Create support ticket')

    const button = view.host.querySelector('button')
    expect(button?.textContent).toBe('Try again')
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(evaluateWorkspaceSlugAccess).toHaveBeenCalledTimes(2)
    expect(view.host.textContent).toContain('Idea backlog open')
  })

  it('shows access denied for a real rejection and login for an expired session', async () => {
    evaluateWorkspaceSlugAccess.mockResolvedValueOnce({ allowed: false, reason: 'forbidden' })
    const denied = renderAt('/w/adira-finance-ws/idea-backlog')
    root = denied.root
    await act(async () => {
      await Promise.resolve()
    })
    expect(denied.host.textContent).toContain('Access denied')
    expect(denied.host.textContent).not.toContain('unavailable')

    act(() => root?.unmount())
    evaluateWorkspaceSlugAccess.mockResolvedValueOnce({ allowed: false, reason: 'unauthenticated' })
    const login = renderAt('/w/adira-finance-ws/idea-backlog')
    root = login.root
    await act(async () => {
      await Promise.resolve()
    })
    expect(login.host.textContent).toContain('Login page')
  })

  it('shows the support link only for an approved https portal', async () => {
    vi.stubEnv('VITE_TECTONA_SUPPORT_PORTAL_URL', 'https://support.example.com/portal')
    evaluateWorkspaceSlugAccess.mockResolvedValueOnce({
      allowed: false,
      reason: 'unavailable',
      dependency: 'workspace-access',
    })
    const view = renderAt('/w/adira-finance-ws/idea-backlog')
    root = view.root
    await act(async () => {
      await Promise.resolve()
    })
    expect(view.host.textContent).toContain('Workspace access verification unavailable')
    const link = view.host.querySelector('a')
    expect(link?.textContent).toBe('Create support ticket')
    expect(link?.getAttribute('href')).toBe('https://support.example.com/portal')
    expect(view.host.textContent).not.toContain('Go back')
  })
})
