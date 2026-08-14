import { useEffect, useRef } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getSession } from '@/auth/authService'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { clearTenantScopedClientData } from '@/lib/clearTenantScopedClientData'
import {
  clearStoredUserWorkspaceContext,
  persistStoredTenantSubjectId,
  readStoredTenantSubjectId,
} from '@/lib/storedUserWorkspaceContext'
import {
  TENANT_STORAGE_KEY,
  isConsumerEmail,
  type StoredTenantSelection,
} from '@/lib/onboardingFeature'
import { buildTenantUiProfile, type TenantUiProfile } from '@/lib/tenantUiProfile'
import {
  canActivateWorkspaceAsTenant,
  isOrganizationWorkspaceHiddenByDefault,
  membershipGrantsOrganizationWorkspaceSwitcherAccess,
  pickPreferredCorporateWorkspaceId,
} from '@/lib/corporateWorkspaceAccess'
import { dispatchTenantChanged } from '@/lib/tenantEvents'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'
import { fetchSubjectMemberships, TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'
import {
  fetchAllWorkspaceOrgWorkspaces,
  fetchIdentityWorkspaceOrgMemberships,
} from '@/lib/api/workspaceOrgApi'
import {
  isWorkspaceDirectoryManagedRole,
  isWorkspaceOwnedBySubject,
} from '@/lib/workspaceOwnershipVisibility'
import { useFolderStore } from '@/modules/projects/store/folderStore'
import { useProjectStore } from '@/modules/projects/store/projectStore'

export type TenantContextValue = {
  workspaceId: string | null
  orgId: string | null
  slug: string | null
  tenantMode: StoredTenantSelection['tenantMode']
  displayName: string | null
  /** Subset when multi-workspace scope is active (`workspaceId` = ALL). */
  selectedWorkspaceIds: string[]
  uiProfile: TenantUiProfile
  loading: boolean
  setActiveTenant: (payload: StoredTenantSelection) => void
  clearActiveTenant: () => void
}

const TenantContext = createContext<TenantContextValue | null>(null)

/** Stable fallback so `selectedWorkspaceIds` does not get a new `[]` every context recompute. */
const EMPTY_SELECTED_WORKSPACE_IDS: readonly string[] = []

function readStoredTenant(): StoredTenantSelection | null {
  try {
    const session = getSession()
    const boundSubjectId = readStoredTenantSubjectId()
    if (!session?.user.id || boundSubjectId !== session.user.id) {
      return null
    }
    const raw = sessionStorage.getItem(TENANT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredTenantSelection
  } catch {
    return null
  }
}

function persistTenant(payload: StoredTenantSelection | null): void {
  if (!payload) {
    sessionStorage.removeItem(TENANT_STORAGE_KEY)
    clearStoredUserWorkspaceContext()
    return
  }
  const session = getSession()
  if (session?.user.id) {
    persistStoredTenantSubjectId(session.user.id)
  }
  sessionStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(payload))
}

function sessionRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return session.user.roles
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
}

function resetTenantScopedStores(): void {
  clearTenantScopedClientData()
  useProjectStore.getState().clearLocalCache()
  useFolderStore.getState().clearLocalCache()
}

/** Clear project/folder caches only when the active tenant mode or primary workspace changes. */
function shouldResetTenantScopedStores(
  prev: StoredTenantSelection | null,
  next: StoredTenantSelection,
): boolean {
  if (!prev) return true
  const prevMulti = isAllWorkspacesSelection(prev.workspaceId)
  const nextMulti = isAllWorkspacesSelection(next.workspaceId)
  if (prevMulti !== nextMulti) return true
  if (!prevMulti && !nextMulti && prev.workspaceId !== next.workspaceId) return true
  return false
}

