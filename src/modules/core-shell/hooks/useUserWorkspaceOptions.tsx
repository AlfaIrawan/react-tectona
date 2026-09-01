import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ensureFreshSession, getSession } from '@/auth/authService'
import { onSessionActive, onSessionCleared, onSessionExpired } from '@/auth/sessionEvents'
import { hasOrganizationAdminAccess } from '@/lib/auth/platformAccess'
import {
  canActivateWorkspaceAsTenant,
  isWorkspaceListedForUser,
  persistAccessibleWorkspaceIds,
} from '@/lib/corporateWorkspaceAccess'
import type { TenantMode } from '@/lib/onboardingFeature'
import { isConsumerEmail } from '@/lib/onboardingFeature'
import { type WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { fetchSubjectMembershipsCached, invalidateSubjectMembershipsCache } from '@/lib/wacMembershipCache'
import {
  fetchAllWorkspaceOrgWorkspacesCached,
  invalidateWorkspaceOrgDirectoryCache,
} from '@/lib/workspaceOrgDirectoryCache'
import { invalidateModuleAccessSnapshot } from '@/lib/moduleAccessSnapshot'
import {
  isOrganizationHomeWorkspace,
  isWorkspaceOwnedBySubject,
} from '@/lib/workspaceOwnershipVisibility'
import {
  isNestedOrgPersonalScope,
  resolvePersonalOrgScopeFromMetadata,
} from '@/lib/workspacePersonalOrgScope'

export type UserWorkspaceOption = {
  workspaceId: string
  workspaceName: string
  organizationId: string
  organizationName: string
  slug: string | null
  tenantMode: TenantMode | null
  parentWorkspaceId: string | null
  parentWorkspaceName: string | null
  isNestedOrgPersonal: boolean
  personalOrgScope: 'standalone' | 'organization_tree' | null
}

export type UserWorkspaceOptionsState = {
  options: UserWorkspaceOption[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  fallbackOrgName: string
}

const FALLBACK_ORG_NAME = 'Adira Dinamika Multifinance'
const WORKSPACE_OPTIONS_FETCH_TIMEOUT_MS = 20_000

const UserWorkspaceOptionsContext = createContext<UserWorkspaceOptionsState | null>(null)

function mapWorkspaceOption(
  workspace: WorkspaceOrgWorkspaceDto,
  workspaceById: Map<string, WorkspaceOrgWorkspaceDto>,
): UserWorkspaceOption {
  const meta =
    workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}
  const parentRaw = meta.parent_workspace_id
  const parentId =
    typeof parentRaw === 'string' && parentRaw.trim() ? parentRaw.trim() : null
  const parentWorkspace = parentId ? workspaceById.get(parentId) : undefined
  const personalOrgScope = resolvePersonalOrgScopeFromMetadata(meta, {
    tenantMode: workspace.tenant_mode,
    parentWorkspaceId: parentId,
  })
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    organizationId: workspace.organization_id,
    organizationName: workspace.organization_name?.trim() || FALLBACK_ORG_NAME,
    // Legacy operational workspaces may predate the slug column. Their
    // workspace key is stable and is accepted by the workspace-org resolver.
    slug: workspace.slug ?? workspace.workspace_key ?? null,
    tenantMode: workspace.tenant_mode ?? null,
    parentWorkspaceId: parentId,
    parentWorkspaceName: parentWorkspace?.name?.trim() || null,
    isNestedOrgPersonal: isNestedOrgPersonalScope(personalOrgScope, parentId),
    personalOrgScope,
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timer != null) clearTimeout(timer)
  }
}

