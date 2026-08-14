import { useEffect, useMemo, useState } from 'react'
import { getSession } from '@/auth/authService'
import { isWorkspaceMembershipGateEnabled } from '@/lib/appAccessGate'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import {
  fetchSubjectMembershipsCached,
  peekCachedSubjectMemberships,
} from '@/lib/wacMembershipCache'

export type AppAccessGateState = {
  loading: boolean
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

/**
 * Resolves whether the signed-in user may enter the Tectona application shell.
 * Platform admins bypass; others need ≥1 active WAC membership for Tectona app_id.
 */
export function useAppAccessGate(): AppAccessGateState {
  const session = getSession()
  const subjectId = session?.user.id
  const gateEnabled = isWorkspaceMembershipGateEnabled()

  const isPlatformAdmin = useMemo(
    () => hasPlatformAdminAccess(sessionRoles(), session?.user.role),
    [session?.user.role, session?.user.id],
  )

  const cachedMemberships = subjectId ? peekCachedSubjectMemberships(subjectId) : null

  const [loading, setLoading] = useState(
    gateEnabled && !isPlatformAdmin && Boolean(subjectId) && !cachedMemberships,
  )
  const [activeMembershipCount, setActiveMembershipCount] = useState(
    cachedMemberships?.total ?? 0,
  )

  useEffect(() => {
    if (!gateEnabled || isPlatformAdmin || !subjectId) {
      setLoading(false)
      setActiveMembershipCount(0)
      return
    }

    let cancelled = false
    const warm = peekCachedSubjectMemberships(subjectId)
    if (!warm) setLoading(true)

    void fetchSubjectMembershipsCached(subjectId, { activeOnly: true })
      .then((res) => {
        if (!cancelled) {
          setActiveMembershipCount(res.total)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveMembershipCount(0)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [gateEnabled, isPlatformAdmin, subjectId])

  const hasAppAccess = !gateEnabled || isPlatformAdmin || activeMembershipCount > 0

  return {
    loading,
    gateEnabled,
    hasAppAccess,
    activeMembershipCount,
  }
}
