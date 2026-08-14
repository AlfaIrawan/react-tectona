import type { DocumentTemplateResponse } from '@/lib/api/documentKnowledgeApi'
import {
  buildAutoRenamedStructuredFileName,
  buildStandardTemplateMasterFileName,
  deriveBrdModuleNameFromFileName,
  prefixForTemplateDocumentKind,
  testFileNameAgainstRegex,
} from '@/lib/kb/repositoryBrdFileNaming'
import { detectBrdVersionFromName, normalizeBrdVersionLabel, parseBrdStructuredName } from '@/lib/kb/repositoryKbFromDocument'
import {
  looksLikeMemoAttachmentFileName,
  looksLikeMemoUploadFileName,
} from '@/lib/kb/repositoryMemoFromDocument'
import { parseTemplateAgentSchema, type TemplateDocumentKind } from './templateAgentSchema'

export type RepositoryNamingRule = {
  namingConventionId: string
  namingConventionCode: string
  namingConventionName: string
  ruleRegex: string
  ruleSource: 'rule_regex' | 'description' | 'kb'
  recommendedExample?: string | null
}

export type TemplateInstantiateNamingPlan = {
  sourceFileName: string
  effectiveFileName: string
  title: string
  autoRenamed: boolean
  namingRule: RepositoryNamingRule | null
  shouldSendBackendNamingConvention: boolean
  documentKind: TemplateDocumentKind
  namingMetadata: Record<string, unknown>
}

function resolveTemplateSourceFileName(template: DocumentTemplateResponse): string {
  const fromLatest = template.latest_file_name?.trim()
  if (fromLatest) return fromLatest
  const ext = '.docx'
  const code = template.template_code?.trim()
  if (code) return `${code}${ext}`
  const safeName = template.name.trim().replace(/[^\w\s\-.,()]/g, '').replace(/\s+/g, '_') || 'template'
  return `${safeName}${ext}`
}

function deriveModuleNameForTemplate(template: DocumentTemplateResponse, sourceFileName: string): string {
  const parsed = parseBrdStructuredName(sourceFileName) ?? parseBrdStructuredName(template.name)
  if (parsed?.moduleOrFeatureName) return parsed.moduleOrFeatureName
  const fromName = deriveBrdModuleNameFromFileName(template.name)
  if (fromName && fromName !== 'Requirement') return fromName
  return deriveBrdModuleNameFromFileName(sourceFileName)
}

export function shouldSkipNamingForTemplateInstantiate(
  documentKind: TemplateDocumentKind,
  sourceFileName: string,
): boolean {
  return documentKind === 'memo_internal'
    || looksLikeMemoUploadFileName(sourceFileName)
    || looksLikeMemoAttachmentFileName(sourceFileName)
}

export function buildTemplateInstantiateNamingPlan(params: {
  template: DocumentTemplateResponse
  projectName: string
  namingRule: RepositoryNamingRule | null
}): TemplateInstantiateNamingPlan {
  const { template, projectName, namingRule } = params
  const agentSchema = parseTemplateAgentSchema(template.metadata)
  const documentKind = (agentSchema.document_kind ?? 'general') as TemplateDocumentKind
  const sourceFileName = resolveTemplateSourceFileName(template)
  const parsedSource = parseBrdStructuredName(sourceFileName)
  const documentVersionLabel = normalizeBrdVersionLabel(
    parsedSource?.version ?? detectBrdVersionFromName(sourceFileName),
  ) ?? 'V1'
  const moduleName = deriveModuleNameForTemplate(template, sourceFileName)
  const projectSegment = parsedSource?.projectOrInitiativeName ?? projectName

  let effectiveFileName = sourceFileName
  let autoRenamed = false

  if (namingRule && !shouldSkipNamingForTemplateInstantiate(documentKind, sourceFileName)) {
    const prefix = prefixForTemplateDocumentKind(documentKind, sourceFileName)
    const preferredFileName = buildAutoRenamedStructuredFileName(sourceFileName, projectName, Date.now(), {
      projectName: projectSegment,
      moduleName,
      version: documentVersionLabel,
      prefix,
    })
    const match = testFileNameAgainstRegex(sourceFileName, namingRule.ruleRegex)
    if (!match.valid || preferredFileName !== sourceFileName) {
      effectiveFileName = preferredFileName
      autoRenamed = effectiveFileName !== sourceFileName
    }
  }

  const title = effectiveFileName.replace(/\.[^/.]+$/, '').trim() || template.name
  const shouldSendBackendNamingConvention = Boolean(
    namingRule
    && namingRule.ruleSource !== 'kb'
    && namingRule.namingConventionId !== 'kb-fallback',
  )

  const namingMetadata: Record<string, unknown> = {
    original_file_name: sourceFileName,
    template_source_file_name: sourceFileName,
    repository_file_name: effectiveFileName,
    auto_renamed_by_standard: autoRenamed,
    naming_applied_on: 'template-instantiate',
    document_kind_from_template: documentKind,
    document_version_label: documentVersionLabel,
    document_project_name: projectSegment,
    naming_convention_id: shouldSendBackendNamingConvention ? (namingRule?.namingConventionId ?? null) : null,
    naming_convention_code: shouldSendBackendNamingConvention ? (namingRule?.namingConventionCode ?? null) : null,
    naming_convention_name: shouldSendBackendNamingConvention ? (namingRule?.namingConventionName ?? null) : null,
    naming_rule_regex: shouldSendBackendNamingConvention ? (namingRule?.ruleRegex ?? null) : null,
    naming_rule_source: namingRule?.ruleSource ?? null,
    frontend_naming_convention_name: namingRule?.namingConventionName ?? null,
    frontend_naming_rule_regex: namingRule?.ruleRegex ?? null,
  }

  return {
    sourceFileName,
    effectiveFileName,
    title,
    autoRenamed,
    namingRule,
    shouldSendBackendNamingConvention,
    documentKind,
    namingMetadata,
  }
}

