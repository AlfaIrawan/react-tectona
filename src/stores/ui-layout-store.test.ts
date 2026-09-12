/**
 * The store's job is to make a layout survive reload without ever showing the
 * default first. These cover the three properties that make that true: the cache
 * answers synchronously, the server wins once it arrives, and one user's layout
 * never leaks into another's session.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/uiPreferencesApi', () => ({
  fetchUiPreferences: vi.fn(),
  patchUiPreferences: vi.fn(),
}))

import { fetchUiPreferences, patchUiPreferences } from '@/lib/api/uiPreferencesApi'
import {
  UI_SCOPE_DOCUMENT_KNOWLEDGE,
  UI_SCOPE_WORKSPACE,
  readRememberedWorkspace,
  setUiLayoutValue,
  useUiLayoutStore,
} from './ui-layout-store'

const USER = 'user-1'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  useUiLayoutStore.setState({ document: {}, identityRef: USER, hydratedFromServer: false })
})

describe('reading a stored value', () => {
  it('answers from the cache without waiting for the server', () => {
    useUiLayoutStore.setState({
      document: { [UI_SCOPE_DOCUMENT_KNOWLEDGE]: { showKpiCards: false } },
      identityRef: USER,
      hydratedFromServer: false,
    })

    // Synchronous: this is what prevents the page painting its default first.
    expect(useUiLayoutStore.getState().getValue(UI_SCOPE_DOCUMENT_KNOWLEDGE, 'showKpiCards', true)).toBe(false)
  })

  it('falls back to the page default when nothing is stored', () => {
    expect(useUiLayoutStore.getState().getValue(UI_SCOPE_DOCUMENT_KNOWLEDGE, 'showKpiCards', true)).toBe(true)
  })

  it('treats a stored false as a real value, not as missing', () => {
    useUiLayoutStore.setState({
      document: { [UI_SCOPE_DOCUMENT_KNOWLEDGE]: { showFiltersPanel: false } },
      identityRef: USER,
      hydratedFromServer: false,
    })
    expect(useUiLayoutStore.getState().getValue(UI_SCOPE_DOCUMENT_KNOWLEDGE, 'showFiltersPanel', true)).toBe(false)
  })
})

describe('writing', () => {
  it('is visible immediately and pushed to the server debounced', () => {
    setUiLayoutValue(UI_SCOPE_DOCUMENT_KNOWLEDGE, 'showKpiCards', false)

    expect(useUiLayoutStore.getState().document[UI_SCOPE_DOCUMENT_KNOWLEDGE].showKpiCards).toBe(false)
    expect(patchUiPreferences).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(patchUiPreferences).toHaveBeenCalledWith(USER, {
      [UI_SCOPE_DOCUMENT_KNOWLEDGE]: { showKpiCards: false },
    })
  })

  it('coalesces a burst of toggles into one request', () => {
    setUiLayoutValue(UI_SCOPE_DOCUMENT_KNOWLEDGE, 'showKpiCards', false)
    setUiLayoutValue(UI_SCOPE_DOCUMENT_KNOWLEDGE, 'showFiltersPanel', false)
    setUiLayoutValue(UI_SCOPE_WORKSPACE, 'lastWorkspaceId', 'ws-9')
    vi.advanceTimersByTime(1000)

    expect(patchUiPreferences).toHaveBeenCalledTimes(1)
    expect(patchUiPreferences).toHaveBeenCalledWith(USER, {
      [UI_SCOPE_DOCUMENT_KNOWLEDGE]: { showKpiCards: false, showFiltersPanel: false },
      [UI_SCOPE_WORKSPACE]: { lastWorkspaceId: 'ws-9' },
    })
  })

  it('does not call the server when nobody is signed in', () => {
    useUiLayoutStore.setState({ document: {}, identityRef: null, hydratedFromServer: false })
    setUiLayoutValue(UI_SCOPE_DOCUMENT_KNOWLEDGE, 'showKpiCards', false)
    vi.advanceTimersByTime(1000)

    expect(patchUiPreferences).not.toHaveBeenCalled()
  })
})

describe('hydrating from the server', () => {
  it('lets the server override the local cache', async () => {
    useUiLayoutStore.setState({
      document: { [UI_SCOPE_DOCUMENT_KNOWLEDGE]: { showKpiCards: true } },
      identityRef: USER,
      hydratedFromServer: false,
    })
    vi.mocked(fetchUiPreferences).mockResolvedValue({
      user_id: USER,
      preferences: { [UI_SCOPE_DOCUMENT_KNOWLEDGE]: { showKpiCards: false } },
      version: 4,
    })

    await useUiLayoutStore.getState().hydrateFromServer(USER)

    expect(useUiLayoutStore.getState().document[UI_SCOPE_DOCUMENT_KNOWLEDGE].showKpiCards).toBe(false)
    expect(useUiLayoutStore.getState().hydratedFromServer).toBe(true)
  })

  it('keeps scopes the server has never seen', async () => {
    useUiLayoutStore.setState({
      document: { [UI_SCOPE_WORKSPACE]: { lastWorkspaceId: 'ws-local' } },
      identityRef: USER,
      hydratedFromServer: false,
    })
    vi.mocked(fetchUiPreferences).mockResolvedValue({
      user_id: USER,
      preferences: { [UI_SCOPE_DOCUMENT_KNOWLEDGE]: { showKpiCards: false } },
      version: 1,
    })

    await useUiLayoutStore.getState().hydrateFromServer(USER)

    expect(useUiLayoutStore.getState().document[UI_SCOPE_WORKSPACE].lastWorkspaceId).toBe('ws-local')
  })

  it('keeps the cached layout usable when the endpoint is unreachable', async () => {
    useUiLayoutStore.setState({
      document: { [UI_SCOPE_DOCUMENT_KNOWLEDGE]: { showKpiCards: false } },
      identityRef: USER,
      hydratedFromServer: false,
    })
    vi.mocked(fetchUiPreferences).mockResolvedValue(null)

    await useUiLayoutStore.getState().hydrateFromServer(USER)

    expect(useUiLayoutStore.getState().document[UI_SCOPE_DOCUMENT_KNOWLEDGE].showKpiCards).toBe(false)
    expect(useUiLayoutStore.getState().hydratedFromServer).toBe(false)
  })
})

describe('switching user', () => {
  it('drops the previous layout and any unsent writes', () => {
    setUiLayoutValue(UI_SCOPE_DOCUMENT_KNOWLEDGE, 'showKpiCards', false)
    useUiLayoutStore.getState().resetForIdentity('user-2')
    vi.advanceTimersByTime(1000)

    expect(useUiLayoutStore.getState().document).toEqual({})
    // The pending write belonged to user-1 and must never land on user-2.
    expect(patchUiPreferences).not.toHaveBeenCalled()
  })
})

describe('remembered workspace', () => {
  it('returns null when nothing was ever chosen', () => {
    expect(readRememberedWorkspace()).toBeNull()
  })

  it('returns the last workspace with its mode', () => {
    useUiLayoutStore.setState({
      document: {
        [UI_SCOPE_WORKSPACE]: {
          lastWorkspaceId: 'ws-9',
          lastTenantMode: 'single',
          lastSelectedWorkspaceIds: ['ws-9'],
        },
      },
      identityRef: USER,
      hydratedFromServer: true,
    })

    expect(readRememberedWorkspace()).toEqual({
      workspaceId: 'ws-9',
      tenantMode: 'single',
      selectedWorkspaceIds: ['ws-9'],
    })
  })

  it('ignores a malformed stored value instead of returning a broken selection', () => {
    useUiLayoutStore.setState({
      document: { [UI_SCOPE_WORKSPACE]: { lastWorkspaceId: 42 } },
      identityRef: USER,
      hydratedFromServer: true,
    })
    expect(readRememberedWorkspace()).toBeNull()
  })
})
