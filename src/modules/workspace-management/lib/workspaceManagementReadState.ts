type ReadStatus = 'loading' | 'ready' | 'error'
export type WorkspaceReadState = { status: ReadStatus; reason?: string }

/** Keep remote error bodies (which can contain infrastructure or user data) out of the UI. */
export function workspaceReadStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
    return error.status
  }
  if (error instanceof Error) {
    const match = /\bHTTP\s+([45]\d{2})\b/i.exec(error.message)
    if (match) return Number(match[1])
  }
  return undefined
}

export function workspaceReadFailure(service: string, error: unknown): WorkspaceReadState {
  const status = workspaceReadStatus(error)
  if (status === 401) return { status: 'error', reason: 'Your session could not be verified. Sign in again and retry.' }
  if (status === 403) return { status: 'error', reason: 'You do not have permission to load this data.' }
  if (status === 429) return { status: 'error', reason: `${service} is receiving too many requests (HTTP 429). Wait a moment, then try again.` }
  if (status !== undefined) {
    const onboarding = service === 'Workspace Directory' && status === 500
      && error instanceof Error && error.message.trim().toLowerCase() === 'workspace onboarding failed'
    return { status: 'error', reason: onboarding
      ? 'Workspace onboarding failed (HTTP 500).'
      : `${service} could not complete the request (HTTP ${status}).` }
  }
  if (error instanceof TypeError || (error instanceof Error && /^(network request failed|failed to fetch|load failed|networkerror)/i.test(error.message))) {
    return { status: 'error', reason: `${service} could not be reached. Check your connection and try again.` }
  }
  return { status: 'error', reason: `${service} returned an unexpected response. Try again.` }
}

export function countWorkspaceMemberships(
  workspaceIds: readonly string[],
  counts: Readonly<Record<string, number>>,
): number | null {
  const ids = [...new Set(workspaceIds)]
  if (ids.some((id) => counts[id] === undefined)) return null
  return ids.reduce((total, id) => total + counts[id], 0)
}

export function createWorkspaceReadQueue<T>(load: (id: string) => Promise<T>, limit = 4) {
  let active = 0
  const queue: Array<() => void> = []
  const inFlight = new Map<string, Promise<T>>()
  return (id: string): Promise<T> => {
    const existing = inFlight.get(id)
    if (existing) return existing
    const pending = new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1
        void Promise.resolve().then(() => load(id)).then(resolve, reject).finally(() => {
          active -= 1
          inFlight.delete(id)
          queue.shift()?.()
        })
      }
      if (active < limit) start()
      else queue.push(start)
    })
    inFlight.set(id, pending)
    return pending
  }
}