async function loadUserWorkspaceOptions(): Promise<UserWorkspaceOption[]> {
  const session = (await ensureFreshSession()) ?? getSession()
  if (!session?.user.id) return []

  const sessionRoles = session.user.roles?.length
    ? session.user.roles
    : session.user.role === 'root'
      ? ['tectona_root']
      : session.user.role === 'admin'
        ? ['tectona_admin']
        : []
  const isOrganizationAdmin = hasOrganizationAdminAccess(sessionRoles)
  const email = session.user.email?.trim().toLowerCase() ?? ''
  const isCorporateUser = Boolean(email) && !isConsumerEmail(email)

  const [memberships, workspaces] = await Promise.all([
    withTimeout(
      // Workspace switching is an access boundary; do not reuse a stale WAC
      // membership snapshot after an admin grants or revokes access.
      fetchSubjectMembershipsCached(session.user.id, { activeOnly: true, force: true }),
      WORKSPACE_OPTIONS_FETCH_TIMEOUT_MS,
      'Workspace memberships',
    ).catch(() => ({ items: [] as Awaited<ReturnType<typeof fetchSubjectMembershipsCached>>['items'] })),
    withTimeout(
      fetchAllWorkspaceOrgWorkspacesCached(),
      WORKSPACE_OPTIONS_FETCH_TIMEOUT_MS,
      'Workspace directory',
    ).catch(() => [] as WorkspaceOrgWorkspaceDto[]),
  ])

  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  // fetchAllWorkspaceOrgWorkspaces() includes archived rows (the Directory
  // tree needs them for parent resolution) -- keep them in workspaceById for
  // name lookups, but never offer an archived workspace as a switchable option.
  const activeWorkspaces = workspaces.filter((workspace) => workspace.status_code !== 'archived')
  const seen = new Set<string>()
  const next: UserWorkspaceOption[] = []

  const pushWorkspace = (workspace: WorkspaceOrgWorkspaceDto) => {
    if (seen.has(workspace.id)) return
    seen.add(workspace.id)
    next.push(mapWorkspaceOption(workspace, workspaceById))
  }

  const subject = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  }
  const isOwnedBySubject = (workspace: WorkspaceOrgWorkspaceDto): boolean => {
    const metadata = workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}
    const metadataString = (key: string): string | null => {
      const value = metadata[key]
      return typeof value === 'string' && value.trim() ? value.trim() : null
    }
    return isWorkspaceOwnedBySubject(
      {
        id: workspace.id,
        metadata,
        createdBy: workspace.created_by ?? null,
        owner: metadataString('tectona_owner'),
        businessOwner: metadataString('tectona_business_owner'),
        technicalOwner: metadataString('tectona_technical_owner'),
        ownerIdentityRef: metadataString('tectona_owner_identity_ref'),
        createdByIdentityRef: metadataString('tectona_created_by_identity_ref'),
        tenantMode: workspace.tenant_mode ?? null,
      },
      subject,
    )
  }

  for (const membership of memberships.items ?? []) {
    const workspaceId = membership.workspace_id
    if (!workspaceId || seen.has(workspaceId)) continue

    const workspace = workspaceById.get(workspaceId)
    if (workspace?.status_code === 'archived') continue
    if (isOrganizationAdmin && workspace?.tenant_mode === 'personal' && !isOwnedBySubject(workspace)) continue
    if (
      workspace &&
      !isWorkspaceListedForUser(workspace.tenant_mode ?? null, {
        // The workspace switcher is user-scoped even for directory admins.
        // Administrative roles manage the directory; they do not broaden the
        // tenant list used for daily work and item creation.
        isPlatformAdmin: false,
        isOrganizationAdmin: false,
        isCorporateUser,
        hasActiveMembership: true,
        membershipParticipationScopeCode: membership.participation_scope_code,
        isOrganizationHomeWorkspace: isOrganizationHomeWorkspace(workspace),
      })
    ) {
      continue
    }

    seen.add(workspaceId)

    if (workspace) {
      next.push(mapWorkspaceOption(workspace, workspaceById))
      continue
    }

    next.push({
      workspaceId,
      workspaceName: workspaceId.slice(0, 8),
      organizationId: '',
      organizationName: FALLBACK_ORG_NAME,
      slug: null,
      tenantMode: null,
      parentWorkspaceId: null,
      parentWorkspaceName: null,
      isNestedOrgPersonal: false,
      personalOrgScope: null,
    })
  }

  for (const workspace of activeWorkspaces) {
    if (seen.has(workspace.id)) continue
    if (isOrganizationAdmin && workspace.tenant_mode === 'personal' && !isOwnedBySubject(workspace)) continue
    const isOwner = isOwnedBySubject(workspace)
    if (!isOwner) continue

    if (
      !canActivateWorkspaceAsTenant(workspace.tenant_mode ?? null, {
        isPlatformAdmin: false,
        isOrganizationAdmin: false,
        isCorporateUser,
        hasActiveMembership: false,
        isWorkspaceOwner: isOwner,
        isOrganizationHomeWorkspace: isOrganizationHomeWorkspace(workspace),
      })
    ) {
      continue
    }

    pushWorkspace(workspace)
  }

  next.sort((left, right) => {
    const orgCompare = left.organizationName.localeCompare(right.organizationName)
    if (orgCompare !== 0) return orgCompare
    if (left.tenantMode === 'personal' && right.tenantMode !== 'personal') return -1
    if (right.tenantMode === 'personal' && left.tenantMode !== 'personal') return 1
    return left.workspaceName.localeCompare(right.workspaceName)
  })

  persistAccessibleWorkspaceIds(next.map((option) => option.workspaceId))
  return next
}

