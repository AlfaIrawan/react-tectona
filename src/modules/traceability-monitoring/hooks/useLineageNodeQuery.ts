import { useQuery } from '@tanstack/react-query'
import { fetchLineageNode } from '@/lib/api/traceabilityMonitoringApi'

export interface LineageNodeQueryParams {
  entityType: string
  entityId: string
  workspaceId?: string | null
}

export function useLineageNodeQuery(params: LineageNodeQueryParams | null) {
  return useQuery({
    queryKey: ['traceability-monitoring', 'lineage-node', params],
    queryFn: () => fetchLineageNode(params!.entityType, params!.entityId, params!.workspaceId),
    enabled: Boolean(params?.workspaceId),
  })
}
