import { describe, expect, it, vi } from 'vitest'
import { captureBrainstormReturnContext, restoreBrainstormReturnContext } from './brainstormReturnContext'
import { closeBrainstorm } from './closeBrainstorm'

const source = {
  workspaceId: 'alfa', orgId: 'adira', slug: 'alfa-irawan-ws', tenantMode: 'personal' as const,
  displayName: 'Alfa Irawan WS', selectedWorkspaceIds: [],
}
const target = { ...source, workspaceId: 'itbp', slug: 'it-business-partner-ws', displayName: 'IT Business Partner WS', tenantMode: 'organization' as const }
const sourceLocation = { pathname: '/w/alfa-irawan-ws/idea-backlog', search: '?folder=one', hash: '' }
const targetLocation = { ...sourceLocation, pathname: '/w/it-business-partner-ws/idea-backlog', search: '' }

describe('brainstorm viewing workspace on close', () => {
  it('returns from IT BP to Alfa only after the session is saved', () => {
    const context = captureBrainstormReturnContext(source, sourceLocation)
    const events: string[] = []
    const setTenant = vi.fn(() => events.push('restore'))
    const navigate = vi.fn()
    const draft = { workspaceId: 'itbp', sourceWorkspaceId: 'alfa', messages: ['saved conversation'] }
    expect(closeBrainstorm({
      busy: false,
      save: () => { events.push('save'); return true },
      close: () => restoreBrainstormReturnContext(context, target, targetLocation, setTenant, navigate),
      notify: vi.fn(),
    })).toBe(true)
    expect(events).toEqual(['save', 'restore'])
    expect(setTenant).toHaveBeenCalledWith(context!.tenant, { remember: false })
    expect(navigate).toHaveBeenCalledWith('/w/alfa-irawan-ws/idea-backlog?folder=one', { replace: true })
    expect(draft.workspaceId).toBe('itbp')
  })

  it('does not reset the tenant or navigate when the source view is unchanged', () => {
    const setTenant = vi.fn(), navigate = vi.fn()
    restoreBrainstormReturnContext(captureBrainstormReturnContext(source, sourceLocation), source, sourceLocation, setTenant, navigate)
    expect(setTenant).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('repairs tenant drift even if the URL still points to Alfa', () => {
    const setTenant = vi.fn(), navigate = vi.fn()
    restoreBrainstormReturnContext(captureBrainstormReturnContext(source, sourceLocation), target, sourceLocation, setTenant, navigate)
    expect(setTenant).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('repairs URL drift even if the tenant still points to Alfa', () => {
    const setTenant = vi.fn(), navigate = vi.fn()
    restoreBrainstormReturnContext(captureBrainstormReturnContext(source, sourceLocation), source, targetLocation, setTenant, navigate)
    expect(setTenant).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledOnce()
  })

  it.each([{ busy: true, saved: true }, { busy: false, saved: false }])('keeps the current view when close is blocked: %o', ({ busy, saved }) => {
    const setTenant = vi.fn(), navigate = vi.fn()
    expect(closeBrainstorm({
      busy, save: () => saved,
      close: () => restoreBrainstormReturnContext(captureBrainstormReturnContext(source, sourceLocation), target, targetLocation, setTenant, navigate),
      notify: vi.fn(),
    })).toBe(false)
    expect(setTenant).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('returns to the viewing workspace when resuming, not the draft destination or historical origin', () => {
    const view = { ...source, workspaceId: 'portfolio', slug: 'portfolio-ws' }
    const context = captureBrainstormReturnContext(view, { ...sourceLocation, pathname: '/w/portfolio-ws/idea-backlog' })
    const setTenant = vi.fn(), navigate = vi.fn()
    restoreBrainstormReturnContext(context, target, targetLocation, setTenant, navigate)
    expect(setTenant.mock.calls[0][0].workspaceId).toBe('portfolio')
    expect(navigate.mock.calls[0][0]).toContain('/w/portfolio-ws/')
  })
})
