import { useCallback, useEffect, useState } from 'react'
import { listIdeas, type IdeaApi } from '@/lib/api/ideaBacklogApi'

export function useProjectLinkedIdea(projectId: string | undefined) {
  const [linkedIdea, setLinkedIdea] = useState<IdeaApi | null>(null)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!projectId) {
      setLinkedIdea(null)
      return
    }
    setLoading(true)
    try {
      const response = await listIdeas({ project_id: projectId, page_size: 1 })
      setLinkedIdea(response.items[0] ?? null)
    } catch {
      setLinkedIdea(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { linkedIdea, loading, reload, setLinkedIdea }
}
