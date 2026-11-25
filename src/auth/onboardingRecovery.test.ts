import { act, createElement as h, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppAccessGate } from './AppAccessGate'
import { OnboardingGate } from './OnboardingGate'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { OnboardingStatusPage } from '@/pages/OnboardingStatusPage'
import { CorporateOrganizationStep } from '@/modules/onboarding/components/CorporateOrganizationStep'
import { onboardingReturnPath } from './onboardingReturnPath'

const api = vi.hoisted(() => ({ status: vi.fn(), progress: vi.fn(), resolve: vi.fn(), create: vi.fn(), memberships: vi.fn(), subjectId: 'user-1' }))
vi.mock('@/auth/authService', () => ({ getSession: () => ({ user: { id: api.subjectId, email: 'al@company.test', roles: [] } }), logoutAsync: vi.fn() }))
vi.mock('@/auth/sessionEvents', () => ({ onSessionActive: () => () => {}, onSessionCleared: () => () => {} }))
vi.mock('@/lib/auth/platformAccess', () => ({ hasPlatformAdminAccess: () => false }))
vi.mock('@/lib/onboardingFeature', () => ({ isOnboardingEnabled: () => true, isConsumerEmail: () => false, isCorporateEmailVerificationRequired: () => false, isCorporateAdminApprovalRequired: () => true, isCorporateOnboardingMethodChoiceEnabled: () => false, TENANT_STORAGE_KEY: 'tenant-test' }))
vi.mock('@/lib/api/onboardingApi', () => ({ fetchOnboardingStatus: api.status, resolveOrganizationByEmail: api.resolve, createPersonalWorkspaceOnboarding: api.create, createOrgPersonalWorkspaceOnboardingForUser: api.create, submitJoinRequestByWorkspaceId: vi.fn(), switchCorporateOnboardingToAdminApproval: vi.fn() }))
vi.mock('@/lib/api/workspaceOrgApi', () => ({ fetchCorporateOnboardingProgress: api.progress }))
vi.mock('@/lib/api/identityApi', () => ({ resendDomainOnboardingVerificationEmail: vi.fn() }))
vi.mock('@/auth/TenantContext', () => ({ useTenantContext: () => ({ slug: 'alfa-irawan-ws', setActiveTenant: vi.fn() }) }))
vi.mock('@/lib/appAccessGate', () => ({ isWorkspaceMembershipGateEnabled: () => true }))
vi.mock('@/lib/wacMembershipCache', () => ({ peekCachedSubjectMemberships: () => null, fetchSubjectMembershipsCached: api.memberships }))
vi.mock('@/components/loading', () => ({ PlatformRouteLoadingFallback: () => h('p', null, 'Loading') }))
vi.mock('@/modules/onboarding/components/CreatePersonalWorkspaceStep', () => ({ CreatePersonalWorkspaceStep: () => h('p', null, 'CREATE WORKSPACE FORM') }))
vi.mock('@/modules/onboarding/components/PersonalOnboardingStep', () => ({ PersonalOnboardingStep: () => h('p', null, 'PERSONAL FORM') }))
vi.mock('@/modules/onboarding/components/CorporateOptionalJoinStep', () => ({ CorporateOptionalJoinStep: () => h('p', null, 'OPTIONAL JOIN') }))
vi.mock('@/modules/onboarding/components/CorporateOrgReadyStep', () => ({ CorporateOrgReadyStep: () => h('p', null, 'ORG READY') }))
vi.mock('@/modules/onboarding/components/JoinWorkspaceStep', () => ({ JoinWorkspaceStep: () => h('p', null, 'JOIN') }))

