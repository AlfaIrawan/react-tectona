import { useCallback, useEffect, useState } from 'react'
import type { WorkItemApiModel } from '@/lib/api/workApi'
import {
  listWorkItems,
  seedProjectFromTemplate,
  TECTONA_PROJECT_WORKSPACE,
} from '@/lib/api/workApi'
import { isProjectTemplateTag } from '../lib/projectDisplay'
import {
  buildFallbackWorkItems,
  filterWorkItemsForProject,
} from '../lib/projectWorkItemUtils'
import type { Project } from '../store/projectStore'

function projectUsesKanbanTemplate(project: Project): boolean {
  return (project.tags ?? []).some((tag) => isProjectTemplateTag(tag) && tag === 'kanban')
}

export function useProjectWorkItems(project: Project | null, ownerName: string) {
  const [workItems, setWorkItems] = useState<WorkItemApiModel[]>([])
  const [loading, setLoading] = useState(true)
  const [usesApiItems, setUsesApiItems] = useState(false)

  const reload = useCallback(async () => {
    if (!project) {
      setWorkItems([])
      setUsesApiItems(false)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      if (projectUsesKanbanTemplate(project)) {
        await seedProjectFromTemplate({
          templateCode: 'kanban',
          projectId: project.id,
          projectName: project.name,
          workspace: TECTONA_PROJECT_WORKSPACE,
          assignee: ownerName || project.ownerName || 'Unassigned',
          anchorDate: project.createdAt.slice(0, 10),
        })
      }

      const response = await listWorkItems({
        project: project.name,
        workspace: TECTONA_PROJECT_WORKSPACE,
      })

      const scoped = filterWorkItemsForProject(response.items, project.id)
      if (scoped.length === 0) {
        setWorkItems(buildFallbackWorkItems(project, { ownerName }))
        setUsesApiItems(false)
        return
      }

      setWorkItems(scoped)
      setUsesApiItems(true)
    } catch {
      if (project) {
        setWorkItems(buildFallbackWorkItems(project, { ownerName }))
      } else {
        setWorkItems([])
      }
      setUsesApiItems(false)
    } finally {
      setLoading(false)
    }
  }, [ownerName, project])

  useEffect(() => {
    void reload()
  }, [reload])

  return { workItems, loading, usesApiItems, reload }
}
