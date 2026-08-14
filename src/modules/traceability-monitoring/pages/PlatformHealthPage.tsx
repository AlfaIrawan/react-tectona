import { useQuery } from '@tanstack/react-query'
import { fetchPlatformHealthSummary } from '@/lib/api/traceabilityMonitoringApi'
import { PlatformHealthCards } from '@/modules/traceability-monitoring/components/PlatformHealthCards'

const SALIX_BASE_URL = (import.meta.env.VITE_SALIX_BASE_URL as string | undefined)?.trim() || undefined

export function PlatformHealthPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['traceability-monitoring', 'platform-health'],
    queryFn: fetchPlatformHealthSummary,
    refetchInterval: 30_000,
  })

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load platform health summary. Confirm the Tectona Activity & Lineage service is running.
      </div>
    )
  }

  return <PlatformHealthCards services={data?.services ?? []} loading={isLoading} salixBaseUrl={SALIX_BASE_URL} />
}
