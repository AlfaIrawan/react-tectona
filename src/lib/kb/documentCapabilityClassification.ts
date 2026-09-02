/**
 * Document capability classification (KTP, Kartu Keluarga, BRD, FSD, TSD).
 * Rules load from KB business_rules "Document Capability Classification Standard"
 * with a light hardcoded keyword fallback when KB is unavailable.
 */

export const DOCUMENT_CAPABILITY_CODES = [
  'ktp',
  'kartu_keluarga',
  'brd',
  'fsd',
  'tsd',
] as const

export type DocumentCapabilityCode = (typeof DOCUMENT_CAPABILITY_CODES)[number]

export const DOCUMENT_CAPABILITY_CLASSIFICATION_STANDARD_TITLE =
  'Document Capability Classification Standard'

export const DOCUMENT_CAPABILITY_LABELS: Record<DocumentCapabilityCode, string> = {
  ktp: 'KTP',
  kartu_keluarga: 'Kartu Keluarga',
  brd: 'BRD',
  fsd: 'FSD',
  tsd: 'TSD',
}

export type DocumentCapabilityRule = {
  capability_code: DocumentCapabilityCode
  keywords: string[]
  regexSources: string[]
}

const FALLBACK_RULES: DocumentCapabilityRule[] = [
  {
    capability_code: 'ktp',
    keywords: ['ktp', 'kartu tanda penduduk'],
    regexSources: ['\\bKTP\\b', 'Kartu\\s+Tanda\\s+Penduduk'],
  },
  {
    capability_code: 'kartu_keluarga',
    keywords: ['kartu keluarga', 'nomor kk', 'no. kk', 'no kk'],
    regexSources: ['Kartu\\s+Keluarga', '\\bKK[_\\-\\s]'],
  },
  {
    capability_code: 'brd',
    keywords: ['business requirement document', 'business requirements'],
    regexSources: [
      '^BRD_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*_V\\d+(?:\\.\\d+)?_\\d{8}(?:\\.[A-Za-z0-9]+)?$',
      '\\bBUSINESS\\s+REQUIREMENT(?:S)?\\s+DOCUMENT\\b',
      '\\bBRD\\b',
    ],
  },
  {
    capability_code: 'fsd',
    keywords: ['functional specification', 'functional spec', 'spesifikasi fungsional'],
    regexSources: [
      '^FSD_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*_v?\\d+(?:\\.\\d+)?(?:\\.[A-Za-z0-9]+)?$',
      '\\bFunctional\\s+Spec(?:ification)?(?:\\s+Document)?\\b',
      '\\bFSD\\b',
    ],
  },
  {
    capability_code: 'tsd',
    keywords: ['technical specification', 'technical spec', 'spesifikasi teknis'],
    regexSources: [
      '^TSD_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*_v?\\d+(?:\\.\\d+)?(?:\\.[A-Za-z0-9]+)?$',
      '\\bTechnical\\s+Spec(?:ification)?(?:\\s+Document)?\\b',
      '\\bTSD\\b',
    ],
  },
]

/** Prefer more specific capabilities when multiple match. */
const CAPABILITY_PRIORITY: DocumentCapabilityCode[] = [
  'kartu_keluarga',
  'ktp',
  'brd',
  'fsd',
  'tsd',
]

function isCapabilityCode(value: string): value is DocumentCapabilityCode {
  return (DOCUMENT_CAPABILITY_CODES as readonly string[]).includes(value)
}

function stripHtmlToPlain(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|hr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r\n/g, '\n')
}

function compileRegex(source: string): RegExp | null {
  const trimmed = source.trim()
  if (!trimmed) return null
  try {
    // Inline (?i) flag → JS 'i'
    if (trimmed.startsWith('(?i)')) {
      return new RegExp(trimmed.slice(4), 'i')
    }
    return new RegExp(trimmed, 'i')
  } catch {
    return null
  }
}

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Parse capability rules from KB HTML/plain content.
 * Sections are delimited by `capability_code: <code>` headings/lines.
 */
