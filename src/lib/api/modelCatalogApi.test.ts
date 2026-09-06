import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogPrice, fetchModelCatalog } from './modelCatalogApi'

vi.mock('./gatewayBase', () => ({ tectonaAgentRuntimeApiBase: () => '/api/tectona-agent-runtime' }))
afterEach(() => vi.unstubAllGlobals())

describe('model catalog API', () => {
  it('fetches the current catalog every time and forwards cancellation/auth', async () => {
    const first = { scope: 'shared_runtime', providers: [], models: [{ modelId: 'old/exact-version' }] }
    const second = { ...first, models: [{ modelId: 'new/exact-version' }] }
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => first })
      .mockResolvedValueOnce({ ok: true, json: async () => second })
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect((await fetchModelCatalog(signal, 'session-token')).models[0].modelId).toBe('old/exact-version')
    expect((await fetchModelCatalog(signal, 'session-token')).models[0].modelId).toBe('new/exact-version')
    expect(fetch).toHaveBeenLastCalledWith('/api/tectona-agent-runtime/v1/agent/model-catalog',
      expect.objectContaining({ cache: 'no-store', signal, headers: { Authorization: 'Bearer session-token' } }))
  })
  it('does not substitute a hardcoded catalog on errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(fetchModelCatalog(new AbortController().signal)).rejects.toThrow('Unable to load')
  })
  it('rejects incompatible payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    await expect(fetchModelCatalog(new AbortController().signal)).rejects.toThrow('Invalid')
  })
  it('distinguishes missing pricing from a zero rate', () => {
    expect(catalogPrice(null)).toBe('Not specified')
    expect(catalogPrice(0)).toBe('Rp 0')
    expect(catalogPrice(2223)).toBe('Rp 2,223')
  })
})
