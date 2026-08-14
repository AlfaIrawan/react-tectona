import { useCallback, useEffect, useState } from 'react'
import { fetchPlatformHealth } from '@/lib/api/platformHealthApi'
import { useWorkOfflineStatus } from '@/lib/work/offline/useWorkOfflineStatus'
import { diagnosePlatformHealth } from './diagnosePlatformHealth'
import { humanizePlatformHealthError } from './humanizeHealthError'
import type { PlatformHealthDiagnosis, PlatformHealthFetchError, PlatformHealthResponse } from './types'

const POLL_INTERVAL_MS = 45_000

function classifyFetchError(error: unknown): { kind: PlatformHealthFetchError; message: string } {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error')
  const lower = message.toLowerCase()
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('abort')) {
    return { kind: 'timeout', message }
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) {
    return { kind: 'network', message }
  }
  return { kind: 'service', message }
}

export function usePlatformHealth() {
  const workOffline = useWorkOfflineStatus()
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [health, setHealth] = useState<PlatformHealthResponse | null>(null)
  const [fetchError, setFetchError] = useState<PlatformHealthFetchError>(null)
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!browserOnline) {
      setHealth(null)
      setFetchError('network')
      setFetchErrorMessage('Device offline')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const payload = await fetchPlatformHealth()
      setHealth(payload)
      setFetchError(null)
      setFetchErrorMessage(null)
    } catch (error) {
      const classified = classifyFetchError(error)
      setHealth(null)
      setFetchError(classified.kind)
      setFetchErrorMessage(humanizePlatformHealthError(classified.message) ?? classified.message)
    } finally {
      setLoading(false)
    }
  }, [browserOnline])

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true)
    const onOffline = () => setBrowserOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const intervalId = window.setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [refresh])

  const diagnosis: PlatformHealthDiagnosis = diagnosePlatformHealth({
    browserOnline,
    health,
    fetchError,
    fetchErrorMessage,
    workOffline,
  })

  return {
    browserOnline,
    health,
    loading,
    diagnosis,
    refresh,
    workOffline,
  }
}
