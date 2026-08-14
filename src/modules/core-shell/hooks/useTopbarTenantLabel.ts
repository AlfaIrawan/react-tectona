import { useMemo } from 'react'
import { useTenantContext } from '@/auth/TenantContext'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'
import { useUserWorkspaceOptions, type UserWorkspaceOption } from './useUserWorkspaceOptions'

function isStandalonePersonalWorkspace(option: UserWorkspaceOption): boolean {
  return option.tenantMode === 'personal' && option.personalOrgScope === 'standalone'
}

export function resolveTopbarTenantLabel(
  activeOption: UserWorkspaceOption | null,
  opts: {
    isMultiWorkspaceScope: boolean
    displayName: string | null
  },
): string {
  if (opts.isMultiWorkspaceScope) {
    return opts.displayName?.trim() || 'Workspaces'
  }

  if (!activeOption) {
    return opts.displayName?.trim() || 'Workspace'
  }

  // Standalone personal — belum join organisasi.
  if (isStandalonePersonalWorkspace(activeOption)) {
    return activeOption.workspaceName
  }

  // Sudah join organisasi → nama organisasi, bukan nama workspace / parent workspace.
  if (activeOption.organizationName?.trim()) {
    return activeOption.organizationName.trim()
  }

  return activeOption.workspaceName
}

export function useTopbarTenantLabel(): { label: string; loading: boolean } {
  const { workspaceId, displayName } = useTenantContext()
  const { options, loading } = useUserWorkspaceOptions()

  const isMultiWorkspaceScope = isAllWorkspacesSelection(workspaceId)

  const activeOption = useMemo(() => {
    if (isMultiWorkspaceScope) return null
    if (workspaceId) {
      return options.find((option) => option.workspaceId === workspaceId) ?? null
    }
    return options[0] ?? null
  }, [isMultiWorkspaceScope, options, workspaceId])

  const label = useMemo(
    () =>
      resolveTopbarTenantLabel(activeOption, {
        isMultiWorkspaceScope,
        displayName,
      }),
    [activeOption, displayName, isMultiWorkspaceScope],
  )

  const showLoading = loading && !displayName?.trim() && options.length === 0

  return { label: label || displayName?.trim() || 'Workspace', loading: showLoading }
}
