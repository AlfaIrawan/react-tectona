import {
  detectBrdVersionFromName,
  normalizeBrdVersionLabel,
  parseBrdStructuredName,
} from '@/lib/kb/repositoryKbFromDocument'

function splitCamelCaseWords(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

function humanizeSemanticName(value: string): string {
  const cleaned = splitCamelCaseWords(
    value
      .replace(/\.[A-Za-z0-9]+$/, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .replace(/\bV\d+(?:\.\d+)?\b/gi, ' ')
    .replace(/\b\d{8}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => {
      if (/^(AI|API|KB|BRD|IT|ERP|CRM|SCF|FMCG|HO)$/i.test(part)) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

// Keeps each filename segment short enough that BRD_<project>_<module>_<version>_<date>.ext stays
// a reasonable length even when the source document title is a long sentence.
const MAX_SEGMENT_CHARS = 28

function formatBrdSegmentForFileName(value: string, fallback: string): string {
  const humanized = humanizeSemanticName(value || fallback)
  const words = humanized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^(AI|API|KB|BRD|IT|ERP|CRM|SCF|FMCG|HO)$/i.test(part)) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1).replace(/[^A-Za-z0-9]/g, '')
    })

  let tokenized = ''
  for (const word of words) {
    const next = tokenized + word
    if (tokenized && next.length > MAX_SEGMENT_CHARS) break
    tokenized = next
    if (tokenized.length >= MAX_SEGMENT_CHARS) break
  }
  tokenized = tokenized.replace(/[^A-Za-z0-9]/g, '').slice(0, MAX_SEGMENT_CHARS)
  return tokenized || fallback
}

function formatDateAsYyyymmdd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export function deriveBrdModuleNameFromFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  const parsed = parseBrdStructuredName(baseName)
  if (parsed) return parsed.moduleOrFeatureName
  const stripped = baseName
    .replace(/^template[\s_.-]*/i, '')
    .replace(/^tpl[\s_.-]*/i, '')
    .replace(/^brd[\s_.-]*/i, '')
    .replace(/^urd[\s_.-]*/i, '')
    .replace(/user\s*requirement\s*document/gi, ' ')
    .replace(/\(\s*urd\s*\)/gi, ' ')
    .replace(/(?:^|[\s_.-])v(?:ersion)?[.\s-]*[0-9]+(?:\.[0-9]+)?/gi, ' ')
    .replace(/\b\d{8}\b/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped || 'Requirement'
}

export function buildAutoRenamedBrdFileName(
  fileName: string,
  projectName: string,
  lastModified?: number,
  overrides?: {
    projectName?: string | null
    moduleName?: string | null
    version?: string | null
    prefix?: StructuredDocumentPrefix
  },
): string {
  return buildAutoRenamedStructuredFileName(fileName, projectName, lastModified, {
    ...overrides,
    prefix: overrides?.prefix ?? 'BRD',
  })
}

export type StructuredDocumentPrefix = 'BRD' | 'URD' | 'FSD' | 'TPL'

export type FileNameDocumentType = 'fsd' | 'urd' | 'brd'

/** `urd` as its own token. Not `\burd\b`: `_` is a word character, so `\b` never matches inside
 * structured names like "URD_AdiraFinanceWs_Requirement" and the type fell through to content
 * sniffing (a URD that mentions FSD was renamed to FSD). */
function hasTypeToken(base: string, token: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${token}(?:[^a-z0-9]|$)`).test(base)
}

/** Document type named by a file name. The leading prefix ("URD_…") wins over a later mention. */
export function detectDocumentTypeFromFileName(fileName: string): FileNameDocumentType | null {
  const base = fileName.replace(/\.[^/.]+$/, '').toLowerCase()
  const leading = /^(fsd|urd|brd)(?:[^a-z0-9]|$)/.exec(base)
  if (leading) return leading[1] as FileNameDocumentType
  if (hasTypeToken(base, 'fsd') || /functional[\s_-]*spec/.test(base)) return 'fsd'
  if (hasTypeToken(base, 'urd') || /user[\s_-]*requirement/.test(base)) return 'urd'
  if (hasTypeToken(base, 'brd') || /business[\s_-]*requirement/.test(base)) return 'brd'
  return null
}

/** Detect file-name prefix from document type cues in the original filename. */
export function resolveStructuredDocumentPrefix(fileName: string): StructuredDocumentPrefix {
  const type = detectDocumentTypeFromFileName(fileName)
  if (type === 'fsd') return 'FSD'
  if (type === 'urd') return 'URD'
  if (type === 'brd') return 'BRD'
  return 'TPL'
}

export function prefixForTemplateDocumentKind(
  documentKind: string,
  fileName: string,
): StructuredDocumentPrefix {
  if (documentKind === 'fsd') return 'FSD'
  if (documentKind === 'urd') return 'URD'
  if (documentKind === 'brd') return 'BRD'
  if (documentKind === 'memo_internal') return 'TPL'
  return resolveStructuredDocumentPrefix(fileName)
}

export function buildAutoRenamedStructuredFileName(
  fileName: string,
  projectName: string,
  lastModified?: number,
  overrides?: {
    projectName?: string | null
    moduleName?: string | null
    version?: string | null
    prefix?: StructuredDocumentPrefix
  },
): string {
  const extMatch = fileName.match(/(\.[^/.]+)$/)
  const ext = extMatch?.[1] ?? ''
  const parsed = parseBrdStructuredName(fileName)
  const prefix = overrides?.prefix ?? resolveStructuredDocumentPrefix(fileName)
  let projectSegment = formatBrdSegmentForFileName(
    parsed?.projectOrInitiativeName
    ?? overrides?.projectName
    ?? projectName,
    prefix === 'TPL' ? 'Workspace' : 'Project',
  )
  const moduleSegment = formatBrdSegmentForFileName(
    parsed?.moduleOrFeatureName
    ?? overrides?.moduleName
    ?? deriveBrdModuleNameFromFileName(fileName),
    prefix === 'URD' ? 'Requirement' : prefix === 'FSD' ? 'Specification' : 'Requirement',
  )
  // When no real project name is known, both segments fall back to the same document-derived
  // text — repeating it verbatim (e.g. "BRD_LongTitle_LongTitle_V1_...") is worse than a generic
  // placeholder, so collapse the duplicate instead of keeping it.
  if (projectSegment === moduleSegment) {
    projectSegment = prefix === 'TPL' ? 'Workspace' : 'Project'
  }
  const version = normalizeBrdVersionLabel(
    parsed?.version
    ?? overrides?.version
    ?? detectBrdVersionFromName(fileName),
  ) ?? 'V1'
  const yyyymmdd = parsed?.yyyymmdd ?? formatDateAsYyyymmdd(lastModified ? new Date(lastModified) : new Date())
  return `${prefix}_${projectSegment}_${moduleSegment}_${version}_${yyyymmdd}${ext}`
}

/** Master template library fallback when governance/KB naming rule is unavailable. */
export function buildStandardTemplateMasterFileName(
  fileName: string,
  workspaceName: string,
  lastModified?: number,
): string {
  const prefix = resolveStructuredDocumentPrefix(fileName)
  return buildAutoRenamedStructuredFileName(fileName, workspaceName, lastModified, { prefix })
}

export function testFileNameAgainstRegex(fileName: string, ruleRegex: string): { valid: boolean; error?: string } {  try {
    const re = new RegExp(`^(?:${ruleRegex})$`)
    const baseName = fileName.replace(/\.[^/.]+$/, '')
    return { valid: re.test(fileName) || re.test(baseName) }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'invalid regex' }
  }
}
