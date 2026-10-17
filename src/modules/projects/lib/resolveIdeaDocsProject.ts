import { createProject, fetchAllProjects, TECTONA_PROJECT_APP_ID, type ProjectApi } from '@/lib/api/projectApi'

export const IDEA_DOCS_CONTAINER_TAG = 'idea-docs'

function isDocsContainerFor(project: ProjectApi, ideaId: string): boolean {
  const tags = (project.tags ?? []).map((tag) => tag.trim().toLowerCase())
  return tags.includes(IDEA_DOCS_CONTAINER_TAG) && tags.includes(ideaId.trim().toLowerCase())
}

/**
 * The project that stores an idea's supporting documents.
 *
 * 1. The project the idea is linked to (`idea.project_id`).
 * 2. Else this idea's own document-container project (tagged `idea-docs` + the idea id).
 * 3. Else the project the idea's documents are already stored in (`documentsProjectId`): ideas
 *    documented before containers existed were filed under the workspace's first project, and a
 *    regeneration must find its URD there to save a new version instead of a second document.
 * 4. Else, when `createIfMissing`, a new document container for this idea.
 *
 * It never falls back to "the first project in the workspace": a project can now hold many
 * ideas, so that fallback would silently file an unlinked idea's URD/BRD/FSD under an
 * unrelated project. Documents already stored that way stay visible, because Idea Docs looks
 * documents up by idea id across the workspace (see `fetchDocumentsLinkedToIdea`).
 */
export async function resolveIdeaDocsProject(input: {
  ideaId: string
  ideaTitle: string
  ideaProjectId?: string | null
  /** The project holding this idea's existing documents, if any. */
  documentsProjectId?: string | null
  workspaceId?: string | null
  createIfMissing?: boolean
}): Promise<ProjectApi | null> {
  const projects = await fetchAllProjects({
    app_id: TECTONA_PROJECT_APP_ID,
    workspace_id: input.workspaceId ?? null,
  })

  if (input.ideaProjectId) {
    const linked = projects.find((item) => item.id === input.ideaProjectId)
    if (linked) return linked
  }

  const container = projects.find((item) => isDocsContainerFor(item, input.ideaId))
  if (container) return container

  if (input.documentsProjectId) {
    const holding = projects.find((item) => item.id === input.documentsProjectId)
    if (holding) return holding
  }

  if (input.createIfMissing === false) return null

  return createProject({
    name: input.ideaTitle.trim().slice(0, 255) || 'Idea workspace project',
    description: `Document container for idea: ${input.ideaTitle.trim() || input.ideaId}`,
    tags: [IDEA_DOCS_CONTAINER_TAG, input.ideaId],
    workspace_id: input.workspaceId ?? null,
  })
}
