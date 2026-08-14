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
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import {
  isWorkspaceListedForUser,
  persistAccessibleWorkspaceIds,
} from '@/lib/corporateWorkspaceAccess'
import type { TenantMode } from '@/lib/onboardingFeature'
import { isConsumerEmail } from '@/lib/onboardingFeature'
import { fetchAllWorkspaceOrgWorkspaces, fetchIdentityWorkspaceOrgMemberships, type WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { fetchSubjectMembershipsCached, invalidateSubjectMembershipsCache } from '@/lib/wacMembershipCache'
import {
  isWorkspaceDirectoryManagedRole,
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
    slug: workspace.slug ?? null,
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
  const isPlatformAdmin = hasPlatformAdminAccess(sessionRoles, session.user.role)
  const email = session.user.email?.trim().toLowerCase() ?? ''
  const isCorporateUser = Boolean(email) && !isConsumerEmail(email)

  const [memberships, workspaces, directoryMemberships] = await Promise.all([
    withTimeout(
      fetchSubjectMembershipsCached(session.user.id, { activeOnly: true }),
      WORKSPACE_OPTIONS_FETCH_TIMEOUT_MS,
      'Workspace memberships',
    ).catch(() => ({ items: [] as Awaited<ReturnType<typeof fetchSubjectMembershipsCached>>['items'] })),
    withTimeout(
      fetchAllWorkspaceOrgWorkspaces(),
      WORKSPACE_OPTIONS_FETCH_TIMEOUT_MS,
      'Workspace directory',
    ).catch(() => [] as WorkspaceOrgWorkspaceDto[]),
    fetchIdentityWorkspaceOrgMemberships(session.user.id).catch(
      () => [] as Awaited<ReturnType<typeof fetchIdentityWorkspaceOrgMemberships>>,
    ),
  ])

  const managedDirectoryWorkspaceIds = new Set(
    directoryMemberships
      .filter((row) => isWorkspaceDirectoryManagedRole(row.role_code))
      .map((row) => row.workspace_id)
      .filter(Boolean),
  )

  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  const seen = new Set<string>()
  const next: UserWorkspaceOption[] = []

  const pushWorkspace = (workspace: WorkspaceOrgWorkspaceDto) => {
    if (seen.has(workspace.id)) return
    seen.add(workspace.id)
    next.push(mapWorkspaceOption(workspace, workspaceById))
  }

  if (isPlatformAdmin) {
    for (const workspace of workspaces) {
      pushWorkspace(workspace)
    }
  } else {
    for (const membership of memberships.items ?? []) {
      const workspaceId = membership.workspace_id
      if (!workspaceId || seen.has(workspaceId)) continue

      const workspace = workspaceById.get(workspaceId)
      if (
        workspace &&
        !isWorkspaceListedForUser(workspace.tenant_mode ?? null, {
          isPlatformAdmin,
          isCorporateUser,
          hasActiveMembership: true,
          membershipParticipationScopeCode: membership.participation_scope_code,
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

    const subject = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }
    for (const workspace of workspaces) {
      if (seen.has(workspace.id)) continue
      const isOwner = isWorkspaceOwnedBySubject(
        {
          id: workspace.id,
          metadata: workspace.metadata,
          tenantMode: workspace.tenant_mode ?? null,
        },
        subject,
      )
      const hasDirectoryRole = managedDirectoryWorkspaceIds.has(workspace.id)
      if (!isOwner && !hasDirectoryRole) continue

      if (
        !isWorkspaceListedForUser(workspace.tenant_mode ?? null, {
          isPlatformAdmin,
          isCorporateUser,
          hasActiveMembership: hasDirectoryRole,
          isWorkspaceOwner: isOwner,
        })
      ) {
        continue
      }

      pushWorkspace(workspace)
    }
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
      void reload()
    }
    window.addEventListener('tectona:workspace-created', onWorkspaceDirectoryChanged)
    window.addEventListener('tectona:workspace-updated', onWorkspaceDirectoryChanged)
    window.addEventListener('tectona:workspace-deleted', onWorkspaceDirectoryChanged)
    const stopActive = onSessionActive(() => void reload())
    const stopCleared = onSessionCleared(() => {
      invalidateSubjectMembershipsCache()
      setOptions([])
      setLoading(false)
      setError(null)
    })
    const stopExpired = onSessionExpired(() => {
      invalidateSubjectMembershipsCache()
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
