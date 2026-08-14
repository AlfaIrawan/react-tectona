import { useQuery } from '@tanstack/react-query'
import { fetchActivities, type FetchActivitiesParams } from '@/lib/api/traceabilityMonitoringApi'

export function useActivitiesQuery(params: FetchActivitiesParams) {
  return useQuery({
    queryKey: ['traceability-monitoring', 'activities', params],
    queryFn: () => fetchActivities(params),
    enabled: Boolean(params.workspaceId),
    placeholderData: (previous) => previous,
  })
}
