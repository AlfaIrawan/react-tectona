export type ModuleAccessSnapshot = {
  subjectId: string
  workspaceId: string | null
  tenantMode: string | null | undefined
  maxWorkspaceRole: 'Admin' | 'Manager' | 'Member' | 'Viewer' | 'None'
  canAccessSecurityAccess: boolean
}

let snapshot: ModuleAccessSnapshot | null = null

export function peekModuleAccessSnapshot(subjectId: string): ModuleAccessSnapshot | null {
  if (!snapshot || snapshot.subjectId !== subjectId) return null
  return snapshot
}

export function writeModuleAccessSnapshot(next: ModuleAccessSnapshot): void {
  snapshot = next
}

export function invalidateModuleAccessSnapshot(): void {
  snapshot = null
}
