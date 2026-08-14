import type { WorkOfflineStatus } from '@/lib/work/offline/types'
import { humanizePlatformHealthError } from './humanizeHealthError'
import {
  formatRecentFailureHighlight,
  getRecentApiFailures,
  type RecentApiFailure,
} from './recentApiFailureStore'
import type {
  DiagnosisCode,
  LayerStatus,
  PlatformHealthDiagnosis,
  PlatformHealthFetchError,
  PlatformHealthLayerView,
  PlatformHealthResponse,
} from './types'

function layerLabel(status: LayerStatus): string {
  switch (status) {
    case 'ok':
      return 'Normal'
    case 'degraded':
      return 'Limited'
    case 'unavailable':
      return 'Unavailable'
    default:
      return 'Unknown'
  }
}

function mapBackendLayer(
  key: PlatformHealthLayerView['key'],
  label: string,
  backend?: { status: LayerStatus; detail?: string | null },
  fallbackDetail?: string,
): PlatformHealthLayerView {
  const status = backend?.status ?? 'unknown'
  return {
    key,
    label,
    status,
    detail: backend?.detail?.trim() || fallbackDetail || layerLabel(status),
  }
}

function pickRecentHighlight(failures: RecentApiFailure[]): string | null {
  if (failures.length === 0) return null
  return formatRecentFailureHighlight(failures[0])
}

function hasRecentNetworkStress(failures: RecentApiFailure[]): boolean {
  return failures.some((entry) => entry.kind === 'network' || entry.kind === 'timeout')
}

function resolveNetworkLayer(input: {
  browserOnline: boolean
  fetchError: PlatformHealthFetchError
  recentNetworkStress: boolean
}): Pick<PlatformHealthLayerView, 'status' | 'detail'> {
  if (!input.browserOnline) {
    return {
      status: 'unavailable',
      detail: 'No internet connection on this device',
    }
  }
  if (input.fetchError === 'timeout') {
    return {
      status: 'degraded',
      detail: 'Connection is slow — requests are timing out',
    }
  }
  if (input.fetchError === 'network') {
    return {
      status: 'degraded',
      detail: 'Connection interrupted — cannot reach the platform',
    }
  }
  if (input.recentNetworkStress) {
    return {
      status: 'degraded',
      detail: 'Connection is slow or unstable — recent requests failed',
    }
  }
  return {
    status: 'ok',
    detail: 'Device connection is normal',
  }
}

function resolveCode(input: {
  browserOnline: boolean
  fetchError: PlatformHealthFetchError
  health: PlatformHealthResponse | null
  workOffline: WorkOfflineStatus
}): DiagnosisCode {
  const { browserOnline, fetchError, health, workOffline } = input

  if (!browserOnline) return 'NETWORK_OFFLINE'

  const appBad = health ? health.application.status !== 'ok' || !health.runtime_ready : fetchError != null
  const servicesBad = health ? health.services.status !== 'ok' : fetchError != null
  const databaseBad = health ? health.database.status === 'unavailable' || health.database.status === 'degraded' : false
  const networkLikely = fetchError === 'network' || fetchError === 'timeout'

  if (!health && networkLikely) {
    return fetchError === 'network' ? 'NETWORK_OR_GATEWAY' : 'NETWORK_OR_GATEWAY'
  }

  if (appBad && servicesBad && databaseBad) return 'UNKNOWN'
  if (appBad && servicesBad) return 'APPLICATION_AND_SERVICE'
  if (appBad && databaseBad) return 'APPLICATION_AND_DATABASE'
  if (servicesBad && databaseBad) return 'SERVICE_AND_DATABASE'
  if (databaseBad) return 'DATABASE_ISSUE'
  if (servicesBad || (!workOffline.isOnline && browserOnline)) return 'SERVICE_ISSUE'
  if (appBad) return 'APPLICATION_ISSUE'
  if (networkLikely) return 'NETWORK_OR_GATEWAY'
  if (health?.overall === 'healthy') return 'ALL_OK'
  return 'UNKNOWN'
}