export function TenantContextProvider({ children }: { children: ReactNode }) {
  const session = getSession()
  const subjectId = session?.user.id
  const isPlatformAdmin = useMemo(
    () => hasPlatformAdminAccess(sessionRoles(), session?.user.role),
    [session?.user.id, session?.user.role],
  )

  const [tenant, setTenant] = useState<StoredTenantSelection | null>(() => readStoredTenant())
  const [loading, setLoading] = useState(!tenant && Boolean(subjectId) && !isPlatformAdmin)
  const tenantRef = useRef<StoredTenantSelection | null>(tenant)
  tenantRef.current = tenant

  const setActiveTenant = useCallback((payload: StoredTenantSelection) => {
    const prev = tenantRef.current
    if (shouldResetTenantScopedStores(prev, payload)) {
      resetTenantScopedStores()
    }
    tenantRef.current = payload
    setTenant(payload)
    persistTenant(payload)
    dispatchTenantChanged()
  }, [])

  const clearActiveTenant = useCallback(() => {
    resetTenantScopedStores()
    tenantRef.current = null
    setTenant(null)
    persistTenant(null)
    dispatchTenantChanged()
  }, [])

  const isCorporateUser = useMemo(() => {
    const email = session?.user.email?.trim().toLowerCase() ?? ''
    return Boolean(email) && !isConsumerEmail(email)
  }, [session?.user.email])

  useEffect(() => {
    if (tenant || isPlatformAdmin || !subjectId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void Promise.all([
      fetchSubjectMemberships(TECTONA_WAC_APP_ID, subjectId, { activeOnly: true }),
      fetchAllWorkspaceOrgWorkspaces(),
    ])
      .then(([memberships, workspaces]) => {
        if (cancelled) return
        const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
        const membershipRows = memberships.items ?? []
        const accessible = membershipRows
          .filter((row) => Boolean(row.workspace_id))
          .filter((row) => {
            const workspace = workspaceById.get(row.workspace_id)
            if (!workspace) return true
            return !isOrganizationWorkspaceHiddenByDefault(workspace.tenant_mode ?? null, {
              isPlatformAdmin,
              isCorporateUser,
              hasActiveMembership: true,
              membershipParticipationScopeCode: row.participation_scope_code,
            })
          })
          .map((row) => ({
            workspaceId: row.workspace_id,
            tenantMode: workspaceById.get(row.workspace_id)?.tenant_mode ?? null,
          }))

        const preferredId = pickPreferredCorporateWorkspaceId(accessible)
        const preferredWorkspace = preferredId ? workspaceById.get(preferredId) : undefined
        if (preferredId) {
          const fallback: StoredTenantSelection = {
            workspaceId: preferredId,
            orgId: preferredWorkspace?.organization_id ?? null,
            slug: preferredWorkspace?.slug ?? null,
            tenantMode: preferredWorkspace?.tenant_mode ?? null,
            displayName: preferredWorkspace?.name ?? null,
          }
          setActiveTenant(fallback)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tenant, isPlatformAdmin, isCorporateUser, subjectId, setActiveTenant])

  /** Platform admin/root: default to one org workspace so scoped pages do not load the full catalog. */
  useEffect(() => {
    if (!isPlatformAdmin || !subjectId || tenant?.workspaceId) {
      return
    }

    let cancelled = false
    void fetchAllWorkspaceOrgWorkspaces()
      .then((workspaces) => {
        if (cancelled || workspaces.length === 0) return
        const preferred =
          workspaces.find((workspace) => workspace.tenant_mode === 'organization')
          ?? workspaces.find((workspace) => workspace.tenant_mode !== 'personal')
          ?? workspaces[0]
        if (!preferred) return
        const fallback: StoredTenantSelection = {
          workspaceId: preferred.id,
          orgId: preferred.organization_id ?? null,
          slug: preferred.slug ?? null,
          tenantMode: preferred.tenant_mode ?? null,
          displayName: preferred.name,
        }
        setActiveTenant(fallback)
      })
      .catch(() => {
        // ignore — admin can pick workspace manually from switcher
      })

    return () => {
      cancelled = true
    }
  }, [isPlatformAdmin, subjectId, tenant?.workspaceId, setActiveTenant])

  /** Legacy multi-workspace scope → collapse to a single active workspace. */
  useEffect(() => {
    if (!tenant || !isAllWorkspacesSelection(tenant.workspaceId)) return

    let cancelled = false
    void fetchAllWorkspaceOrgWorkspaces()
      .then((workspaces) => {
        if (cancelled || workspaces.length === 0) return
        const selectedIds = (tenant.selectedWorkspaceIds ?? []).filter(Boolean)
        const preferredId =
          selectedIds.find((id) => workspaces.some((workspace) => workspace.id === id))
          ?? workspaces.find((workspace) => workspace.tenant_mode === 'organization')?.id
          ?? workspaces.find((workspace) => workspace.tenant_mode !== 'personal')?.id
          ?? workspaces[0]?.id
        const preferred = preferredId ? workspaces.find((workspace) => workspace.id === preferredId) : undefined
        if (!preferred) return
        setActiveTenant({
          workspaceId: preferred.id,
          orgId: preferred.organization_id ?? null,
          slug: preferred.slug ?? null,
          tenantMode: preferred.tenant_mode ?? null,
          displayName: preferred.name,
          selectedWorkspaceIds: undefined,
        })
      })
      .catch(() => {
        // ignore — user can pick workspace manually from switcher
      })

    return () => {
      cancelled = true
    }
  }, [tenant?.workspaceId, tenant?.selectedWorkspaceIds, setActiveTenant])

  useEffect(() => {
    if (isPlatformAdmin || !subjectId || !tenant?.workspaceId || isAllWorkspacesSelection(tenant.workspaceId)) {
      return
    }

    let cancelled = false
    const session = getSession()
    const subject = {
      id: subjectId,
      name: session?.user.name,
      email: session?.user.email,
    }

    void Promise.all([
      fetchSubjectMemberships(TECTONA_WAC_APP_ID, subjectId, { activeOnly: true }),
      fetchIdentityWorkspaceOrgMemberships(subjectId).catch(() => []),
      fetchAllWorkspaceOrgWorkspaces(),
    ])
      .then(([memberships, directoryMemberships, workspaces]) => {
        if (cancelled) return
        const match = workspaces.find((workspace) => workspace.id === tenant.workspaceId)
        if (!match) return

        const membershipRows = memberships.items ?? []
        const activeMembership = membershipRows.find((row) => row.workspace_id === tenant.workspaceId)
        const hasActiveMembership = Boolean(activeMembership)
        const hasDirectoryManagedRole = directoryMemberships.some(
          (row) =>
            row.workspace_id === tenant.workspaceId
            && isWorkspaceDirectoryManagedRole(row.role_code),
        )
        const isWorkspaceOwner = isWorkspaceOwnedBySubject(
          {
            id: match.id,
            metadata: match.metadata,
            createdBy: match.created_by ?? null,
            tenantMode: match.tenant_mode ?? null,
          },
          subject,
        )

        const mayActivate = canActivateWorkspaceAsTenant(match.tenant_mode ?? null, {
          isPlatformAdmin,
          isCorporateUser,
          hasActiveMembership,
          membershipParticipationScopeCode: activeMembership?.participation_scope_code,
          isWorkspaceOwner: isWorkspaceOwner || hasDirectoryManagedRole,
        })

        if (!mayActivate) {
          const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
          const accessible = membershipRows
            .filter((row) => Boolean(row.workspace_id))
            .filter((row) => {
              const workspace = workspaceById.get(row.workspace_id)
              if (!workspace) return true
              const rowDirectoryRole = directoryMemberships.some(
                (dir) =>
                  dir.workspace_id === row.workspace_id
                  && isWorkspaceDirectoryManagedRole(dir.role_code),
              )
              const rowOwner = isWorkspaceOwnedBySubject(
                {
                  id: workspace.id,
                  metadata: workspace.metadata,
                  createdBy: workspace.created_by ?? null,
                  tenantMode: workspace.tenant_mode ?? null,
                },
                subject,
              )
              return canActivateWorkspaceAsTenant(workspace.tenant_mode ?? null, {
                isPlatformAdmin,
                isCorporateUser,
                hasActiveMembership: true,
                membershipParticipationScopeCode: row.participation_scope_code,
                isWorkspaceOwner: rowOwner || rowDirectoryRole,
              })
            })
            .map((row) => ({
              workspaceId: row.workspace_id,
              tenantMode: workspaceById.get(row.workspace_id)?.tenant_mode ?? null,
            }))

          const preferredId = pickPreferredCorporateWorkspaceId(accessible)
          const preferredWorkspace = preferredId ? workspaceById.get(preferredId) : undefined
          if (!preferredWorkspace) {
            resetTenantScopedStores()
            setTenant(null)
            persistTenant(null)
            dispatchTenantChanged()
            return
          }

          resetTenantScopedStores()
          const replacement: StoredTenantSelection = {
            workspaceId: preferredWorkspace.id,
            orgId: preferredWorkspace.organization_id ?? null,
            slug: preferredWorkspace.slug ?? null,
            tenantMode: preferredWorkspace.tenant_mode ?? null,
            displayName: preferredWorkspace.name,
          }
          setTenant(replacement)
          persistTenant(replacement)
          dispatchTenantChanged()
          return
        }

        if (tenant.tenantMode) return

        const enriched: StoredTenantSelection = {
          ...tenant,
          tenantMode: match.tenant_mode ?? tenant.tenantMode,
          orgId: match.organization_id ?? tenant.orgId,
          slug: match.slug ?? tenant.slug,
          displayName: tenant.displayName ?? match.name,
        }
        setTenant(enriched)
        persistTenant(enriched)
      })
      .catch(() => {
        // ignore — UI profile falls back until workspace metadata loads
      })

    return () => {
      cancelled = true
    }
  }, [tenant, isPlatformAdmin, isCorporateUser, subjectId])

  const isAllWorkspaces = isAllWorkspacesSelection(tenant?.workspaceId)

  const uiProfile = useMemo(
    () =>
      buildTenantUiProfile({
        tenantMode: tenant?.tenantMode,
        isPlatformAdmin,
        isCorporateUser,
        isAllWorkspaces,
      }),
    [tenant?.tenantMode, tenant?.workspaceId, isPlatformAdmin, isCorporateUser, isAllWorkspaces],
  )

  const selectedWorkspaceIds = useMemo(
    (): string[] => tenant?.selectedWorkspaceIds ?? (EMPTY_SELECTED_WORKSPACE_IDS as string[]),
    [tenant?.selectedWorkspaceIds],
  )

  const value = useMemo<TenantContextValue>(
    () => ({
      workspaceId: tenant?.workspaceId ?? null,
      orgId: tenant?.orgId ?? null,
      slug: tenant?.slug ?? null,
      tenantMode: tenant?.tenantMode ?? null,
      displayName: tenant?.displayName ?? null,
      selectedWorkspaceIds,
      uiProfile,
      loading,
      setActiveTenant,
      clearActiveTenant,
    }),
    [tenant, selectedWorkspaceIds, uiProfile, loading, setActiveTenant, clearActiveTenant],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenantContext must be used within TenantContextProvider')
  }
  return ctx
}

/** Safe hook when provider may be absent (e.g. tests). */
export function useTenantContextOptional(): TenantContextValue | null {
  return useContext(TenantContext)
}
