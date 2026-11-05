import { useEffect, useState } from 'react'
import { getIdeaContentLock, type IdeaContentLock } from '@/lib/api/ideaBacklogApi'
import { updateIdeaContentRevision } from '@/lib/api/workflowAutomationApi'

export function useIdeaContentLock(ideaId: string, reloadKey: number, enforced: boolean) {
  const [result, setResult] = useState<{ ideaId: string; value: IdeaContentLock | null; error: string }>({
    ideaId: '', value: null, error: '',
  })
  useEffect(() => {
    let active = true
    let pending = false
    const reload = async () => {
      if (pending) return
      pending = true
      try {
        let value = await getIdeaContentLock(ideaId)
        if (value.run_id && value.state === 'submitted') {
          await updateIdeaContentRevision(value.run_id.split(':')[0], 'reconcile-content-lock')
          value = await getIdeaContentLock(ideaId)
        }
        if (active) setResult({ ideaId, value, error: '' })
      } catch (error) {
        if (active) setResult(previous => ({
          ideaId,
          value: previous.ideaId === ideaId ? previous.value : null,
          error: error instanceof Error ? error.message : 'Approval status unavailable.',
        }))
      } finally {
        pending = false
      }
    }
    void reload()
    const timer = window.setInterval(() => void reload(), 15000)
    window.addEventListener('focus', reload)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', reload) }
  }, [ideaId, reloadKey])
  const value = result.ideaId === ideaId ? result.value : null
  const error = result.ideaId === ideaId ? result.error : ''
  return { value, locked: (enforced && Boolean(error)) || (value?.locked ?? enforced), error }
}
