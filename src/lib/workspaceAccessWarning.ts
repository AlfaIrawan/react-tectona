export type WorkspaceAccessDependency = 'workspace-directory' | 'workspace-access' | 'identity' | 'unknown'

export class WorkspaceApiError extends Error {
  readonly status: number
  readonly workspaceSlugNotFound: boolean

  constructor(status: number, detail: string, workspaceSlugNotFound = false) {
    super(detail)
    this.name = 'WorkspaceApiError'
    this.status = status
    this.workspaceSlugNotFound = workspaceSlugNotFound
  }
}

export function trustedSupportPortalUrl(configured: string | undefined, appOrigin: string): string | null {
  if (!configured?.trim()) return null
  try {
    const url = new URL(configured.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || url.hostname.toLowerCase() === new URL(appOrigin).hostname.toLowerCase()) return null
    return url.href
  } catch {
    return null
  }
}
