import { fetchProjects, createProject, TECTONA_PROJECT_APP_ID, type ProjectApi } from '@/lib/api/projectApi'
import { ensureProjectDocumentFolder } from '@/modules/projects/lib/ensureProjectDocumentFolder'
import { createProjectDocument, deleteDocument, uploadDocumentAttachment } from '@/lib/api/documentKnowledgeApi'

/**
 * Resolves the project used to store an idea's supporting documents — mirrors
 * `IdeaDetailPage.resolveIdeaTargetProject`: prefer the idea's own project, else the first
 * project in the workspace, else create a lightweight document-container project. Ideas are
 * commonly documented before they're converted into a project, so Docs must stay usable
 * without requiring conversion first.
 */
async function resolveIdeaTargetProject(input: {
  ideaId: string
  ideaTitle: string
  ideaProjectId?: string | null
  workspaceId?: string | null
}): Promise<ProjectApi> {
  const projectList = await fetchProjects({
    page: 1,
    page_size: 100,
    app_id: TECTONA_PROJECT_APP_ID,
    workspace_id: input.workspaceId ?? null,
  })

  if (input.ideaProjectId) {
    const linked = projectList.projects?.find((item) => item.id === input.ideaProjectId)
    if (linked) return linked
  }

  const first = projectList.projects?.[0]
  if (first) return first

  return createProject({
    name: input.ideaTitle.trim().slice(0, 255) || 'Idea workspace project',
    description: `Document container for idea: ${input.ideaTitle.trim() || input.ideaId}`,
    tags: ['idea-docs', input.ideaId],
    workspace_id: input.workspaceId ?? null,
  })
}

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
}): Promise<void> {
  const targetProject = await resolveIdeaTargetProject(input)
  const folderId = await ensureProjectDocumentFolder({ id: targetProject.id, name: targetProject.name })

  const created = await createProjectDocument(targetProject.id, {
    workspace_id: input.workspaceId ?? null,
    title: input.file.name.replace(/\.[^/.]+$/, '').trim() || input.file.name,
    folder_id: folderId,
    summary: `Source document uploaded via Upload Idea: ${input.file.name}`,
    content: `Attachment uploaded from Upload Idea: ${input.file.name}`,
    document_type_code: 'delivery_artifact',
    category_code: 'knowledge_asset',
    status_code: 'draft',
    tags: ['uploaded', 'idea-docs', input.ideaId],
    access_scope_codes: ['project_team'],
    metadata: {
      source: 'idea-upload',
      idea_id: input.ideaId,
      storage_project_id: targetProject.id,
      storage_project_name: targetProject.name,
      original_file_name: input.file.name,
      content_type: input.file.type || 'application/octet-stream',
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
