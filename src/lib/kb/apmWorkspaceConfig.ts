export function parseApmConnectedWorkspaceIds(raw?: string | null): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

/** Workspace IDs where Application Portfolio Monitoring (or equivalent) is the application SoR. */
export function readConfiguredApmWorkspaceIds(): Set<string> {
  const fromEnv = parseApmConnectedWorkspaceIds(import.meta.env.VITE_TECTONA_APM_WORKSPACE_IDS as string | undefined)
  if (typeof window === 'undefined') return fromEnv
  try {
    const stored = window.localStorage.getItem('tectona.apmConnectedWorkspaceIds')
    for (const id of parseApmConnectedWorkspaceIds(stored)) fromEnv.add(id)
  } catch {
    // Ignore storage access (private mode / SSR).
  }
  return fromEnv
}
