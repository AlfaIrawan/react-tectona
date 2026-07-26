import { useEffect, useMemo, useState } from 'react'
import { getSession } from '@/auth/authService'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { fetchSubjectMemberships, TECTONA_WAC_APP_ID, wacRoleCodeToUiRole } from '@/lib/api/workspaceAccessControlApi'

export type ModuleId =
  | 'workspace'
  | 'project'
  | 'idea_backlog'
  | 'task_work'
  | 'planning'
  | 'workflow'
  | 'resource'
  | 'portfolio_governance'
  | 'enterprise_governance_model'
  | 'reporting'
  | 'document_knowledge'
  | 'integration_api'
  | 'security_access'
  | 'ai_project'
  | 'ai_idea'
  | 'platform_settings'

export type ModuleAccessState = {
  loading: boolean
  isPlatformAdmin: boolean
  maxWorkspaceRole: 'Admin' | 'Manager' | 'Member' | 'Viewer' | 'None'
  canAccess: (moduleId: ModuleId) => boolean
}

function sessionRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return session.user.roles
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
}

function roleRank(role: ModuleAccessState['maxWorkspaceRole']): number {
  switch (role) {
    case 'Admin':
      return 4
    case 'Manager':
      return 3
    case 'Member':
      return 2
    case 'Viewer':
      return 1
    default:
      return 0
  }
}

/**
 * Module access policy (production-like default):
 * - Root/Administrator bypass everything (platform admin).
 * - All other modules require at least one active WAC membership (AppAccessGate already enforces this).
 * - Workspace + Document/Knowledge require WAC role Admin/Manager (owner/admin/editor).
 * - Security & Access Control + Platform Settings require platform admin only.
 */
export function useModuleAccess(): ModuleAccessState {
  const session = getSession()
  const subjectId = session?.user.id

  const isPlatformAdmin = useMemo(
    () => hasPlatformAdminAccess(sessionRoles(), session?.user.role),
    [session?.user.id, session?.user.role],
  )

  const [loading, setLoading] = useState(!isPlatformAdmin && Boolean(subjectId))
  const [maxWorkspaceRole, setMaxWorkspaceRole] = useState<ModuleAccessState['maxWorkspaceRole']>('None')

  useEffect(() => {
    if (isPlatformAdmin || !subjectId) {
      setLoading(false)
      setMaxWorkspaceRole('None')
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchSubjectMemberships(TECTONA_WAC_APP_ID, subjectId, { activeOnly: true })
      .then((res) => {
        if (cancelled) return
        let max: ModuleAccessState['maxWorkspaceRole'] = 'None'
        for (const m of res.items ?? []) {
          const r = wacRoleCodeToUiRole(m.role_code)
          if (roleRank(r) > roleRank(max)) max = r
        }
        setMaxWorkspaceRole(max)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setMaxWorkspaceRole('None')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isPlatformAdmin, subjectId])

  const canAccess = useMemo(() => {
    return (moduleId: ModuleId) => {
      if (isPlatformAdmin) return true
      if (moduleId === 'security_access' || moduleId === 'platform_settings') return false

      const elevated = roleRank(maxWorkspaceRole) >= roleRank('Manager')
      if (moduleId === 'workspace' || moduleId === 'document_knowledge') return elevated

      // Default: allowed (AppAccessGate already requires membership).
      return true
    }
  }, [isPlatformAdmin, maxWorkspaceRole])

  return {
    loading,
    isPlatformAdmin,
    maxWorkspaceRole,
    canAccess,
  }
}

