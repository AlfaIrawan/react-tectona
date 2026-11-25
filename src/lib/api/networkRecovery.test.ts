import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithNetworkRecovery } from './networkRecovery'

describe('network recovery', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('recovers a read once with the original headers and signal', async () => {
    const response = new Response('{}')
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(response)
    vi.stubGlobal('fetch', fetcher)
    const init = { headers: { Authorization: 'Bearer test-only' }, signal: new AbortController().signal }
    const pending = fetchWithNetworkRecovery('/api/channels', init)
    await vi.advanceTimersByTimeAsync(600)
    expect(await pending).toBe(response)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenLastCalledWith('/api/channels', init)
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('never replays %s', async method => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetcher)
    await expect(fetchWithNetworkRecovery('/api/changes', { method, body: '{}' })).rejects.toThrow('Failed to fetch')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403, 500])('does not retry HTTP %s', async status => {
    const response = new Response('', { status })
    const fetcher = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetcher)
    expect(await fetchWithNetworkRecovery('/api/channels')).toBe(response)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('honors cancellation during the retry delay', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    const pending = fetchWithNetworkRecovery('/api/channels', { signal: controller.signal })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(1)
    controller.abort()
    await rejected
    await vi.runAllTimersAsync()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not retry while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetcher)
    await expect(fetchWithNetworkRecovery('/api/channels')).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not retry programming errors', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Invalid URL'))
    vi.stubGlobal('fetch', fetcher)
    await expect(fetchWithNetworkRecovery('/api/channels')).rejects.toThrow('Invalid URL')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stops after the second network failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetcher)
    const pending = expect(fetchWithNetworkRecovery('/api/channels')).rejects.toThrow('Failed to fetch')
    await vi.runAllTimersAsync()
    await pending
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