let container: HTMLDivElement, root: Root, client: QueryClient
let mounts = 0
function Draft() {
  const [draft] = useState('Helpdesk draft')
  useEffect(() => { mounts += 1 }, [])
  return h('textarea', { defaultValue: draft })
}
function Location() { return h('output', null, useLocation().pathname + useLocation().search) }
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) }) }
async function render(path = '/w/alfa-irawan-ws/idea-backlog?draft=helpdesk', state?: unknown) {
  await act(async () => root.render(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [{ pathname: path.split('?')[0], search: path.includes('?') ? '?' + path.split('?')[1] : '', state }] }, h(Location), h(Routes, null,
    h(Route, { element: h(AppAccessGate) }, h(Route, { element: h(OnboardingGate) }, h(Route, { path: '/w/:slug/idea-backlog', element: h(Draft) }))),
    h(Route, { path: '/onboarding', element: h(OnboardingPage) }),
    h(Route, { path: '/onboarding/status', element: h(OnboardingStatusPage) }),
    h(Route, { path: '/no-workspace-access', element: h('p', null, 'NO ACCESS') }),
  )))))
  await settle()
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks(); sessionStorage.clear(); mounts = 0; api.subjectId = 'user-1'
  api.memberships.mockResolvedValue({ total: 1, items: [] })
  api.status.mockResolvedValue({ onboarding_status: 'active', active_membership_count: 1 })
  api.progress.mockResolvedValue({ matched: false, personal_workspace_created: false })
  api.resolve.mockResolvedValue({ matched: false, email_domain: 'company.test' })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } } })
})
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('real onboarding hooks and routes', () => {
  it.each(['/w/alfa-irawan-ws/idea-backlog', '/onboarding'])('membership timeout on %s is recoverable without onboarding', async path => {
    api.memberships.mockRejectedValue(new Error('membership timeout'))
    await render(path)
    expect(container.textContent).toContain('Workspace access temporarily unavailable')
    expect(container.textContent).not.toContain('CREATE WORKSPACE FORM')
    api.memberships.mockResolvedValue({ total: 1, items: [] })
    await act(async () => container.querySelector('button')!.click()); await settle()
    expect(container.querySelector('output')?.textContent).toBe('/w/alfa-irawan-ws/idea-backlog')
    expect(container.querySelector('textarea')).not.toBeNull()
  })
  it('keeps an active member on their workspace when directory progress fails', async () => {
    api.progress.mockRejectedValue(new Error('unavailable'))
    await render()
    expect(container.querySelector('textarea')).not.toBeNull()
    expect(container.querySelector('output')?.textContent).toContain('/w/alfa-irawan-ws/')
  })
  it('fails closed without redirecting or mounting the app on an initial status outage', async () => {
    api.status.mockRejectedValue(new Error('timeout'))
    await render()
    expect(container.textContent).toContain('Workspace access temporarily unavailable')
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.querySelector('output')?.textContent).toContain('/w/alfa-irawan-ws/')
    expect(api.create).not.toHaveBeenCalled()
  })
  it.each(['tectona-onboarding-status', 'tectona-app-memberships'])('preserves the mounted draft across %s failure and verified retry', async queryKey => {
    await render(); const draft = container.querySelector('textarea')!
    draft.value = 'Unsaved Helpdesk brainstorming'
    const fetcher = queryKey === 'tectona-app-memberships' ? api.memberships : api.status
    fetcher.mockRejectedValue(new Error('timeout'))
    await act(async () => { await client.invalidateQueries({ queryKey: [queryKey] }) }); await settle()
    expect(container.textContent).toContain('Workspace access temporarily unavailable')
    expect(draft.closest('[hidden][inert]')).not.toBeNull()
    fetcher.mockResolvedValue(queryKey === 'tectona-app-memberships' ? { total: 1, items: [] } : { onboarding_status: 'active', active_membership_count: 1 })
    await act(async () => container.querySelector('button')!.click()); await settle()
    expect(container.querySelector('textarea')).toBe(draft)
    expect(draft.value).toBe('Unsaved Helpdesk brainstorming')
    expect(draft.closest('[hidden]')).toBeNull(); expect(mounts).toBe(1)
  })
  it('does not keep access when membership retry confirms zero', async () => {
    await render()
    api.memberships.mockRejectedValue(new Error('timeout'))
    await act(async () => { await client.invalidateQueries({ queryKey: ['tectona-app-memberships'] }) }); await settle()
    api.memberships.mockResolvedValue({ total: 0, items: [] })
    await act(async () => container.querySelector('button')!.click()); await settle(); await settle()
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.textContent).toContain('NO ACCESS')
    expect(container.textContent).not.toContain('CREATE WORKSPACE FORM')
  })
  it('does not reuse the prior subject membership or mounted draft for a new identity', async () => {
    await render()
    api.subjectId = 'user-2'
    api.memberships.mockReturnValue(new Promise(() => {}))
    await render()
    expect(container.querySelector('textarea')).toBeNull()
    expect(api.memberships).toHaveBeenLastCalledWith('user-2', { activeOnly: true, force: true })
  })
  it('does not authorize from stale active status when retry confirms blocked', async () => {
    await render()
    api.status.mockRejectedValue(new Error('timeout'))
    await act(async () => { await client.invalidateQueries({ queryKey: ['tectona-onboarding-status'] }) }); await settle()
    api.status.mockResolvedValue({ onboarding_status: 'blocked', active_membership_count: 0 })
    await act(async () => container.querySelector('button')!.click()); await settle()
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.textContent).toContain('Request declined')
  })
  it.each(['none', 'corporate_setup_pending'])('retains genuine %s onboarding', async status => {
    api.status.mockResolvedValue({ onboarding_status: status, active_membership_count: 0 })
    await render(); await settle()
    expect(container.querySelector('output')?.textContent).toBe('/onboarding')
    expect(container.textContent).toContain('CREATE WORKSPACE FORM')
  })
  it.each(['/onboarding', '/onboarding/status'])('shows retry on %s and recovers to the original workspace', async path => {
    api.status.mockRejectedValue(new Error('timeout'))
    await render(path, { returnTo: '/w/alfa-irawan-ws/idea-backlog?draft=helpdesk' })
    expect(container.textContent).toContain('Workspace access temporarily unavailable')
    expect(container.textContent).not.toContain('CREATE WORKSPACE FORM')
    api.status.mockResolvedValue({ onboarding_status: 'active', active_membership_count: 1 })
    await act(async () => container.querySelector('button')!.click()); await settle()
    expect(container.querySelector('output')?.textContent).toBe('/w/alfa-irawan-ws/idea-backlog?draft=helpdesk')
  })
  it.each([null, {}, { onboarding_status: 'unknown' }])('fails closed for malformed status %j', async value => {
    api.status.mockResolvedValue(value)
    await render()
    expect(container.textContent).toContain('Workspace access temporarily unavailable')
    expect(container.querySelector('textarea')).toBeNull()
  })
  it('does not grant access from a corporate workspace-created flag without current membership', async () => {
    api.status.mockResolvedValue({ onboarding_status: 'join_pending', active_membership_count: 0, limited_shell_allowed: false })
    api.progress.mockResolvedValue({ matched: true, personal_workspace_created: true })
    await render()
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.textContent).toContain('Waiting for admin approval')
  })
  it('does not interpret missing corporate progress as unmatched', async () => {
    api.status.mockResolvedValue({ onboarding_status: 'none', active_membership_count: 0 })
    api.progress.mockResolvedValue(null)
    await render()
    expect(container.textContent).toContain('Workspace access temporarily unavailable')
    expect(container.textContent).not.toContain('CREATE WORKSPACE FORM')
  })
})

