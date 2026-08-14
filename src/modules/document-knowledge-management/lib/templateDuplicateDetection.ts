import type { DocumentTemplateResponse } from '@/lib/api/documentKnowledgeApi'
import type { ExistingBrdDoc } from '@/lib/kb/brdDuplicateDetection'
import {
  detectBrdVersionFromName,
  normalizeBrdVersionLabel,
  parseStructuredDocumentName,
} from '@/lib/kb/repositoryKbFromDocument'
import { resolveTemplateWorkspaceId } from '@/modules/document-knowledge-management/lib/templateWorkspaceScope'

export type TemplateUploadDuplicateVerdict = {
  proceed: boolean
  revisionTargetId: string | null
}

export function parseTemplateVersionNumber(label: string | null | undefined): number {
  const normalized = normalizeBrdVersionLabel(label)
  if (!normalized) return 0
  const match = normalized.match(/^V(\d+(?:\.\d+)?)$/i)
  if (!match) return 0
  return Number.parseFloat(match[1])
}

export function formatTemplateVersionLabel(versionNumber: number): string {
  const whole = Math.max(1, Math.round(versionNumber))
  return `V${whole}`
}

export function resolveTemplateVersionLabel(doc: ExistingBrdDoc): string {
  return normalizeBrdVersionLabel(
    doc.structured?.version ?? detectBrdVersionFromName(doc.fileName),
  ) ?? 'V1'
}

export function resolveTemplateVersionLabelFromResponse(
  template: Pick<DocumentTemplateResponse, 'name' | 'latest_file_name' | 'metadata'>,
): string {
  const meta = (template.metadata ?? {}) as Record<string, unknown>
  const fromMeta = typeof meta.document_version_label === 'string' ? meta.document_version_label.trim() : ''
  if (fromMeta) {
    return normalizeBrdVersionLabel(fromMeta) ?? 'V1'
  }
  const fileName = template.latest_file_name?.trim() || template.name?.trim() || ''
  return normalizeBrdVersionLabel(detectBrdVersionFromName(fileName)) ?? 'V1'
}

export function formatTemplateVersionForDisplay(label: string): string {
  return (normalizeBrdVersionLabel(label) ?? label).toLowerCase()
}

export function resolveNextTemplateVersionLabelForFamily(familyDocs: ExistingBrdDoc[]): string {
  let maxVersion = 0
  for (const doc of familyDocs) {
    maxVersion = Math.max(maxVersion, parseTemplateVersionNumber(resolveTemplateVersionLabel(doc)))
  }
  return formatTemplateVersionLabel(maxVersion + 1)
}

/** Prefer same-family template with the highest version label for in-place revision uploads. */
export function pickTemplateRevisionTargetId(
  nameMatches: ExistingBrdDoc[],
  samePurpose: Array<{ doc: ExistingBrdDoc; reason: string }>,
): string | null {
  const pool = nameMatches.length > 0 ? nameMatches : samePurpose.map((entry) => entry.doc)
  if (pool.length === 0) return null

  let selected = pool[0]
  let selectedVersion = parseTemplateVersionNumber(resolveTemplateVersionLabel(selected))
  for (const candidate of pool.slice(1)) {
    const candidateVersion = parseTemplateVersionNumber(resolveTemplateVersionLabel(candidate))
    if (candidateVersion > selectedVersion) {
      selected = candidate
      selectedVersion = candidateVersion
    }
  }
  return selected.id
}

function resolveTemplateFileName(template: DocumentTemplateResponse): string {
  const meta = (template.metadata ?? {}) as Record<string, unknown>
  if (typeof meta.repository_file_name === 'string' && meta.repository_file_name.trim()) {
    return meta.repository_file_name.trim()
  }
  if (typeof meta.original_file_name === 'string' && meta.original_file_name.trim()) {
    return meta.original_file_name.trim()
  }
  if (typeof template.latest_file_name === 'string' && template.latest_file_name.trim()) {
    return template.latest_file_name.trim()
  }
  return template.name?.trim() || ''
}

export function mapTemplateToExistingBrdDoc(
  template: DocumentTemplateResponse,
  workspaceCandidates?: Array<{ id: string; name: string }>,
): ExistingBrdDoc {
  const meta = (template.metadata ?? {}) as Record<string, unknown>
  const fileName = resolveTemplateFileName(template)
  const workspaceId = resolveTemplateWorkspaceId(template, workspaceCandidates)
  const workspaceName =
    workspaceCandidates?.find((candidate) => candidate.id === workspaceId)?.name?.trim()
    || (typeof meta.workspace_name === 'string' ? meta.workspace_name.trim() : '')
    || ''

  return {
    id: template.id,
    title: template.name?.trim() || fileName,
    fileName,
    projectName: workspaceName,
    contentSha256: typeof meta.content_sha256 === 'string' ? meta.content_sha256 : '',
    structured: parseStructuredDocumentName(fileName),
  }
}

export function filterTemplatesForWorkspace(
  templates: DocumentTemplateResponse[],
  workspaceId: string,
  workspaceCandidates?: Array<{ id: string; name: string }>,
): DocumentTemplateResponse[] {
  const normalizedWorkspaceId = workspaceId.trim()
  if (!normalizedWorkspaceId) return []
  return templates.filter(
    (template) => resolveTemplateWorkspaceId(template, workspaceCandidates) === normalizedWorkspaceId,
  )
}

export function buildTemplateSummaryById(templates: DocumentTemplateResponse[]): Map<string, string> {
  const summaryById = new Map<string, string>()
  for (const template of templates) {
    const description = template.description?.trim() || ''
    const bodyText = typeof template.body_template === 'string'
      ? template.body_template.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : ''
    summaryById.set(template.id, description || bodyText.slice(0, 500) || template.name?.trim() || '')
  }
  return summaryById
}

export function gatherExistingTemplateDocs(
  templates: DocumentTemplateResponse[],
  workspaceId: string,
  workspaceCandidates?: Array<{ id: string; name: string }>,
): { docs: ExistingBrdDoc[]; summaryById: Map<string, string> } {
  const scoped = filterTemplatesForWorkspace(templates, workspaceId, workspaceCandidates)
  return {
    docs: scoped.map((template) => mapTemplateToExistingBrdDoc(template, workspaceCandidates)),
    summaryById: buildTemplateSummaryById(scoped),
  }
}
