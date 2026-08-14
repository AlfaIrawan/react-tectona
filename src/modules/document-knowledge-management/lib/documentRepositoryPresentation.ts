import type { DocumentResponse } from '@/lib/api/documentKnowledgeApi'
import { humanizeCapabilityCode } from '@/lib/kb/documentCapabilityClassification'
import { resolveRepositoryDocumentVersionLabel } from '@/lib/kb/repositoryKbFromDocument'
import { getFileTypeLabel } from '../fileTypeIcon'

export const UNIDENTIFIED_PROJECT_LABEL = 'Unidentified Project'

export type RepositoryItem = {
  id: string
  name: string
  fileName: string
  type: string
  capabilityCode: string | null
  capability: string
  linkedContext: string
  owner: string
  version: string
  documentVersion: number
  status: string
  tags: string[]
  updated: string
  accessScope: string
  workspace: string
  project: string
  linkedTask: string
  versionStatus: string
  category: string
  detailId: string
  storageProjectId: string
  storageProjectName: string
  primaryAttachmentId: string | null
  folderId: string | null
  templateId: string | null
  updatedAt: string
}

export function humanizeCode(value: string | null | undefined): string {
  if (!value) return '-'
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatRelativeTimestamp(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diffMs = date.getTime() - Date.now()
  const absSec = Math.abs(Math.round(diffMs / 1000))
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second')
  const absMin = Math.abs(Math.round(diffMs / 60000))
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60000), 'minute')
  const absHour = Math.abs(Math.round(diffMs / 3600000))
  if (absHour < 24) return rtf.format(Math.round(diffMs / 3600000), 'hour')
  const absDay = Math.abs(Math.round(diffMs / 86400000))
  if (absDay < 30) return rtf.format(Math.round(diffMs / 86400000), 'day')
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function statusBadgeClass(status: string): string {
  const lower = status.toLowerCase()
  if (lower.includes('publish') || lower === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (lower.includes('approve') || lower.includes('current')) return 'bg-sky-50 text-sky-700 border-sky-200'
  if (lower.includes('review') || lower.includes('inactive')) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (lower.includes('link') || lower.includes('deprecat')) return 'bg-violet-50 text-violet-700 border-violet-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export function mapDocumentToRepositoryItem(doc: DocumentResponse, projectName: string): RepositoryItem {
  const taskContext = doc.context_links.find((ctx) => {
    const linkType = (ctx.link_type_code || '').toLowerCase()
    return linkType !== 'project' && linkType !== 'workspace'
  })
  const projectContext = doc.context_links.find((ctx) => {
    const linkType = (ctx.link_type_code || '').toLowerCase()
    return linkType === 'project'
  })

  const linkedTask = taskContext?.linked_entity_name || taskContext?.linked_entity_id || '-'
  const linkedProject =
    projectContext?.linked_entity_name || projectContext?.linked_entity_id || UNIDENTIFIED_PROJECT_LABEL
  const linkedContext = linkedTask === '-' ? linkedProject : `${linkedProject} / ${linkedTask}`

  const filePropertiesAuthor = (doc.metadata?.file_properties as { author?: unknown } | undefined)?.author
  const documentAuthor =
    typeof filePropertiesAuthor === 'string' && filePropertiesAuthor.trim() ? filePropertiesAuthor.trim() : null
  const ownerFromMetadata = typeof doc.metadata?.owner_name === 'string' ? doc.metadata.owner_name : null
  const storageProjectId =
    typeof doc.metadata?.storage_project_id === 'string' && doc.metadata.storage_project_id.trim()
      ? doc.metadata.storage_project_id.trim()
      : doc.project_id
  const storageProjectName =
    typeof doc.metadata?.storage_project_name === 'string' && doc.metadata.storage_project_name.trim()
      ? doc.metadata.storage_project_name.trim()
      : projectName
  const repositoryFileName =
    typeof doc.metadata?.repository_file_name === 'string' && doc.metadata.repository_file_name.trim()
      ? doc.metadata.repository_file_name.trim()
      : doc.title
  const primaryAttachmentId =
    typeof doc.metadata?.primary_attachment_id === 'string' && doc.metadata.primary_attachment_id.trim()
      ? doc.metadata.primary_attachment_id.trim()
      : null

  const resolvedFileName =
    typeof doc.metadata?.original_file_name === 'string' && doc.metadata.original_file_name.trim()
      ? doc.metadata.original_file_name
      : doc.title

  return {
    id: doc.id,
    name: doc.title,
    fileName: resolvedFileName,
    type: getFileTypeLabel(resolvedFileName),
    capabilityCode: doc.capability_code ?? null,
    capability: humanizeCapabilityCode(doc.capability_code),
    linkedContext,
    owner: documentAuthor || ownerFromMetadata || 'system',
    version: resolveRepositoryDocumentVersionLabel({
      title: doc.title,
      fileName: repositoryFileName,
      metadata: doc.metadata,
      currentVersionNo: doc.current_version_no,
    }),
    documentVersion: typeof doc.version === 'number' ? doc.version : 1,
    status: humanizeCode(doc.status_code),
    tags: doc.tags,
    updated: formatRelativeTimestamp(doc.updated_date || doc.created_date),
    accessScope:
      doc.access_scope_codes.length > 0 ? doc.access_scope_codes.map(humanizeCode).join(' + ') : '-',
    workspace: doc.workspace_id || 'Unassigned',
    project: linkedProject,
    linkedTask,
    versionStatus: humanizeCode(doc.status_code),
    category: humanizeCode(doc.category_code),
    detailId: doc.id,
    storageProjectId,
    storageProjectName,
    primaryAttachmentId,
    folderId: typeof doc.folder_id === 'string' ? doc.folder_id : null,
    templateId: typeof doc.template_id === 'string' ? doc.template_id : null,
    updatedAt: doc.updated_date || doc.created_date || '',
  }
}
