export const TRACEABILITY_BASE = '/traceability-monitoring' as const

export const traceabilityPath = (suffix: string) =>
  `${TRACEABILITY_BASE}${suffix.startsWith('/') ? suffix : `/${suffix}`}`

export const TRACEABILITY_ACTIVITY_PATH = traceabilityPath('/activity')
export const TRACEABILITY_LINEAGE_PATH = traceabilityPath('/lineage')
export const TRACEABILITY_PLATFORM_HEALTH_PATH = traceabilityPath('/platform-health')