function headlineForCode(code: DiagnosisCode, health: PlatformHealthResponse | null): string {
  switch (code) {
    case 'ALL_OK':
      return 'All systems are operating normally.'
    case 'NETWORK_OFFLINE':
      return 'Your device is not connected to the internet.'
    case 'NETWORK_OR_GATEWAY':
      return 'Network or platform gateway connectivity is impaired.'
    case 'APPLICATION_ISSUE':
      return 'Tectona or the gateway runtime is not ready.'
    case 'SERVICE_ISSUE':
      return 'Some backend services are not responding — your network is likely fine.'
    case 'DATABASE_ISSUE':
      return 'Backend databases are temporarily unreachable.'
    case 'SERVICE_AND_DATABASE':
      return 'Backend services and databases are experiencing issues.'
    case 'APPLICATION_AND_SERVICE':
      return 'The gateway application and backend services are impaired.'
    case 'APPLICATION_AND_DATABASE':
      return 'The gateway application and backend databases are impaired.'
    default:
      return health?.services.detail || 'Platform status needs attention.'
  }
}

function suggestionForCode(code: DiagnosisCode): string {
  switch (code) {
    case 'ALL_OK':
      return 'You can continue working as usual.'
    case 'NETWORK_OFFLINE':
      return 'Check Wi‑Fi, VPN, or corporate network, then refresh the page.'
    case 'NETWORK_OR_GATEWAY':
      return 'Refresh the page. If it persists, contact IT to verify VPN or firewall rules.'
    case 'APPLICATION_ISSUE':
      return 'Refresh the page. If it continues, contact your platform administrator.'
    case 'SERVICE_ISSUE':
      return 'Try again in a few minutes. A specific module may be temporarily unavailable.'
    case 'DATABASE_ISSUE':
      return 'Saving or loading data may fail temporarily. Contact an admin if it persists.'
    case 'SERVICE_AND_DATABASE':
    case 'APPLICATION_AND_SERVICE':
    case 'APPLICATION_AND_DATABASE':
      return 'Platform infrastructure issue. Wait a few minutes or contact an administrator.'
    default:
      return 'Refresh the page or try again later.'
  }
}

function badgeForCode(code: DiagnosisCode, health: PlatformHealthResponse | null): Pick<PlatformHealthDiagnosis, 'badgeLabel' | 'badgeTone'> {
  if (code === 'ALL_OK') {
    return { badgeLabel: 'All good', badgeTone: 'green' }
  }
  if (code === 'NETWORK_OFFLINE' || code === 'NETWORK_OR_GATEWAY') {
    return { badgeLabel: 'Offline', badgeTone: 'red' }
  }
  if (health?.overall === 'unhealthy' || code.startsWith('APPLICATION')) {
    return { badgeLabel: 'Issue', badgeTone: 'red' }
  }
  return { badgeLabel: 'Limited', badgeTone: 'amber' }
}

export function diagnosePlatformHealth(input: {
  browserOnline: boolean
  health: PlatformHealthResponse | null
  fetchError: PlatformHealthFetchError
  fetchErrorMessage?: string | null
  workOffline: WorkOfflineStatus
}): PlatformHealthDiagnosis {
  const recent = getRecentApiFailures()
  const code = resolveCode({
    browserOnline: input.browserOnline,
    fetchError: input.fetchError,
    health: input.health,
    workOffline: input.workOffline,
  })

  const networkLayer = resolveNetworkLayer({
    browserOnline: input.browserOnline,
    fetchError: input.fetchError,
    recentNetworkStress: hasRecentNetworkStress(recent),
  })

  const applicationFallback = humanizePlatformHealthError(input.fetchErrorMessage)

  const layers: PlatformHealthLayerView[] = [
    {
      key: 'network',
      label: 'Network',
      ...networkLayer,
    },
    mapBackendLayer('application', 'Application', input.health?.application, applicationFallback),
    mapBackendLayer(
      'services',
      'Services',
      input.health?.services,
      !input.workOffline.isOnline ? 'Work service unreachable' : undefined,
    ),
    mapBackendLayer('database', 'Database', input.health?.database),
  ]

  if (!input.workOffline.isOnline && input.browserOnline) {
    const servicesLayer = layers.find((layer) => layer.key === 'services')
    if (servicesLayer && servicesLayer.status === 'ok') {
      servicesLayer.status = 'degraded'
      servicesLayer.detail = 'Work service unreachable — edits saved locally'
    }
  }

  for (const layer of layers) {
    layer.detail = humanizePlatformHealthError(layer.detail) ?? layer.detail
  }

  const badge = badgeForCode(code, input.health)

  return {
    ...badge,
    code,
    headline: headlineForCode(code, input.health),
    suggestion: suggestionForCode(code),
    layers,
    recentHighlight: pickRecentHighlight(recent),
  }
}

export function badgeToneToLayerStatus(tone: 'green' | 'amber' | 'red'): LayerStatus {
  switch (tone) {
    case 'green':
      return 'ok'
    case 'amber':
      return 'degraded'
    default:
      return 'unavailable'
  }
}