export function isOrganizationWorkspaceOption(option: UserWorkspaceOption): boolean {
  return option.tenantMode !== 'personal'
}

export function defaultMultiSelectWorkspaceIds(options: UserWorkspaceOption[]): string[] {
  const orgIds = options.filter(isOrganizationWorkspaceOption).map((option) => option.workspaceId)
  if (orgIds.length > 0) return orgIds
  return options[0] ? [options[0].workspaceId] : []
}

export function resolveWorkspaceSwitcherCheckedIds(
  options: UserWorkspaceOption[],
  opts: {
    isMultiScope: boolean
    activeWorkspaceId: string | null
    selectedWorkspaceIds: string[]
  },
): Set<string> {
  if (options.length === 0) return new Set()

  if (opts.isMultiScope) {
    const fromTenant = opts.selectedWorkspaceIds.filter((id) =>
      options.some((option) => option.workspaceId === id),
    )
    if (fromTenant.length > 0) return new Set(fromTenant)
    return new Set(defaultMultiSelectWorkspaceIds(options))
  }

  if (
    opts.activeWorkspaceId
    && options.some((option) => option.workspaceId === opts.activeWorkspaceId)
  ) {
    return new Set([opts.activeWorkspaceId])
  }

  return new Set(defaultMultiSelectWorkspaceIds(options))
}

export function UserWorkspaceOptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<UserWorkspaceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reloadInFlightRef = useRef<Promise<void> | null>(null)

  const reload = useCallback(async () => {
    if (reloadInFlightRef.current) {
      await reloadInFlightRef.current
      return
    }

    const run = (async () => {
      const session = getSession()
      if (!session?.user.id) {
        setOptions([])
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const next = await loadUserWorkspaceOptions()
        setOptions(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workspaces')
        setOptions([])
      } finally {
        setLoading(false)
      }
    })()

    reloadInFlightRef.current = run
    try {
      await run
    } finally {
      reloadInFlightRef.current = null
    }
  }, [])

  useEffect(() => {
    void reload()
    const onWorkspaceDirectoryChanged = () => {
      invalidateWorkspaceOrgDirectoryCache()
      invalidateModuleAccessSnapshot()
      void reload()
    }
    window.addEventListener('tectona:workspace-created', onWorkspaceDirectoryChanged)
    window.addEventListener('tectona:workspace-updated', onWorkspaceDirectoryChanged)
    window.addEventListener('tectona:workspace-deleted', onWorkspaceDirectoryChanged)
    const stopActive = onSessionActive(() => void reload())
    const stopCleared = onSessionCleared(() => {
      invalidateSubjectMembershipsCache()
      invalidateWorkspaceOrgDirectoryCache()
      invalidateModuleAccessSnapshot()
      setOptions([])
      setLoading(false)
      setError(null)
    })
    const stopExpired = onSessionExpired(() => {
      invalidateSubjectMembershipsCache()
      invalidateWorkspaceOrgDirectoryCache()
      invalidateModuleAccessSnapshot()
      setOptions([])
      setLoading(false)
      setError(null)
    })
    return () => {
      window.removeEventListener('tectona:workspace-created', onWorkspaceDirectoryChanged)
      window.removeEventListener('tectona:workspace-updated', onWorkspaceDirectoryChanged)
      window.removeEventListener('tectona:workspace-deleted', onWorkspaceDirectoryChanged)
      stopActive()
      stopCleared()
      stopExpired()
    }
  }, [reload])

  const value = useMemo<UserWorkspaceOptionsState>(
    () => ({
      options,
      loading,
      error,
      reload,
      fallbackOrgName: FALLBACK_ORG_NAME,
    }),
    [options, loading, error, reload],
  )

  return (
    <UserWorkspaceOptionsContext.Provider value={value}>
      {children}
    </UserWorkspaceOptionsContext.Provider>
  )
}

export function useUserWorkspaceOptions(): UserWorkspaceOptionsState {
  const ctx = useContext(UserWorkspaceOptionsContext)
  if (!ctx) {
    throw new Error('useUserWorkspaceOptions must be used within UserWorkspaceOptionsProvider')
  }
  return ctx
}
