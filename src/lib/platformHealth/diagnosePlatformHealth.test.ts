import { describe, expect, it } from 'vitest'
import { diagnosePlatformHealth } from './diagnosePlatformHealth'
import type { PlatformHealthResponse } from './types'

const healthyPayload: PlatformHealthResponse = {
  checked_at: '2026-08-11T00:00:00Z',
  overall: 'healthy',
  runtime_ready: true,
  application: { status: 'ok', label: 'Application', detail: 'OK' },
  services: { status: 'ok', label: 'Services', detail: 'All good' },
  database: { status: 'ok', label: 'Database', detail: 'Connected' },
  items: [],
}

const workOffline = {
  isOnline: true,
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  realtimeConnected: true,
}

describe('diagnosePlatformHealth', () => {
  it('reports all ok when platform health is healthy', () => {
    const diagnosis = diagnosePlatformHealth({
      browserOnline: true,
      health: healthyPayload,
      fetchError: null,
      workOffline,
    })
    expect(diagnosis.badgeLabel).toBe('All good')
    expect(diagnosis.code).toBe('ALL_OK')
  })

  it('detects offline network', () => {
    const diagnosis = diagnosePlatformHealth({
      browserOnline: false,
      health: null,
      fetchError: 'network',
      workOffline,
    })
    expect(diagnosis.code).toBe('NETWORK_OFFLINE')
    expect(diagnosis.badgeTone).toBe('red')
  })

  it('detects service issue when backend services layer is unavailable', () => {
    const diagnosis = diagnosePlatformHealth({
      browserOnline: true,
      health: {
        ...healthyPayload,
        overall: 'degraded',
        services: { status: 'unavailable', label: 'Services', detail: 'Project down' },
      },
      fetchError: null,
      workOffline,
    })
    expect(diagnosis.code).toBe('SERVICE_ISSUE')
  })

  it('detects database issue from database layer', () => {
    const diagnosis = diagnosePlatformHealth({
      browserOnline: true,
      health: {
        ...healthyPayload,
        overall: 'degraded',
        database: { status: 'unavailable', label: 'Database', detail: 'Disconnected' },
      },
      fetchError: null,
      workOffline,
    })
    expect(diagnosis.code).toBe('DATABASE_ISSUE')
  })

  it('marks network as slow when health check times out', () => {
    const diagnosis = diagnosePlatformHealth({
      browserOnline: true,
      health: null,
      fetchError: 'timeout',
      fetchErrorMessage: 'Request timed out',
      workOffline,
    })
    const network = diagnosis.layers.find((layer) => layer.key === 'network')
    expect(network?.status).toBe('degraded')
    expect(network?.detail).toContain('slow')
  })

  it('humanizes gateway route-not-published errors in application layer', () => {
    const raw =
      '{"error":{"code":404,"message":"no published route for GET /v1/platform-health in environment dev"}}'
    const diagnosis = diagnosePlatformHealth({
      browserOnline: true,
      health: null,
      fetchError: 'service',
      fetchErrorMessage: raw,
      workOffline,
    })
    const application = diagnosis.layers.find((layer) => layer.key === 'application')
    expect(application?.detail).toBe('Platform health route is not published on the gateway yet.')
    expect(application?.detail).not.toContain('{')
  })
})
