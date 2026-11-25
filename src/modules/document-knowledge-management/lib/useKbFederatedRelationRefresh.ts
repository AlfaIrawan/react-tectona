import { useEffect } from 'react'

export function useKbFederatedRelationRefresh(
  enabled: boolean,
  displayScope: string,
  refresh: () => Promise<void>,
): void {
  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, displayScope, refresh])
}
