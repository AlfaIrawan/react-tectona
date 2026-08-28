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
import { hasOrganizationAdminAccess, hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
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
  pickPreferredCorporateWorkspaceId,
} from '@/lib/corporateWorkspaceAccess'
import { dispatchTenantChanged } from '@/lib/tenantEvents'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'
import { fetchSubjectMemberships, TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'
import {
  fetchAllWorkspaceOrgWorkspaces,
} from '@/lib/api/workspaceOrgApi'
import {
  isOrganizationHomeWorkspace,
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

function sameTenantSelection(a: StoredTenantSelection, b: StoredTenantSelection): boolean {
  const aSelected = a.selectedWorkspaceIds ?? []
  const bSelected = b.selectedWorkspaceIds ?? []
  return (
    a.workspaceId === b.workspaceId
    && a.orgId === b.orgId
    && a.slug === b.slug
    && a.tenantMode === b.tenantMode
    && a.displayName === b.displayName
    && aSelected.length === bSelected.length
    && aSelected.every((id, index) => id === bSelected[index])
  )
}

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
  const isOrganizationAdmin = useMemo(
    () => hasOrganizationAdminAccess(sessionRoles()),
    [session?.user.id],
  )

  const [tenant, setTenant] = useState<StoredTenantSelection | null>(() => readStoredTenant())
  const [loading, setLoading] = useState(!tenant && Boolean(subjectId) && !isPlatformAdmin)
  const tenantRef = useRef<StoredTenantSelection | null>(tenant)
  tenantRef.current = tenant

  const setActiveTenant = useCallback((payload: StoredTenantSelection) => {
    const prev = tenantRef.current
    // Route guards and tenant hydration can rediscover the same tenant. Do not
    // publish a state change for an identical selection; doing so remounts
    // workspace-scoped consumers and causes their API queries to loop.
    if (prev && sameTenantSelection(prev, payload)) return
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
  if (tenant || !subjectId) {
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
        const accessible = isPlatformAdmin
          ? workspaces.map((workspace) => ({
              workspaceId: workspace.id,
              tenantMode: workspace.tenant_mode ?? null,
            }))
          : membershipRows
              .filter((row) => Boolean(row.workspace_id))
              .filter((row) => {
                const workspace = workspaceById.get(row.workspace_id)
                if (!workspace) return true
                return !isOrganizationWorkspaceHiddenByDefault(workspace.tenant_mode ?? null, {
                  isPlatformAdmin,
                  isOrganizationAdmin,
                  isCorporateUser,
                  hasActiveMembership: true,
                  membershipParticipationScopeCode: row.participation_scope_code,
                  isOrganizationHomeWorkspace: isOrganizationHomeWorkspace(workspace),
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
  }, [tenant, isPlatformAdmin, isOrganizationAdmin, isCorporateUser, subjectId, setActiveTenant])

  /** Legacy multi-workspace scope → collapse to a single active workspace. */
  useEffect(() => {
    // Root/admin users may intentionally operate in the federated "all
    // workspaces" scope. Collapsing that scope to the first workspace causes
    // the shell to bounce between `/projects` and `/w/:slug/projects`, which
    // remounts project consumers and repeats their API requests.
    if (!tenant || !isAllWorkspacesSelection(tenant.workspaceId) || isPlatformAdmin) return

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
  }, [tenant?.workspaceId, tenant?.selectedWorkspaceIds, isPlatformAdmin, setActiveTenant])

  useEffect(() => {
    if (!subjectId || !tenant?.workspaceId || isAllWorkspacesSelection(tenant.workspaceId)) {
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
      fetchAllWorkspaceOrgWorkspaces(),
    ])
      .then(([memberships, workspaces]) => {
        if (cancelled) return
        const match = workspaces.find((workspace) => workspace.id === tenant.workspaceId)
        if (!match) return

        const membershipRows = memberships.items ?? []
        const activeMembership = membershipRows.find((row) => row.workspace_id === tenant.workspaceId)
        const hasActiveMembership = Boolean(activeMembership)
        const isWorkspaceOwner = isWorkspaceOwnedBySubject(
          {
            id: match.id,
            metadata: match.metadata,
            createdBy: match.created_by ?? null,
            tenantMode: match.tenant_mode ?? null,
          },
          subject,
        )

        // Platform admins/root may open any workspace route (see evaluateWorkspaceSlugAccess,
        // which grants them access unconditionally). canActivateWorkspaceAsTenant only bypasses
        // membership checks for organization-mode workspaces, so without this early-out a root
        // user viewing another subject's personal workspace fails `mayActivate` here, gets reset
        // to `tenant = null` below, gets re-hydrated to a fallback workspace by the first effect,
        // and bounces forever while the URL still points at the original slug.
        const mayActivate = isPlatformAdmin || canActivateWorkspaceAsTenant(match.tenant_mode ?? null, {
          isPlatformAdmin,
          isOrganizationAdmin,
          isCorporateUser,
          hasActiveMembership,
          membershipParticipationScopeCode: activeMembership?.participation_scope_code,
          isWorkspaceOwner: isWorkspaceOwner,
          isOrganizationHomeWorkspace: isOrganizationHomeWorkspace(match),
        })

        if (!mayActivate) {
          const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
          const accessible = membershipRows
            .filter((row) => Boolean(row.workspace_id))
            .filter((row) => {
              const workspace = workspaceById.get(row.workspace_id)
              if (!workspace) return true
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
                isOrganizationAdmin,
                isCorporateUser,
                hasActiveMembership: true,
                membershipParticipationScopeCode: row.participation_scope_code,
                isWorkspaceOwner: rowOwner,
                isOrganizationHomeWorkspace: isOrganizationHomeWorkspace(workspace),
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
        // A workspace may legitimately have no tenant_mode. In that case
        // enrichment produces an equivalent object on every validation pass;
        // avoid publishing a new object and restarting the effect forever.
        if (sameTenantSelection(tenant, enriched)) return
        setTenant(enriched)
        persistTenant(enriched)
      })
      .catch(() => {
        // ignore — UI profile falls back until workspace metadata loads
      })

    return () => {
      cancelled = true
    }
  }, [tenant, isPlatformAdmin, isOrganizationAdmin, isCorporateUser, subjectId])

  /** Hydrate legacy tenant selections so legacy routes are redirected to `/w/:slug/*`. */
  useEffect(() => {
    if (!tenant || !tenant.workspaceId || isAllWorkspacesSelection(tenant.workspaceId) || tenant.slug?.trim()) return

    let cancelled = false
    void fetchAllWorkspaceOrgWorkspaces()
      .then((workspaces) => {
        if (cancelled) return
        const workspace = workspaces.find((item) => item.id === tenant.workspaceId)
        const slug = workspace?.slug?.trim() || workspace?.workspace_key?.trim()
        if (!workspace || !slug) return
        setActiveTenant({
          ...tenant,
          orgId: tenant.orgId ?? workspace.organization_id ?? null,
          slug,
          tenantMode: tenant.tenantMode ?? workspace.tenant_mode ?? null,
          displayName: tenant.displayName ?? workspace.name,
        })
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [tenant, setActiveTenant])

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
