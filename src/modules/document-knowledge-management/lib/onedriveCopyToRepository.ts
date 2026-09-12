/**
 * Copying OneDrive items into the Tectona repository by drag & drop.
 *
 * The copy deliberately ends up as `DroppedUploadItem[]` — the exact shape the
 * repository's own drop-upload produces. Everything downstream (folder creation,
 * duplicate detection, Auto-generate KB, versioning, the progress overlay) then
 * applies to a copied file identically to a dragged-from-desktop one, instead of
 * this feature growing a parallel import path that slowly drifts from it.
 */

import type { DroppedUploadItem } from './droppedFolderUpload'
import type { MicrosoftDriveItem, MicrosoftDriveListing } from '@/lib/api/microsoftGraphApi'

/** Private MIME type: only our own panes can start a copy, never an outside page. */
export const ONEDRIVE_DRAG_MIME = 'application/x-tectona-onedrive-items'

export interface OneDriveDragItem {
  id: string
  name: string
  kind: MicrosoftDriveItem['kind']
}

/** Guards against a pathological or looping drive tree stalling the browser. */
export const MAX_COPY_FILES = 500
export const MAX_COPY_DEPTH = 12

export function encodeOneDriveDragPayload(items: readonly OneDriveDragItem[]): string {
  return JSON.stringify(items.map(({ id, name, kind }) => ({ id, name, kind })))
}

export function decodeOneDriveDragPayload(raw: string | null | undefined): OneDriveDragItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is OneDriveDragItem =>
        !!entry
        && typeof (entry as OneDriveDragItem).id === 'string'
        && typeof (entry as OneDriveDragItem).name === 'string'
        && ((entry as OneDriveDragItem).kind === 'file' || (entry as OneDriveDragItem).kind === 'folder'),
    )
  } catch {
    return []
  }
}

export function dataTransferHasOneDriveItems(types: readonly string[] | DOMStringList | undefined): boolean {
  if (!types) return false
  return Array.from(types).includes(ONEDRIVE_DRAG_MIME)
}

export interface CollectOneDriveUploadsResult {
  items: DroppedUploadItem[]
  /** Files that could not be downloaded — reported rather than silently dropped. */
  failures: Array<{ path: string; reason: string }>
  /** True when the walk stopped at MAX_COPY_FILES with more still to come. */
  truncated: boolean
}

export interface CollectOneDriveUploadsOptions {
  items: readonly OneDriveDragItem[]
  listChildren: (itemId: string) => Promise<MicrosoftDriveListing>
  fetchContent: (itemId: string) => Promise<Blob>
  onProgress?: (done: number, total: number, currentName: string) => void
  signal?: { aborted: boolean }
}

/**
 * Walks the dragged selection and returns upload items with their folder paths.
 *
 * Folders are expanded breadth-first rather than downloaded: Graph has no notion
 * of "download a folder", and expanding here is what lets the existing uploader
 * recreate the same structure inside Tectona.
 */
export async function collectOneDriveUploadItems(
  options: CollectOneDriveUploadsOptions,
): Promise<CollectOneDriveUploadsResult> {
  const { items, listChildren, fetchContent, onProgress, signal } = options

  type Pending = { item: OneDriveDragItem; directory: string[]; depth: number }

  const queue: Pending[] = items.map((item) => ({ item, directory: [], depth: 0 }))
  const uploads: DroppedUploadItem[] = []
  const failures: CollectOneDriveUploadsResult['failures'] = []
  const seenFolders = new Set<string>()
  let truncated = false

  // Expand folders first so the file count is known before downloading starts,
  // which keeps the progress figure honest instead of climbing as it goes.
  const files: Pending[] = []
  while (queue.length > 0) {
    const current = queue.shift() as Pending
    if (signal?.aborted) break

    if (current.item.kind === 'file') {
      if (files.length >= MAX_COPY_FILES) {
        truncated = true
        continue
      }
      files.push(current)
      continue
    }

    if (current.depth >= MAX_COPY_DEPTH || seenFolders.has(current.item.id)) continue
    seenFolders.add(current.item.id)

    const childDirectory = [...current.directory, current.item.name]
    try {
      const listing = await listChildren(current.item.id)
      for (const child of listing.items ?? []) {
        queue.push({
          item: { id: child.id, name: child.name, kind: child.kind },
          directory: childDirectory,
          depth: current.depth + 1,
        })
      }
    } catch (error) {
      failures.push({
        path: [...childDirectory].join('/'),
        reason: error instanceof Error ? error.message : 'could not be listed',
      })
    }
  }

  let done = 0
  for (const entry of files) {
    if (signal?.aborted) break
    const displayPath = [...entry.directory, entry.item.name].join('/')
    try {
      const blob = await fetchContent(entry.item.id)
      uploads.push({
        file: new File([blob], entry.item.name, {
          type: blob.type || 'application/octet-stream',
        }),
        relativeDirectory: entry.directory,
      })
    } catch (error) {
      failures.push({
        path: displayPath,
        reason: error instanceof Error ? error.message : 'could not be downloaded',
      })
    }
    done += 1
    onProgress?.(done, files.length, entry.item.name)
  }

  return { items: uploads, failures, truncated }
}
