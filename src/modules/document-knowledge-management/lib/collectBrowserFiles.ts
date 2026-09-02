export function collectBrowserFiles(list: FileList | Iterable<File> | null | undefined): File[] {
  if (!list) return []
  return Array.from(list).filter((file) => Boolean(file?.name?.trim()) && file.size > 0)
}
