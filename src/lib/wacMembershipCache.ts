import {
  fetchSubjectMemberships,
  TECTONA_WAC_APP_ID,
  type WacMemberListResponse,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'

const MEMBERSHIP_CACHE_TTL_MS = 45_000

type MembershipCacheEntry = {
  subjectId: string
  items: WacMembershipDto[]
  total: number
  fetchedAt: number
}

let membershipCache: MembershipCacheEntry | null = null
let membershipInflight: Promise<WacMemberListResponse> | null = null

export function peekCachedSubjectMemberships(
  subjectId: string,
  options?: { allowStale?: boolean },
): WacMemberListResponse | null {
  if (!membershipCache) return null
  if (membershipCache.subjectId !== subjectId) return null
  if (!options?.allowStale && Date.now() - membershipCache.fetchedAt > MEMBERSHIP_CACHE_TTL_MS) {
    return null
  }
  return { items: membershipCache.items, total: membershipCache.total }
}

export function invalidateSubjectMembershipsCache(): void {
  membershipCache = null
  membershipInflight = null
}

export async function fetchSubjectMembershipsCached(
  subjectId: string,
  options?: { activeOnly?: boolean; force?: boolean },
): Promise<WacMemberListResponse> {
  const activeOnly = options?.activeOnly !== false
  const force = options?.force === true

  if (!force && activeOnly) {
    const cached = peekCachedSubjectMemberships(subjectId)
    if (cached) return cached
  }

  if (!force && membershipInflight) {
    return membershipInflight
  }

  const request = fetchSubjectMemberships(TECTONA_WAC_APP_ID, subjectId, { activeOnly })
    .then((response) => {
      if (activeOnly) {
        membershipCache = {
          subjectId,
          items: response.items ?? [],
          total: response.total ?? (response.items?.length ?? 0),
          fetchedAt: Date.now(),
        }
      }
      return response
    })
    .finally(() => {
      if (membershipInflight === request) {
        membershipInflight = null
      }
    })

  if (!force && activeOnly) {
    membershipInflight = request
  }

  return request
}
