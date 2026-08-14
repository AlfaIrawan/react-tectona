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

function formatBrdSegmentForFileName(value: string, fallback: string): string {
  const humanized = humanizeSemanticName(value || fallback)
  const tokenized = humanized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^(AI|API|KB|BRD|IT|ERP|CRM|SCF|FMCG|HO)$/i.test(part)) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1).replace(/[^A-Za-z0-9]/g, '')
    })
    .join('')
    .replace(/[^A-Za-z0-9]/g, '')
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

/** Detect file-name prefix from document type cues in the original filename. */
export function resolveStructuredDocumentPrefix(fileName: string): StructuredDocumentPrefix {
  const base = fileName.replace(/\.[^/.]+$/, '').toLowerCase()
  if (/\bfsd\b|functional\s*spec/i.test(base)) return 'FSD'
  if (/\burd\b|user\s*requirement/i.test(base)) return 'URD'
  if (/\bbrd\b|business\s*requirement/i.test(base)) return 'BRD'
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
  const projectSegment = formatBrdSegmentForFileName(
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