function detectTemplateDocumentKindFromFileName(fileName: string): TemplateDocumentKind {
  const base = fileName.replace(/\.[^/.]+$/, '').toLowerCase()
  if (/memo|surat|internal/i.test(base)) return 'memo_internal'
  if (/\bfsd\b|functional\s*spec/i.test(base)) return 'fsd'
  if (/\burd\b|user\s*requirement/i.test(base)) return 'urd'
  if (/\bbrd\b|business\s*requirement/i.test(base)) return 'brd'
  return 'general'
}

function buildTemplateCodeSlug(effectiveFileName: string): string {
  const base = effectiveFileName.replace(/\.[^/.]+$/, '').trim().toLowerCase()
  const slug = base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${slug || 'template'}-${Date.now().toString(36)}`.slice(0, 80)
}

export type TemplateUploadNamingPlan = {
  sourceFileName: string
  effectiveFileName: string
  displayName: string
  templateCode: string
  autoRenamed: boolean
  documentKind: TemplateDocumentKind
  namingMetadata: Record<string, unknown>
}

export function buildTemplateUploadNamingPlan(params: {
  fileName: string
  workspaceName: string
  namingRule: RepositoryNamingRule | null
  lastModified?: number
  versionOverride?: string | null
}): TemplateUploadNamingPlan {
  const { fileName, workspaceName, namingRule, lastModified, versionOverride } = params
  const sourceFileName = fileName.trim() || 'template.docx'
  const documentKind = detectTemplateDocumentKindFromFileName(sourceFileName)
  const parsedSource = parseBrdStructuredName(sourceFileName)
  const documentVersionLabel = normalizeBrdVersionLabel(
    versionOverride ?? parsedSource?.version ?? detectBrdVersionFromName(sourceFileName),
  ) ?? 'V1'
  const moduleName = deriveBrdModuleNameFromFileName(sourceFileName)

  let effectiveFileName = sourceFileName
  if (!shouldSkipNamingForTemplateInstantiate(documentKind, sourceFileName)) {
    const prefix = prefixForTemplateDocumentKind(documentKind, sourceFileName)
    if (namingRule) {
      effectiveFileName = buildAutoRenamedStructuredFileName(sourceFileName, workspaceName, lastModified, {
        projectName: parsedSource?.projectOrInitiativeName ?? workspaceName,
        moduleName,
        version: documentVersionLabel,
        prefix,
      })
    } else {
      effectiveFileName = buildStandardTemplateMasterFileName(sourceFileName, workspaceName, lastModified)
    }
  }

  const autoRenamed = effectiveFileName !== sourceFileName
  const displayName = effectiveFileName.replace(/\.[^/.]+$/, '').trim() || 'Uploaded master template'
  const shouldSendBackendNamingConvention = Boolean(
    namingRule
    && namingRule.ruleSource !== 'kb'
    && namingRule.namingConventionId !== 'kb-fallback',
  )

  const namingMetadata: Record<string, unknown> = {
    original_file_name: sourceFileName,
    repository_file_name: effectiveFileName,
    auto_renamed_by_standard: autoRenamed,
    naming_applied_on: 'template-upload',
    document_kind_from_upload: documentKind,
    document_version_label: documentVersionLabel,
    naming_convention_id: shouldSendBackendNamingConvention ? (namingRule?.namingConventionId ?? null) : null,
    naming_convention_code: shouldSendBackendNamingConvention ? (namingRule?.namingConventionCode ?? null) : null,
    naming_convention_name: shouldSendBackendNamingConvention ? (namingRule?.namingConventionName ?? null) : null,
    naming_rule_regex: shouldSendBackendNamingConvention ? (namingRule?.ruleRegex ?? null) : null,
    naming_rule_source: namingRule?.ruleSource ?? null,
    frontend_naming_convention_name: namingRule?.namingConventionName ?? null,
    frontend_naming_rule_regex: namingRule?.ruleRegex ?? null,
  }

  return {
    sourceFileName,
    effectiveFileName,
    displayName,
    templateCode: buildTemplateCodeSlug(effectiveFileName),
    autoRenamed,
    documentKind,
    namingMetadata,
  }
}
