export type DirectoryTreePageRow<T> = {
  workspace: T
  depth: number
  isLinkedReference?: boolean
}

/** Paginate a DFS tree without orphaning children: repeat ancestor rows at the start of later pages. */
export function sliceDirectoryTreePage<T>(
  rows: ReadonlyArray<DirectoryTreePageRow<T>>,
  page: number,
  pageSize: number,
): DirectoryTreePageRow<T>[] {
  const size = Math.max(1, pageSize)
  const start = Math.max(0, (Math.max(1, page) - 1) * size)
  const slice = rows.slice(start, start + size)
  if (slice.length === 0 || start === 0) return [...slice]
  const first = slice[0]
  if (!first || first.depth <= 0) return [...slice]
  const leading: DirectoryTreePageRow<T>[] = []
  let needDepth = first.depth - 1
  for (let index = start - 1; index >= 0 && needDepth >= 0; index -= 1) {
    const row = rows[index]
    if (!row || row.isLinkedReference) continue
    if (row.depth === needDepth) {
      leading.unshift(row)
      needDepth -= 1
    }
  }
  return [...leading, ...slice]
}
