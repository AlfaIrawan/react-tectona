import {
  fetchAllWorkspaceOrgWorkspaces,
  type WorkspaceOrgWorkspaceDto,
} from '@/lib/api/workspaceOrgApi'

const DIRECTORY_CACHE_TTL_MS = 45_000

type DirectoryCacheEntry = {
  items: WorkspaceOrgWorkspaceDto[]
  fetchedAt: number
}

let directoryCache: DirectoryCacheEntry | null = null
let directoryInflight: Promise<WorkspaceOrgWorkspaceDto[]> | null = null

export function peekCachedWorkspaceOrgDirectory(options?: {
  allowStale?: boolean
}): WorkspaceOrgWorkspaceDto[] | null {
  if (!directoryCache) return null
  if (!options?.allowStale && Date.now() - directoryCache.fetchedAt > DIRECTORY_CACHE_TTL_MS) {
    return null
  }
  return directoryCache.items
}

export function invalidateWorkspaceOrgDirectoryCache(): void {
  directoryCache = null
  directoryInflight = null
}

export async function fetchAllWorkspaceOrgWorkspacesCached(options?: {
  force?: boolean
}): Promise<WorkspaceOrgWorkspaceDto[]> {
  const force = options?.force === true
  if (!force) {
    const cached = peekCachedWorkspaceOrgDirectory()
    if (cached) return cached
    if (directoryInflight) return directoryInflight
  }

  const request = fetchAllWorkspaceOrgWorkspaces().then((items) => {
    directoryCache = { items, fetchedAt: Date.now() }
    return items
  }).finally(() => {
    if (directoryInflight === request) {
      directoryInflight = null
    }
  })

  if (!force) {
    directoryInflight = request
  }
  return request
}
