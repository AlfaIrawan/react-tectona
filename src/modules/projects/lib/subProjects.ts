import { fetchAllProjects, TECTONA_PROJECT_APP_ID } from '@/lib/api/projectApi'
import { listIdeas, patchIdea, type IdeaApi } from '@/lib/api/ideaBacklogApi'
import { listWorkItems, TECTONA_PROJECT_WORKSPACE, type WorkItemApiModel } from '@/lib/api/workApi'
import { mapApiToProject, type Project } from '../store/projectStore'
import { filterWorkItemsForProject } from './projectWorkItemUtils'

export type WorkItemSummary = {
  total: number
  done: number
  inReview: number
  overdue: number
  donePct: number
}

export type SubProjectEntry = {
  project: Project
  /** A sub-project delivers exactly one idea; null until one is linked. */
  idea: IdeaApi | null
  workItems: WorkItemApiModel[]
  summary: WorkItemSummary
}

export function isProgramProject(project: Pick<Project, 'childProjectCount' | 'parentProjectId'>): boolean {
  return !project.parentProjectId && (project.childProjectCount ?? 0) > 0
}

export function summarizeWorkItems(items: WorkItemApiModel[], today = new Date()): WorkItemSummary {
  const todayKey = today.toISOString().slice(0, 10)
  let done = 0
  let inReview = 0
  let overdue = 0
  for (const item of items) {
    if (item.status === 'Done') done += 1
    else {
      if (item.status === 'In Review') inReview += 1
      if (item.dueDate && item.dueDate.slice(0, 10) < todayKey) overdue += 1
    }
  }
  return {
    total: items.length,
    done,
    inReview,
    overdue,
    donePct: items.length === 0 ? 0 : Math.round((done / items.length) * 100),
  }
}

/**
 * Real work items of a project, for roll-ups. Unlike `useProjectWorkItems` it never seeds the
 * template board and never falls back to demo items, so an empty sub-project counts as zero.
 */
export async function fetchProjectWorkItemsForRollup(project: Project): Promise<WorkItemApiModel[]> {
  try {
    const response = await listWorkItems({ project: project.name, workspace: TECTONA_PROJECT_WORKSPACE })
    return filterWorkItemsForProject(response.items, project.id, project.name)
  } catch {
    return []
  }
}

export async function fetchSubProjectEntries(parent: Project): Promise<SubProjectEntry[]> {
  if (parent.hierarchySupported === false) return []
  const listed = await fetchAllProjects({
    app_id: TECTONA_PROJECT_APP_ID,
    workspace_id: parent.workspaceId ?? null,
    parent_project_id: parent.id,
  })
  // An older project service ignores the filter and returns every project; keep real children only.
  const children = listed.filter((api) => api.parent_project_id === parent.id)
  return Promise.all(
    children.map(async (api) => {
      const project = mapApiToProject(api)
      const [ideas, workItems] = await Promise.all([
        listIdeas({ project_id: project.id, page_size: 20 }).then((r) => r.items).catch(() => [] as IdeaApi[]),
        fetchProjectWorkItemsForRollup(project),
      ])
      return { project, idea: ideas[0] ?? null, workItems, summary: summarizeWorkItems(workItems) }
    }),
  )
}

/** Moves the idea into the sub-project (an idea belongs to one project at a time). */
export async function linkIdeaToSubProject(idea: IdeaApi, subProjectId: string): Promise<IdeaApi> {
  return patchIdea(idea.id, { project_id: subProjectId, version: idea.version })
}
