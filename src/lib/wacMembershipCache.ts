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
const membershipInflight = new Map<string, Promise<WacMemberListResponse>>()
let membershipGeneration = 0

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
  membershipGeneration += 1
  membershipInflight.clear()
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

  // A forced refresh skips settled data, not an equivalent request already in flight.
  const key = JSON.stringify([TECTONA_WAC_APP_ID, subjectId, activeOnly])
  const inflight = membershipInflight.get(key)
  if (inflight) return inflight
  const generation = membershipGeneration

  const request = fetchSubjectMemberships(TECTONA_WAC_APP_ID, subjectId, { activeOnly })
    .then((response) => {
      if (generation !== membershipGeneration) {
        throw new Error('Workspace membership request invalidated.')
      }
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
      if (membershipInflight.get(key) === request) membershipInflight.delete(key)
    })

  membershipInflight.set(key, request)

  return request
}
