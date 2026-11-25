import { afterEach, expect, it, vi } from 'vitest'

vi.mock('web-vitals', () => ({ onCLS: vi.fn(), onINP: vi.fn(), onLCP: vi.fn() }))

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

it('backs off failed telemetry and never observes its own metrics request', async () => {
  vi.useFakeTimers()
  let clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => ++clock)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  vi.stubEnv('VITE_REGISTRY_RUM_API_KEY', 'test-only-key')
  vi.stubEnv('VITE_REGISTRY_API_URL', 'same-origin')
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(new Response('{}'))
  vi.stubGlobal('fetch', fetcher)
  const { initRum } = await import('./rum')
  initRum()
  await vi.advanceTimersByTimeAsync(0)
  expect(fetcher).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(15000)
  expect(fetcher).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(15000)
  expect(fetcher).toHaveBeenCalledTimes(2)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  await vi.advanceTimersByTimeAsync(15000)
  expect(fetcher).toHaveBeenCalledTimes(2)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  await vi.advanceTimersByTimeAsync(15000)
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(JSON.parse(fetcher.mock.calls[2][1].body).api_latency_sample_count).toBe(0)
  await vi.advanceTimersByTimeAsync(60000)
  expect(fetcher).toHaveBeenCalledTimes(3)
})