describe('corporate bootstrap recovery', () => {
  async function bootstrap(email = 'al@company.test') {
    await act(async () => root.render(h(CorporateOrganizationStep, { email, onBack: vi.fn(), onCreateOrgPersonal: api.create, onJoinSubmit: vi.fn(), onEmailVerificationReady: vi.fn(), onAdminApprovalPending: vi.fn(), onCorporateOnboardingComplete: vi.fn(), submitting: false, error: '' })))
  }
  it.each(['resolve', 'progress', 'status'] as const)('rejects malformed %s before presenting creation', async key => {
    api[key].mockResolvedValue({})
    await bootstrap()
    expect(container.textContent).toContain('Workspace access temporarily unavailable')
    expect(container.textContent).not.toContain('CREATE WORKSPACE FORM')
  })
  it('keeps creation hidden after timeout, ignores late responses, and supports retry', async () => {
    vi.useFakeTimers()
    let resolveOld!: (value: unknown) => void
    api.resolve.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
    await bootstrap()
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(container.textContent).toContain('Workspace access temporarily unavailable')
    expect(container.textContent).not.toContain('CREATE WORKSPACE FORM')
    api.status.mockResolvedValue({ onboarding_status: 'none', active_membership_count: 0 })
    await act(async () => { container.querySelector('button')!.click(); container.querySelector('button')?.click() })
    expect(container.textContent).toContain('CREATE WORKSPACE FORM')
    await act(async () => resolveOld({ matched: true, organization_name: 'Old response' }))
    expect(container.textContent).not.toContain('ORG READY')
    expect(api.create).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('ignores an obsolete email response and cleans timers on unmount', async () => {
    vi.useFakeTimers()
    let resolveOld!: (value: unknown) => void
    api.resolve.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
    api.status.mockResolvedValue({ onboarding_status: 'none', active_membership_count: 0 })
    await bootstrap(); await bootstrap('new@company.test')
    expect(container.textContent).toContain('CREATE WORKSPACE FORM')
    await act(async () => resolveOld({ matched: true }))
    expect(container.textContent).not.toContain('ORG READY')
    expect(vi.getTimerCount()).toBe(0)
    api.resolve.mockReturnValueOnce(new Promise(() => {}))
    await bootstrap('third@company.test')
    await act(async () => root.render(null))
    expect(vi.getTimerCount()).toBe(0)
  })
})

it('accepts internal return paths only, with a tenant-scoped fallback', () => {
  for (const returnTo of ['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/onboarding', '/login?next=bad', '/auth/callback']) {
    expect(onboardingReturnPath({ returnTo }, 'alfa-irawan-ws')).toBe('/w/alfa-irawan-ws/idea-backlog')
  }
  expect(onboardingReturnPath({ returnTo: '/w/alfa-irawan-ws/idea-backlog?draft=1#summary' })).toBe('/w/alfa-irawan-ws/idea-backlog?draft=1#summary')
})
