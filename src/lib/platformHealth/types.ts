export type LayerStatus = 'ok' | 'degraded' | 'unavailable' | 'unknown'

export type OverallStatus = 'healthy' | 'degraded' | 'unhealthy'

export type ServiceStatus = 'ok' | 'degraded' | 'unavailable' | 'timeout'

export type DatabaseStatus = 'connected' | 'disconnected' | 'degraded' | 'unknown' | 'not_applicable'

export interface PlatformHealthLayer {
  status: LayerStatus
  label: string
  detail?: string | null
}

export interface ServiceProbeResult {
  id: string
  label: string
  status: ServiceStatus
  health_ok: boolean
  ready_ok?: boolean | null
  database: DatabaseStatus
  latency_ms?: number | null
  message?: string | null
}

export interface PlatformHealthResponse {
  checked_at: string
  overall: OverallStatus
  application: PlatformHealthLayer
  services: PlatformHealthLayer
  database: PlatformHealthLayer
  runtime_ready: boolean
  items: ServiceProbeResult[]
}

export type PlatformHealthFetchError = 'network' | 'timeout' | 'service' | null

export type DiagnosisCode =
  | 'ALL_OK'
  | 'NETWORK_OFFLINE'
  | 'NETWORK_OR_GATEWAY'
  | 'APPLICATION_ISSUE'
  | 'SERVICE_ISSUE'
  | 'DATABASE_ISSUE'
  | 'SERVICE_AND_DATABASE'
  | 'APPLICATION_AND_SERVICE'
  | 'APPLICATION_AND_DATABASE'
  | 'UNKNOWN'

export interface PlatformHealthLayerView {
  key: 'network' | 'application' | 'services' | 'database'
  label: string
  status: LayerStatus
  detail: string
}

export interface PlatformHealthDiagnosis {
  badgeLabel: string
  badgeTone: 'green' | 'amber' | 'red'
  headline: string
  suggestion: string
  code: DiagnosisCode
  layers: PlatformHealthLayerView[]
  recentHighlight?: string | null
}
