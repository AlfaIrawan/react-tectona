import { resolveIdeaDocsProject } from '@/modules/projects/lib/resolveIdeaDocsProject'
import { ensureProjectDocumentFolder } from '@/modules/projects/lib/ensureProjectDocumentFolder'
import { createProjectDocument, deleteDocument, uploadDocumentAttachment } from '@/lib/api/documentKnowledgeApi'

/**
 * Saves the raw file a user uploaded via "Upload Idea" as a supporting document under the
 * created idea's Docs section — same project/folder resolution and tag/metadata convention as
 * the Document Repository's own file upload, so it shows up via the existing
 * `isDocumentLinkedToIdea` lookup without any changes to the Idea Docs UI.
 */
export async function attachUploadedFileToIdeaDocs(input: {
  file: File
  ideaId: string
  ideaTitle: string
  ideaProjectId?: string | null
  workspaceId?: string | null
  documentType?: 'urd' | 'brd' | 'fsd'
  documentStatus?: 'draft' | 'in_progress' | 'final'
}): Promise<void> {
  const targetProject = await resolveIdeaDocsProject({
    ideaId: input.ideaId,
    ideaTitle: input.ideaTitle,
    ideaProjectId: input.ideaProjectId,
    workspaceId: input.workspaceId,
  })
  if (!targetProject) throw new Error('No project available to store the idea document.')
  const folderId = await ensureProjectDocumentFolder({ id: targetProject.id, name: targetProject.name })

  const created = await createProjectDocument(targetProject.id, {
    workspace_id: input.workspaceId ?? null,
    title: input.file.name.replace(/\.[^/.]+$/, '').trim() || input.file.name,
    folder_id: folderId,
    summary: `Source document uploaded via Upload Idea: ${input.file.name}`,
    content: `Attachment uploaded from Upload Idea: ${input.file.name}`,
    document_type_code: input.documentType ?? 'brd',
    category_code: 'knowledge_asset',
    status_code: input.documentStatus ?? 'draft',
    tags: ['uploaded', 'idea-docs', input.ideaId, input.documentType ?? 'brd', input.documentStatus ?? 'draft'],
    access_scope_codes: ['project_team'],
    metadata: {
      source: 'idea-upload',
      idea_id: input.ideaId,
      storage_project_id: targetProject.id,
      storage_project_name: targetProject.name,
      original_file_name: input.file.name,
      content_type: input.file.type || 'application/octet-stream',
      document_type: input.documentType ?? 'brd',
      document_status: input.documentStatus ?? 'draft',
    },
    version_notes: 'Uploaded via Upload Idea',
  })

  try {
    await uploadDocumentAttachment(created.id, input.file, {
      source: 'idea-upload',
      original_file_name: input.file.name,
    })
  } catch (attachmentError) {
    // The document row exists but the file failed to reach storage — roll back so Docs
    // never shows an orphaned, file-less entry (same convention as the Document Repository upload).
    try {
      await deleteDocument(created.id)
    } catch {
      /* best-effort rollback */
    }
    throw attachmentError
  }
}
