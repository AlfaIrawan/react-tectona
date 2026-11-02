export async function readBrainstormSessionConflict<T>(
  error: unknown,
  readLatest: () => Promise<T>,
): Promise<{ kind: 'changed' | 'busy' | null; latest: T | null }> {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('IDEA_DRAFT_SESSION_BUSY')) return { kind: 'busy', latest: null }
  if (message.includes('IDEA_DRAFT_SESSION_CHANGED')) return { kind: 'changed', latest: await readLatest() }
  return { kind: null, latest: null }
}