export function parseCapabilityRulesFromKbContent(content: string | null | undefined): DocumentCapabilityRule[] {
  if (!content?.trim()) return []
  const plain = stripHtmlToPlain(content)
  const lines = plain.split(/\n/).map((line) => line.trim()).filter(Boolean)

  const rules: DocumentCapabilityRule[] = []
  let current: DocumentCapabilityRule | null = null

  const flush = () => {
    if (!current) return
    if (current.keywords.length > 0 || current.regexSources.length > 0) {
      rules.push(current)
    }
    current = null
  }

  for (const line of lines) {
    const codeMatch = line.match(/^capability_code\s*[:=]\s*([a-z0-9_]+)\b/i)
    if (codeMatch?.[1]) {
      flush()
      const code = codeMatch[1].trim().toLowerCase()
      if (!isCapabilityCode(code)) {
        current = null
        continue
      }
      current = { capability_code: code, keywords: [], regexSources: [] }
      continue
    }
    if (!current) continue

    const keywordMatch = line.match(/^keywords?\s*[:=]\s*(.+)$/i)
    if (keywordMatch?.[1]) {
      current.keywords.push(...parseKeywords(keywordMatch[1]))
      continue
    }

    if (/^(regex|pattern)\s*[:=]/i.test(line)) {
      const value = line.replace(/^(regex|pattern)\s*[:=]\s*/i, '').trim()
      if (value) current.regexSources.push(value)
      continue
    }

    const slash = line.match(/^\/((?:\\.|[^/])+?)\/[gimsuy]*$/)
    if (slash?.[1]) {
      current.regexSources.push(slash[1])
    }
  }

  flush()
  return rules
}

export type KbCapabilityEntryLike = {
  title?: string | null
  category?: string | null
  content?: string | null
  is_active?: boolean | null
}

export function resolveCapabilityRulesFromKbEntries(
  entries: readonly KbCapabilityEntryLike[] | null | undefined,
): DocumentCapabilityRule[] {
  const list = entries ?? []
  const standard = list.find(
    (entry) =>
      (entry.is_active !== false)
      && (entry.category || '').toLowerCase() === 'business_rules'
      && (entry.title || '').trim().toLowerCase() === DOCUMENT_CAPABILITY_CLASSIFICATION_STANDARD_TITLE.toLowerCase(),
  )
  const parsed = parseCapabilityRulesFromKbContent(standard?.content)
  return parsed.length > 0 ? parsed : FALLBACK_RULES
}

export function getFallbackCapabilityRules(): DocumentCapabilityRule[] {
  return FALLBACK_RULES.map((rule) => ({
    ...rule,
    keywords: [...rule.keywords],
    regexSources: [...rule.regexSources],
  }))
}

export function humanizeCapabilityCode(code: string | null | undefined): string {
  if (!code) return '-'
  if (isCapabilityCode(code)) return DOCUMENT_CAPABILITY_LABELS[code]
  return code
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function scoreRule(haystack: string, fileName: string, rule: DocumentCapabilityRule): number {
  let score = 0
  const identity = rule.capability_code === 'ktp' || rule.capability_code === 'kartu_keluarga'
  const identityFileHaystack = identity ? fileName.replace(/[_./\\-]+/g, ' ') : fileName
  const textSource = identity ? identityFileHaystack : haystack
  const lowerHaystack = textSource.toLowerCase()
  const lowerFile = (identity ? identityFileHaystack : fileName).toLowerCase()

  for (const source of rule.regexSources) {
    const re = compileRegex(source)
    if (!re) continue
    if (identity) {
      if (re.test(identityFileHaystack)) score += source.startsWith('^') ? 100 : 60
    } else if (re.test(fileName) || re.test(haystack)) {
      score += source.startsWith('^') ? 100 : 60
    }
  }

  for (const keyword of rule.keywords) {
    const needle = keyword.trim().toLowerCase()
    if (!needle) continue
    if (lowerFile.includes(needle) || (!identity && lowerHaystack.includes(needle))) {
      score += needle.length >= 8 ? 40 : 25
    }
  }

  // Light token fallback for short codes in filename (BRD_, FSD_, …)
  const token = rule.capability_code === 'kartu_keluarga' ? null : rule.capability_code.toUpperCase()
  if (token && new RegExp(`(?:^|[\\\\s_\\-./])${token}(?:$|[\\\\s_\\-./])`, 'i').test(fileName)) {
    score += 35
  }
  if (rule.capability_code === 'kartu_keluarga' && /\bkk\b/i.test(identityFileHaystack)) {
    score += 30
  }

  return score
}

export type DetectDocumentCapabilityOptions = {
  fileName?: string | null
  text?: string | null
  rules?: readonly DocumentCapabilityRule[] | null
}

/**
 * Detect capability from file name + content snippet using KB rules (or fallback).
 */
export function detectDocumentCapability(
  options: DetectDocumentCapabilityOptions,
): DocumentCapabilityCode | null {
  const fileName = (options.fileName || '').trim()
  const text = (options.text || '').slice(0, 8000)
  const haystack = `${fileName}\n${text}`
  if (!haystack.trim()) return null

  const rules = options.rules && options.rules.length > 0 ? options.rules : FALLBACK_RULES
  let best: DocumentCapabilityCode | null = null
  let bestScore = 0

  for (const code of CAPABILITY_PRIORITY) {
    const rule = rules.find((item) => item.capability_code === code)
    if (!rule) continue
    const score = scoreRule(haystack, fileName, rule)
    if (score > bestScore) {
      bestScore = score
      best = code
    }
  }

  return bestScore > 0 ? best : null
}
