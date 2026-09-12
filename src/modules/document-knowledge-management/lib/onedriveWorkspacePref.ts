/** Per-user, per-workspace opt-in to show OneDrive in Document Repository. */

const STORAGE_PREFIX = 'tectona:onedrive-workspace-connect'

export function onedriveWorkspaceConnectKey(userId: string, workspaceId: string): string {
  return `${STORAGE_PREFIX}:${userId}:${workspaceId}`
}

export function readOnedriveWorkspaceConnected(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
): boolean {
  if (!userId?.trim() || !workspaceId?.trim()) return false
  try {
    return localStorage.getItem(onedriveWorkspaceConnectKey(userId, workspaceId)) === '1'
  } catch {
    return false
  }
}

export function writeOnedriveWorkspaceConnected(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
  connected: boolean,
): void {
  if (!userId?.trim() || !workspaceId?.trim()) return
  try {
    const key = onedriveWorkspaceConnectKey(userId, workspaceId)
    if (connected) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // ignore quota / private mode
  }
}
