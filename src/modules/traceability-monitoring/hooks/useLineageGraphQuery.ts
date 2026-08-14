import { useQuery } from '@tanstack/react-query'
import { fetchLineageGraph, type FetchLineageGraphParams } from '@/lib/api/traceabilityMonitoringApi'

export function useLineageGraphQuery(params: FetchLineageGraphParams | null) {
  return useQuery({
    queryKey: ['traceability-monitoring', 'lineage-graph', params],
    queryFn: () => fetchLineageGraph(params as FetchLineageGraphParams),
    enabled: Boolean(params?.workspaceId && params.rootType && params.rootId),
  })
}
