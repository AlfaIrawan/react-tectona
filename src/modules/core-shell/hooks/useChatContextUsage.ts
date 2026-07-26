import { useEffect, useMemo, useRef, useState } from 'react'

import {
  previewChatContextUsage,
  type ContextUsageReport,
  type RuntimeChatUiContext,
} from '@/lib/api/tectonaAgentRuntimeApi'

export interface UseChatContextUsageOptions {
  workspaceId?: string | null
  userId?: string | null
  sessionId?: string | null
  carryoverFromSessionId?: string | null
  draftMessage?: string
  ui?: RuntimeChatUiContext | null
  enabled?: boolean
  debounceMs?: number
  externalReport?: ContextUsageReport | null
}

export function useChatContextUsage({
  workspaceId,
  userId,
  sessionId,
  carryoverFromSessionId,
  draftMessage = '',
  ui,
  enabled = true,
  debounceMs = 450,
  externalReport = null,
}: UseChatContextUsageOptions) {
  const [report, setReport] = useState<ContextUsageReport | null>(externalReport)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const payload = useMemo(
    () => ({
      message: draftMessage,
      context: {
        workspace_id: workspaceId ?? null,
        user_id: userId ?? null,
        session_id: sessionId ?? null,
        carryover_from_session_id: carryoverFromSessionId ?? null,
        ui: ui ?? null,
      },
    }),
    [workspaceId, userId, sessionId, carryoverFromSessionId, draftMessage, ui],
  )

  useEffect(() => {
    if (externalReport) setReport(externalReport)
  }, [externalReport])

  useEffect(() => {
    if (!enabled) return undefined

    const timer = window.setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setError(null)

      previewChatContextUsage(payload, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setReport(next)
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          const message = err instanceof Error ? err.message : 'Failed to load context usage'
          setError(message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, debounceMs)

    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [enabled, payload, debounceMs])

  return { report, loading, error }
}
