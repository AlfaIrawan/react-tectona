import { isFolderInSamplesTree, isSamplesRootFolder } from '@/modules/document-knowledge-management/lib/samplesFolder'
import { buildRepositoryFolderPathNames } from '@/lib/kb/repositoryMemoFromDocument'

export const SAMPLES_SHARE_DESCRIPTION_PREFIX = 'tectona_samples_share:'

export type SampleShareWorkspaceTarget = {
  id: string
  name: string
  organizationId: string
  tenantMode?: string | null
}

export function parseSamplesShareWorkspaceIds(description: string | null | undefined): string[] {
  const raw = (description || '').trim()
  if (!raw.startsWith(SAMPLES_SHARE_DESCRIPTION_PREFIX)) return []
  try {
    const parsed = JSON.parse(raw.slice(SAMPLES_SHARE_DESCRIPTION_PREFIX.length)) as { workspace_ids?: unknown }
    if (!Array.isArray(parsed.workspace_ids)) return []
    return [...new Set(parsed.workspace_ids.map((id) => String(id).trim()).filter(Boolean))]
  } catch {
    return []
  }
}

export function buildSamplesShareFolderDescription(workspaceIds: readonly string[]): string {
  const ids = [...new Set(workspaceIds.map((id) => id.trim()).filter(Boolean))]
  return `${SAMPLES_SHARE_DESCRIPTION_PREFIX}${JSON.stringify({ workspace_ids: ids })}`
}

/** Folder names under Samples (excluding the Samples root). Empty = file/folder at Samples root. */
export function samplesRelativeFolderNames(
  folderId: string | null | undefined,
  folders: ReadonlyArray<{ id: string; name: string; parent_id?: string | null }>,
): string[] | null {
  if (!folderId) return null
  if (!isFolderInSamplesTree(folderId, folders)) return null
  const folder = folders.find((item) => item.id === folderId)
  if (folder && isSamplesRootFolder(folder)) return []
  const names = buildRepositoryFolderPathNames(folders, folderId)
  const samplesAt = names.findIndex((name) => {
    const lower = name.trim().toLowerCase()
    return lower === 'samples' || lower === 'sample'
  })
  return samplesAt >= 0 ? names.slice(samplesAt + 1) : names
}

export function listNonPersonalSampleShareTargets(input: {
  currentWorkspaceId: string | null
  organizationId: string | null
  workspaces: readonly SampleShareWorkspaceTarget[]
}): SampleShareWorkspaceTarget[] {
  const current = (input.currentWorkspaceId || '').trim()
  const orgId = (input.organizationId || '').trim()
  return input.workspaces.filter((workspace) => {
    if (!workspace.id || workspace.id === current) return false
    if ((workspace.tenantMode || '').toLowerCase() === 'personal') return false
    if (orgId && workspace.organizationId !== orgId) return false
    return true
  })
}

export function collectDescendantFolderIds(
  rootFolderId: string,
  folders: ReadonlyArray<{ id: string; parent_id?: string | null }>,
): string[] {
  const ids = new Set<string>([rootFolderId])
  let grew = true
  while (grew) {
    grew = false
    for (const folder of folders) {
      if (ids.has(folder.id)) continue
      if (folder.parent_id && ids.has(folder.parent_id)) {
        ids.add(folder.id)
        grew = true
      }
    }
  }
  return [...ids]
}
