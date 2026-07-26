import { useEffect, useMemo } from 'react'
import {
  useTectonaPageContextStore,
  type TectonaPageContextSnapshot,
} from '@/stores/tectona-page-context-store'

/**
 * Publish rich page context for Gen AI assistant (cleared on unmount).
 */
export function useTectonaPageContextReporter(
  routeKey: string,
  snapshot: TectonaPageContextSnapshot | null | undefined,
): void {
  const snapshotKey = useMemo(() => JSON.stringify(snapshot ?? null), [snapshot])

  useEffect(() => {
    if (!snapshotKey || snapshotKey === 'null') {
      useTectonaPageContextStore.getState().clearPageContext(routeKey)
      return
    }
    const parsed = JSON.parse(snapshotKey) as TectonaPageContextSnapshot
    if (!parsed || Object.keys(parsed).length === 0) {
      useTectonaPageContextStore.getState().clearPageContext(routeKey)
      return
    }
    useTectonaPageContextStore.getState().setPageContext(routeKey, parsed)
    return () => {
      useTectonaPageContextStore.getState().clearPageContext(routeKey)
    }
  }, [routeKey, snapshotKey])
}
