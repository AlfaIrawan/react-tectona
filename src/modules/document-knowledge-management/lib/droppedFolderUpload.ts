export type DroppedUploadItem = {
  file: File | null
  relativeDirectory: string[]
}

const SKIP_FILE_NAMES = /^(thumbs\.db|desktop\.ini|\.ds_store)$/i
const SKIP_DIR_NAMES = new Set(['__macosx', '.git', 'node_modules'])

type FileSystemEntryLike = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (success: (file: File) => void, error?: (err: Error) => void) => void
  createReader?: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (err: Error) => void,
    ) => void
  }
}

export function isSkippedDropName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return true
  if (SKIP_FILE_NAMES.test(trimmed)) return true
  return SKIP_DIR_NAMES.has(trimmed.toLowerCase())
}

export function relativeDirectoryFromWebkitPath(relativePath: string): string[] {
  const parts = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length <= 1) return []
  return parts.slice(0, -1)
}

export function uniqueDirectoryPaths(items: readonly DroppedUploadItem[]): string[][] {
  const seen = new Set<string>()
  const paths: string[][] = []
  const add = (parts: string[]) => {
    for (let index = 1; index <= parts.length; index += 1) {
      const slice = parts.slice(0, index)
      const key = slice.map((part) => part.toLowerCase()).join('\0')
      if (seen.has(key)) continue
      seen.add(key)
      paths.push(slice)
    }
  }
  for (const item of items) add(item.relativeDirectory)
  return paths.sort((left, right) => left.length - right.length || left.join('/').localeCompare(right.join('/')))
}

export function collectUploadItemsFromFiles(files: ArrayLike<File>): DroppedUploadItem[] {
  const items: DroppedUploadItem[] = []
  for (const file of Array.from(files)) {
    if (!file?.name?.trim() || file.size <= 0 || isSkippedDropName(file.name)) continue
    const relativePath = typeof (file as File & { webkitRelativePath?: string }).webkitRelativePath === 'string'
      ? (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
      : ''
    const relativeDirectory = relativeDirectoryFromWebkitPath(relativePath)
    if (relativeDirectory.some((part) => isSkippedDropName(part))) continue
    items.push({ file, relativeDirectory })
  }
  return items
}

function readDirectoryEntries(entry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> {
  const reader = entry.createReader?.()
  if (!reader) return Promise.resolve([])
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = []
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(all)
          return
        }
        all.push(...batch)
        readBatch()
      }, reject)
    }
    readBatch()
  })
}

function readFileEntry(entry: FileSystemEntryLike): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!entry.file) {
      reject(new Error(`Cannot read file ${entry.name}`))
      return
    }
    entry.file(resolve, reject)
  })
}

async function walkFileSystemEntry(
  entry: FileSystemEntryLike,
  parentDirectory: string[],
): Promise<DroppedUploadItem[]> {
  if (isSkippedDropName(entry.name)) return []
  if (entry.isFile) {
    try {
      const file = await readFileEntry(entry)
      if (!file?.name?.trim() || file.size <= 0 || isSkippedDropName(file.name)) return []
      return [{ file, relativeDirectory: parentDirectory }]
    } catch {
      return []
    }
  }
  if (!entry.isDirectory) return []
  const nextDirectory = [...parentDirectory, entry.name]
  const children = await readDirectoryEntries(entry)
  const visible = children.filter((child) => !isSkippedDropName(child.name))
  if (visible.length === 0) return [{ file: null, relativeDirectory: nextDirectory }]
  const nested: DroppedUploadItem[] = []
  for (const child of visible) {
    nested.push(...await walkFileSystemEntry(child, nextDirectory))
  }
  if (nested.length === 0) return [{ file: null, relativeDirectory: nextDirectory }]
  return nested
}

export async function collectUploadItemsFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<DroppedUploadItem[]> {
  const snapshotFiles = Array.from(dataTransfer.files || [])
  const transferItems = Array.from(dataTransfer.items || [])
  const entries = transferItems
    .map((item) => {
      const getter = (
        item as DataTransferItem & {
          webkitGetAsEntry?: () => FileSystemEntryLike | null
          getAsEntry?: () => FileSystemEntryLike | null
        }
      ).webkitGetAsEntry ?? (item as DataTransferItem & { getAsEntry?: () => FileSystemEntryLike | null }).getAsEntry
      return getter ? getter.call(item) : null
    })
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry))

  if (entries.some((entry) => entry.isDirectory) || (entries.length > 0 && snapshotFiles.length === 0)) {
    const collected: DroppedUploadItem[] = []
    for (const entry of entries) {
      collected.push(...await walkFileSystemEntry(entry, []))
    }
    if (collected.length > 0) return collected
  }

  return collectUploadItemsFromFiles(snapshotFiles)
}
