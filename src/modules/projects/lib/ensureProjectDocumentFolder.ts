import {
  createDocumentFolder,
  deleteDocumentFolder,
  fetchAllDocumentFolders,
  getDocumentFolder,
  updateDocumentFolder,
} from '@/lib/api/documentFolderApi'
import { useProjectDocumentFolderStore } from '../store/projectDocumentFolderStore'
import {
  buildProjectDocumentFolderDescription,
  buildProjectDocumentFolderName,
  parseProjectIdFromDocumentFolderDescription,
} from './projectDocumentFolder'

export async function ensureProjectDocumentFolder(project: {
  id: string
  name: string
}): Promise<string> {
  const store = useProjectDocumentFolderStore.getState()
  const cachedFolderId = store.getFolderId(project.id)
  const folderName = buildProjectDocumentFolderName(project.name)

  if (cachedFolderId) {
    const existing = await getDocumentFolder(cachedFolderId)
    if (existing) {
      const linkedProjectId = parseProjectIdFromDocumentFolderDescription(existing.description)
      if (linkedProjectId && linkedProjectId !== project.id) {
        // A stale persisted mapping must never make a new project reuse another
        // project's repository folder.
        store.removeFolderMapping(project.id)
      } else {
      if (existing.name !== folderName) {
        try {
          await updateDocumentFolder(existing.id, { name: folderName })
        } catch {
          // Name sync is best-effort; folder mapping remains valid.
        }
      }
      return existing.id
      }
    }
    store.removeFolderMapping(project.id)
  }

  const folders = await fetchAllDocumentFolders()
  const matched = folders.find(
    (folder) => parseProjectIdFromDocumentFolderDescription(folder.description) === project.id,
  )
  if (matched) {
    store.setFolderMapping(project.id, matched.id)
    if (matched.name !== folderName) {
      try {
        await updateDocumentFolder(matched.id, { name: folderName })
      } catch {
        // best-effort
      }
    }
    return matched.id
  }

  // Orphaned-folder fallback: a root folder can carry the same name but reference a
  // project id that no longer resolves to this project (e.g. the project was deleted
  // and recreated with a new id). Creating a new folder would collide on the unique
  // name, so re-adopt the stale folder for the current project instead. Matches both
  // the current "Project {name}" convention and the legacy bare-name convention.
  const nameCollision = folders.find(
    (folder) =>
      folder.parent_id === null &&
      (folder.name.toLowerCase() === folderName.toLowerCase() ||
        folder.name.toLowerCase() === project.name.toLowerCase()),
  )
  if (nameCollision) {
    store.setFolderMapping(project.id, nameCollision.id)
    try {
      await updateDocumentFolder(nameCollision.id, {
        name: folderName,
        description: buildProjectDocumentFolderDescription(project.id),
      })
    } catch {
      // best-effort; mapping is still usable even if the description repair fails.
    }
    return nameCollision.id
  }

  const created = await createDocumentFolder({
    name: folderName,
    description: buildProjectDocumentFolderDescription(project.id),
    parent_id: null,
  })
  store.setFolderMapping(project.id, created.id)
  return created.id
}

/** Removes the project-linked repository folder and any nested folders. */
export async function deleteProjectDocumentFolder(projectId: string): Promise<void> {
  const store = useProjectDocumentFolderStore.getState()
  const folders = await fetchAllDocumentFolders()
  const root = folders.find(
    (folder) => parseProjectIdFromDocumentFolderDescription(folder.description) === projectId,
  )
  if (!root) {
    store.removeFolderMapping(projectId)
    return
  }

  const idsToDelete = new Set([root.id])
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders) {
      if (folder.parent_id && idsToDelete.has(folder.parent_id) && !idsToDelete.has(folder.id)) {
        idsToDelete.add(folder.id)
        changed = true
      }
    }
  }

  const depthById = new Map<string, number>()
  const getDepth = (id: string): number => {
    const cached = depthById.get(id)
    if (cached !== undefined) return cached
    const folder = folders.find((item) => item.id === id)
    const depth = folder?.parent_id && idsToDelete.has(folder.parent_id) ? getDepth(folder.parent_id) + 1 : 0
    depthById.set(id, depth)
    return depth
  }

  for (const folderId of Array.from(idsToDelete).sort((a, b) => getDepth(b) - getDepth(a))) {
    await deleteDocumentFolder(folderId)
  }
  store.removeFolderMapping(projectId)
}

export async function syncProjectDocumentFolderName(
  projectId: string,
  projectName: string,
): Promise<void> {
  const folderId = useProjectDocumentFolderStore.getState().getFolderId(projectId)
  if (!folderId) return

  try {
    await updateDocumentFolder(folderId, { name: buildProjectDocumentFolderName(projectName) })
  } catch {
    // best-effort
  }
}
