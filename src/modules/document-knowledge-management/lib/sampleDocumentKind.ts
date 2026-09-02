/** Gold-set document kinds for the Samples library (folder name → kind). */

export const SAMPLE_DOCUMENT_KIND_CODES = [
  'bpkb',
  'brd',
  'fsd',
  'kartu_keluarga',
  'ketetapan_sementara',
  'ktp',
  'memo_internal',
  'npwp',
  'sop',
  'tsd',
  'urd',
] as const

export type SampleDocumentKind = (typeof SAMPLE_DOCUMENT_KIND_CODES)[number]

export const SAMPLE_KIND_LABELS: Record<SampleDocumentKind, string> = {
  bpkb: 'BPKB',
  brd: 'BRD',
  fsd: 'FSD',
  kartu_keluarga: 'Kartu Keluarga',
  ketetapan_sementara: 'Ketetapan Sementara',
  ktp: 'KTP',
  memo_internal: 'Memo Internal',
  npwp: 'NPWP',
  sop: 'SOP',
  tsd: 'TSD',
  urd: 'URD',
}

/** Identity scans: never infer these from body mentions of syarat nasabah. */
export const IDENTITY_SAMPLE_KINDS = new Set<SampleDocumentKind>([
  'bpkb',
  'kartu_keluarga',
  'ktp',
  'npwp',
])

const CATEGORY_ALIASES: { kind: SampleDocumentKind; names: string[] }[] = [
  { kind: 'bpkb', names: ['bpkb', 'rpkb'] },
  { kind: 'brd', names: ['brd'] },
  { kind: 'fsd', names: ['fsd'] },
  { kind: 'kartu_keluarga', names: ['kartu keluarga', 'kk'] },
  { kind: 'ketetapan_sementara', names: ['ketetapan sementara', 'ks'] },
  { kind: 'ktp', names: ['ktp', 'kartu tanda penduduk'] },
  { kind: 'memo_internal', names: ['memo internal', 'mi', 'internal memo'] },
  { kind: 'npwp', names: ['npwp'] },
  { kind: 'sop', names: ['sop'] },
  { kind: 'tsd', names: ['tsd'] },
  { kind: 'urd', names: ['urd'] },
]

export function isSampleDocumentKind(value: string | null | undefined): value is SampleDocumentKind {
  return Boolean(value && (SAMPLE_DOCUMENT_KIND_CODES as readonly string[]).includes(value))
}

export function matchSampleCategoryName(name: string): SampleDocumentKind | null {
  const needle = name.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!needle || needle === 'samples' || needle === 'sample') return null
  for (const row of CATEGORY_ALIASES) {
    if (row.names.includes(needle)) return row.kind
  }
  if (needle.startsWith('ketetapan sement')) return 'ketetapan_sementara'
  if (needle.startsWith('kartu keluarga')) return 'kartu_keluarga'
  if (needle.startsWith('memo internal')) return 'memo_internal'
  return null
}

/** First Samples category folder from the root of the path (not nested user folders). */
export function resolveSampleKindFromFolderNames(folderPath: readonly string[]): SampleDocumentKind | null {
  const names = folderPath.map((name) => name.trim()).filter(Boolean)
  const samplesAt = names.findIndex((name) => {
    const lower = name.toLowerCase()
    return lower === 'samples' || lower === 'sample'
  })
  const search = samplesAt >= 0 ? names.slice(samplesAt + 1) : names
  for (const name of search) {
    const match = matchSampleCategoryName(name)
    if (match) return match
  }
  return null
}

export function resolveSampleKindFromFolderId(
  folderId: string | null | undefined,
  folders: ReadonlyArray<{ id: string; name: string; parent_id?: string | null }>,
): SampleDocumentKind | null {
  if (!folderId) return null
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: string[] = []
  let cursor: string | null = folderId
  let guard = 0
  while (cursor && guard < 64) {
    const folder = byId.get(cursor)
    if (!folder) break
    path.unshift(folder.name)
    cursor = folder.parent_id ?? null
    guard += 1
  }
  return resolveSampleKindFromFolderNames(path)
}

export function sampleKindLabel(kind: SampleDocumentKind | 'unknown'): string {
  if (kind === 'unknown') return 'Unknown'
  return SAMPLE_KIND_LABELS[kind]
}
