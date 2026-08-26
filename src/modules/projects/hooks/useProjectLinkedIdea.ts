import { useCallback, useEffect, useState } from 'react'
import { listIdeas, type IdeaApi } from '@/lib/api/ideaBacklogApi'

export function useProjectLinkedIdea(projectId: string | undefined) {
  const [linkedIdeas, setLinkedIdeas] = useState<IdeaApi[]>([])
  const [linkedIdea, setLinkedIdea] = useState<IdeaApi | null>(null)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!projectId) {
      setLinkedIdeas([])
      setLinkedIdea(null)
      return
    }
    setLoading(true)
    try {
      const response = await listIdeas({ project_id: projectId, page_size: 200 })
      setLinkedIdeas(response.items)
      setLinkedIdea(response.items[0] ?? null)
    } catch {
      setLinkedIdeas([])
      setLinkedIdea(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { linkedIdea, linkedIdeas, loading, reload, setLinkedIdea, setLinkedIdeas }
}
