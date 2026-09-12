/**
 * Per-user layout preferences that survive reload, restart, and device.
 *
 * Two storage layers on purpose:
 *
 *  - localStorage (via zustand `persist`) is the **hydration cache**. It is read
 *    synchronously on the first render, so a page never paints its default layout
 *    and then snap to the saved one a moment later. That flash is worse than not
 *    persisting at all, because it looks like the app forgot.
 *  - identity-lite is the **system of record**. It arrives a moment later and wins,
 *    which is what makes a preference follow the user to another machine.
 *
 * Writes go to localStorage immediately and to the backend debounced, and the
 * backend merge is per-scope, so a tab sitting on one page can never erase the
 * preferences another tab saved for a different page.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  fetchUiPreferences,
  patchUiPreferences,
  type UiPreferenceDocument,
} from '@/lib/api/uiPreferencesApi'

/** Scope names are part of the stored contract — renaming one discards its settings. */
export const UI_SCOPE_SHELL = 'shell'
export const UI_SCOPE_WORKSPACE = 'workspace'
export const UI_SCOPE_DOCUMENT_KNOWLEDGE = 'document-knowledge-management'

const PUSH_DEBOUNCE_MS = 800

interface UiLayoutState {
  document: UiPreferenceDocument
  /** Identity the cached document belongs to; guards against showing another user's layout. */
  identityRef: string | null
  hydratedFromServer: boolean
  setValue: (scope: string, key: string, value: unknown) => void
  getValue: <T>(scope: string, key: string, fallback: T) => T
  hydrateFromServer: (identityRef: string) => Promise<void>
  resetForIdentity: (identityRef: string | null) => void
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
let pendingPatch: UiPreferenceDocument = {}

function schedulePush(identityRef: string | null) {
  if (!identityRef) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    const patch = pendingPatch
    pendingPatch = {}
    pushTimer = null
    if (Object.keys(patch).length === 0) return
    // Failure is deliberately silent: the value is already in localStorage, so the
    // user keeps their layout on this device and the next write retries the sync.
    void patchUiPreferences(identityRef, patch)
  }, PUSH_DEBOUNCE_MS)
}

export const useUiLayoutStore = create<UiLayoutState>()(
  persist(
    (set, get) => ({
      document: {},
      identityRef: null,
      hydratedFromServer: false,

      setValue: (scope, key, value) => {
        set((state) => {
          const nextScope = { ...(state.document[scope] ?? {}), [key]: value }
          return { document: { ...state.document, [scope]: nextScope } }
        })
        pendingPatch = {
          ...pendingPatch,
          [scope]: { ...(pendingPatch[scope] ?? {}), [key]: value },
        }
        schedulePush(get().identityRef)
      },

      getValue: (scope, key, fallback) => {
        const stored = get().document[scope]?.[key]
        return (stored === undefined ? fallback : stored) as typeof fallback
      },

      hydrateFromServer: async (identityRef) => {
        const response = await fetchUiPreferences(identityRef)
        if (!response) {
          // Offline or endpoint unavailable — keep the local cache and stay usable.
          set({ identityRef, hydratedFromServer: false })
          return
        }
        set((state) => ({
          identityRef,
          hydratedFromServer: true,
          // Server wins per scope, but locally-known scopes the server has never seen
          // are kept so a first sync does not discard what this device just learned.
          document: { ...state.document, ...response.preferences },
        }))
      },

      resetForIdentity: (identityRef) => {
        if (pushTimer) {
          clearTimeout(pushTimer)
          pushTimer = null
        }
        pendingPatch = {}
        set({ document: {}, identityRef, hydratedFromServer: false })
      },
    }),
    {
      name: 'tectona:ui-layout',
      partialize: (state) => ({ document: state.document, identityRef: state.identityRef }),
    },
  ),
)

/**
 * Reads a stored layout value, falling back to the page's own default.
 *
 * Selector-based so a component re-renders when its own key changes and not when
 * an unrelated page writes one.
 */
export function useUiLayoutValue<T>(scope: string, key: string, fallback: T): T {
  return useUiLayoutStore((state) => {
    const stored = state.document[scope]?.[key]
    return (stored === undefined ? fallback : stored) as T
  })
}

export function setUiLayoutValue(scope: string, key: string, value: unknown): void {
  useUiLayoutStore.getState().setValue(scope, key, value)
}

/**
 * Drop-in replacement for `useState<boolean>` on a layout toggle: same tuple shape,
 * so a page keeps its existing call sites and only its storage changes.
 */
export function useUiLayoutBoolean(
  scope: string,
  key: string,
  fallback: boolean,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const value = useUiLayoutValue(scope, key, fallback)
  const setValue = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(value) : next
    setUiLayoutValue(scope, key, resolved)
  }
  return [value, setValue]
}

/**
 * The workspace a user last chose, restored only when a tab has no selection of its
 * own. Tabs keep independent workspaces for the life of a session; this is what
 * makes a brand-new tab — or a new machine — open where the user left off instead
 * of falling back to the default workspace.
 */
export function readRememberedWorkspace(): {
  workspaceId: string
  tenantMode?: string
  selectedWorkspaceIds?: string[]
} | null {
  const scope = useUiLayoutStore.getState().document[UI_SCOPE_WORKSPACE]
  const workspaceId = scope?.lastWorkspaceId
  if (typeof workspaceId !== 'string' || !workspaceId) return null
  const tenantMode = scope?.lastTenantMode
  const selectedWorkspaceIds = scope?.lastSelectedWorkspaceIds
  return {
    workspaceId,
    ...(typeof tenantMode === 'string' ? { tenantMode } : {}),
    ...(Array.isArray(selectedWorkspaceIds) ? { selectedWorkspaceIds: selectedWorkspaceIds as string[] } : {}),
  }
}
