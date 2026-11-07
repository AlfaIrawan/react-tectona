import { useQuery } from '@tanstack/react-query'
import { getSession } from '@/auth/authService'
import { isWorkspaceMembershipGateEnabled } from '@/lib/appAccessGate'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import {
  fetchSubjectMembershipsCached,
} from '@/lib/wacMembershipCache'

export type AppAccessGateState = {
  loading: boolean
  retrying: boolean
  statusUnavailable: boolean
  refetch: () => void
  gateEnabled: boolean
  hasAppAccess: boolean
  activeMembershipCount: number
}

function sessionRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return session.user.roles
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
}

/** Workspace membership is verified independently of onboarding progress. */
export function useAppAccessGate(): AppAccessGateState {
  const session = getSession()
  const subjectId = session?.user.id
  const gateEnabled = isWorkspaceMembershipGateEnabled()
  const isPlatformAdmin = hasPlatformAdminAccess(sessionRoles(), session?.user.role)
  const checkRequired = gateEnabled && !isPlatformAdmin
  const query = useQuery({
    queryKey: ['tectona-app-memberships', subjectId],
    queryFn: async () => {
      const result = await fetchSubjectMembershipsCached(subjectId!, { activeOnly: true, force: true })
      if (!Number.isFinite(result?.total) || result.total < 0) {
        throw new Error('Workspace membership status unavailable.')
      }
      return result
    },
    enabled: checkRequired && Boolean(subjectId),
    staleTime: 0,
    retry: 1,
  })
  const statusUnavailable = checkRequired && (
    !subjectId || query.isError || (query.isFetched && !query.data)
  )
  const activeMembershipCount = query.data?.total ?? 0
  return {
    loading: checkRequired && query.isLoading,
    retrying: checkRequired && query.isFetching,
    statusUnavailable,
    refetch: () => { void query.refetch({ cancelRefetch: false }) },
    gateEnabled,
    hasAppAccess: !checkRequired || (!statusUnavailable && activeMembershipCount > 0),
    activeMembershipCount,
  }
}
