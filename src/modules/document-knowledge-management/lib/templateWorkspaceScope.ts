import type { DocumentTemplateResponse } from '@/lib/api/documentKnowledgeApi'
import { belongsToDkmRepositoryScope, type WorkspaceScope } from '@/lib/tenantWorkspaceScope'

function workspaceNameToFileSegment(workspaceName: string): string {
  return workspaceName
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^(AI|API|KB|BRD|IT|ERP|CRM|SCF|FMCG|HO|WS)$/i.test(part)) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1).replace(/[^A-Za-z0-9]/g, '')
    })
    .join('')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase()
}

/** Resolve workspace tag for a template row (column, metadata, or legacy name inference). */
export function resolveTemplateWorkspaceId(
  template: DocumentTemplateResponse,
  workspaceCandidates?: Array<{ id: string; name: string }>,
): string | null {
  const fromColumn = typeof template.workspace_id === 'string' ? template.workspace_id.trim() : ''
  if (fromColumn) return fromColumn

  const metaWs = template.metadata?.workspace_id
  if (typeof metaWs === 'string' && metaWs.trim()) return metaWs.trim()

  const title = template.name?.trim() || template.latest_file_name?.trim() || ''
  const segmentMatch = title.match(/^(?:BRD|URD|FSD|TPL)_([A-Za-z0-9]+)_/i)
  if (!segmentMatch || !workspaceCandidates?.length) return null

  const segment = segmentMatch[1].toLowerCase()
  const matched = workspaceCandidates.find(
    (candidate) => workspaceNameToFileSegment(candidate.name) === segment,
  )
  return matched?.id ?? null
}

export function belongsToDkmTemplateScope(
  template: DocumentTemplateResponse,
  scope: WorkspaceScope,
  workspaceCandidates?: Array<{ id: string; name: string }>,
): boolean {
  const workspaceId = resolveTemplateWorkspaceId(template, workspaceCandidates)
  if (!workspaceId) {
    return scope.mode === 'all'
  }
  return belongsToDkmRepositoryScope(workspaceId, scope)
}
