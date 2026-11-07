import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getSession } from '@/auth/authService'
import { onSessionActive, onSessionCleared } from '@/auth/sessionEvents'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { isOnboardingEnabled } from '@/lib/onboardingFeature'
import { fetchOnboardingStatus } from '@/lib/api/onboardingApi'
import type { OnboardingStatusCode as OnboardingStatus } from '@/lib/api/workspaceAccessControlApi'
import { TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'

function sessionRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return session.user.roles
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
}

export type OnboardingStatusState = {
  loading: boolean
  retrying: boolean
  enabled: boolean
  bypass: boolean
  status: OnboardingStatus | null
  statusUnavailable: boolean
  activeMembershipCount: number
  pendingRequestId: string | null
  limitedShellAllowed: boolean
  activeWorkspaceId: string | null
  refetch: () => void
}

export function useOnboardingStatus(): OnboardingStatusState {
  const session = getSession()
  const subjectId = session?.user.id
  const enabled = isOnboardingEnabled()
  const bypass = hasPlatformAdminAccess(sessionRoles(), session?.user.role)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['tectona-onboarding-status', subjectId],
    queryFn: () => fetchOnboardingStatus(TECTONA_WAC_APP_ID, subjectId!),
    // A cookie session has a user id and no JavaScript token. The browser still
    // sends the cookie, and the dev proxy copies it into Authorization.
    enabled: enabled && !bypass && Boolean(subjectId),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })

  useEffect(() => {
    const refreshOnboardingQueries = () => {
      if (!getSession()?.user?.id) return
      void queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
      void queryClient.invalidateQueries({ queryKey: ['corporate-onboarding-progress'] })
    }
    const clearOnboardingQueries = () => {
      void queryClient.cancelQueries({ queryKey: ['tectona-onboarding-status'] })
      void queryClient.cancelQueries({ queryKey: ['corporate-onboarding-progress'] })
      queryClient.removeQueries({ queryKey: ['tectona-onboarding-status'] })
      queryClient.removeQueries({ queryKey: ['corporate-onboarding-progress'] })
    }
    const unsubActive = onSessionActive(refreshOnboardingQueries)
    const unsubCleared = onSessionCleared(clearOnboardingQueries)
    return () => {
      unsubActive()
      unsubCleared()
    }
  }, [queryClient])

  if (!enabled || bypass) {
    return {
      loading: false,
      retrying: false,
      enabled,
      bypass,
      status: 'active',
      statusUnavailable: false,
      activeMembershipCount: 1,
      pendingRequestId: null,
      limitedShellAllowed: false,
      activeWorkspaceId: null,
      refetch: () => undefined,
    }
  }

  const knownStatuses: readonly string[] = ['none', 'personal_provisioning', 'corporate_setup_pending', 'active', 'join_pending', 'email_verify_pending', 'blocked']
  const status = query.data?.onboarding_status
  const statusValid = typeof status === 'string' && knownStatuses.includes(status)
  const statusUnavailable = query.isError || (query.isFetched && !statusValid && !query.isLoading)

  return {
    retrying: query.isFetching,
    loading: query.isLoading || (query.isFetching && !query.isFetched),
    enabled,
    bypass,
    status: statusValid ? status! : null,
    statusUnavailable,
    activeMembershipCount: query.data?.active_membership_count ?? 0,
    pendingRequestId: query.data?.pending_request_id ?? null,
    limitedShellAllowed: query.data?.limited_shell_allowed === true,
    activeWorkspaceId: query.data?.active_workspace_id ?? null,
    refetch: () => {
      void query.refetch({ cancelRefetch: false })
    },
  }
}
