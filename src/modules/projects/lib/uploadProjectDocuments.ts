import { getSession } from '@/auth/authService'
import {
  createProjectDocument,
  listProjectDocuments,
  patchDocument,
  uploadDocumentAttachment,
} from '@/lib/api/documentKnowledgeApi'
import { computeContentFingerprint, findExactDuplicate, type ExistingBrdDoc } from '@/lib/kb/brdDuplicateDetection'
import { extractRepositoryDocumentText } from '@/lib/kb/repositoryKbFromDocument'
import { ensureProjectDocumentFolder } from './ensureProjectDocumentFolder'

export type ProjectDocumentUploadResult = {
  uploadedCount: number
  revisedCount: number
  /** Files skipped because the same content or source filename already exists in this project's Docs. */
  duplicates: { fileName: string; existingTitle: string }[]
}

export type ProjectDocumentRevisionConflict = {
  fileName: string
  existingTitle: string
  existingVersion: number
}

function normalizeDocumentName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/\s+/g, ' ')
}

async function loadExistingProjectDocsForDuplicateCheck(
  project: { id: string; name: string },
): Promise<ExistingBrdDoc[]> {
  try {
    const existing = await listProjectDocuments(project.id, { page: 1, page_size: 100 })
    return existing.items.map((doc) => ({
      id: doc.id,
      title: doc.title,
      fileName:
        typeof doc.metadata?.original_file_name === 'string' ? doc.metadata.original_file_name : doc.title,
      projectName: project.name,
      contentSha256: typeof doc.metadata?.content_sha256 === 'string' ? doc.metadata.content_sha256 : '',
      structured: null,
      version: doc.version,
      metadata: doc.metadata,
    }))
  } catch {
    // Duplicate scan is best-effort; never block uploads because the scan failed.
    return []
  }
}

export async function uploadFilesToProjectDocumentFolder(
  project: { id: string; name: string },
  files: File[],
  options?: {
    ideaId?: string | null
    onRevisionConflict?: (conflict: ProjectDocumentRevisionConflict) => Promise<boolean>
  },
): Promise<ProjectDocumentUploadResult> {
  if (files.length === 0) return { uploadedCount: 0, revisedCount: 0, duplicates: [] }

  const folderId = await ensureProjectDocumentFolder(project)
  const session = getSession()
  const existingDocs = await loadExistingProjectDocsForDuplicateCheck(project)

  const duplicates: ProjectDocumentUploadResult['duplicates'] = []
  let uploadedCount = 0
  let revisedCount = 0

  for (const file of files) {
    const title = file.name.replace(/\.[^/.]+$/, '').trim() || file.name

    let fingerprint = ''
    try {
      const extract = await extractRepositoryDocumentText(file)
      fingerprint = await computeContentFingerprint(extract.text)
    } catch {
      // Text extraction is best-effort — unsupported file types just skip duplicate detection.
    }

    if (fingerprint) {
      const exact = findExactDuplicate(fingerprint, existingDocs)
      if (exact) {
        duplicates.push({ fileName: file.name, existingTitle: exact.title })
        continue
      }
    }

    // Older project documents may not have a content fingerprint yet. Keep the
    // upload guard effective for those records by also matching the original
    // source filename/title before creating a new repository document.
    const normalizedFileName = normalizeDocumentName(file.name)
    const sameSource = existingDocs.find((doc) => {
      const existingSource = normalizeDocumentName(doc.fileName || doc.title)
      return existingSource === normalizedFileName
    })
    if (sameSource) {
      const proceed = options?.onRevisionConflict
        ? await options.onRevisionConflict({
          fileName: file.name,
          existingTitle: sameSource.title,
          existingVersion: Number(sameSource.version ?? 1),
        })
        : false
      if (!proceed) {
        duplicates.push({ fileName: file.name, existingTitle: sameSource.title })
        continue
      }

      const attachment = await uploadDocumentAttachment(sameSource.id, file, {
        source: 'project-docs-ui-revision',
        original_file_name: file.name,
        version_notes: `Uploaded revision from project docs${fingerprint ? ' with updated content' : ''}`,
        ...(fingerprint ? { content_sha256: fingerprint } : {}),
      })
      await patchDocument(sameSource.id, {
        version: Number(sameSource.version ?? 1),
        metadata: {
          ...sameSource.metadata,
          original_file_name: file.name,
          primary_attachment_id: attachment.id,
          ...(fingerprint ? { content_sha256: fingerprint } : {}),
          revision_source: 'project-docs-upload-confirmed',
        },
        version_notes: `Revision uploaded from Project Docs (source: ${file.name})`,
      })
      revisedCount += 1
      continue
    }

    const created = await createProjectDocument(project.id, {
      title,
      folder_id: folderId,
      summary: `Uploaded from project docs: ${file.name}`,
      content: `Attachment uploaded from project workspace: ${file.name}`,
      document_type_code: 'delivery_artifact',
      category_code: 'knowledge_asset',
      status_code: 'draft',
      tags: [
        'uploaded',
        'project-docs',
        ...(options?.ideaId ? [options.ideaId] : []),
      ],
      context_links: [
        {
          link_type_code: 'project',
          linked_entity_id: project.id,
          linked_entity_name: project.name,
        },
      ],
      metadata: {
        upload_source: 'react-tectona-project-docs',
        original_file_name: file.name,
        storage_project_id: project.id,
        storage_project_name: project.name,
        project_document_folder_id: folderId,
        owner_name: session?.user.name || session?.user.email || 'system',
        ...(options?.ideaId ? { idea_id: options.ideaId } : {}),
        ...(fingerprint ? { content_sha256: fingerprint } : {}),
      },
    })

    const attachment = await uploadDocumentAttachment(created.id, file, {
      source: 'project-docs-ui',
      original_file_name: file.name,
    })

    try {
      await patchDocument(created.id, {
        version: created.version,
        metadata: {
          ...created.metadata,
          primary_attachment_id: attachment.id,
        },
      })
    } catch {
      // Attachment exists even if metadata patch fails.
    }

    // Register this upload so a later file in the SAME batch is also checked against it.
    if (fingerprint) {
      existingDocs.push({
        id: created.id,
        title,
        fileName: file.name,
        projectName: project.name,
        contentSha256: fingerprint,
        structured: null,
        version: created.version,
        metadata: created.metadata,
      })
    }
    uploadedCount += 1
  }

  return { uploadedCount, revisedCount, duplicates }
}
