import { describe, expect, it } from 'vitest'
import { usageCost } from './usageCost'
import type { ModelCatalog } from './api/modelCatalogApi'
import type { TokenTelemetryEvent } from './tokenTelemetry'

const catalog: ModelCatalog = {
  scope: 'shared_runtime', updatedAt: '2026-09-07T00:00:00Z',
  providers: [{ id: 'p1', name: 'Lintasarta', protocol: 'openai_compat', status: 'Configured', region: 'Indonesia' }],
  models: [{ id: 'm1', modelId: 'qwen/exact', providerId: 'p1', providerName: 'Lintasarta', name: 'Qwen exact',
    type: 'Not specified', capabilities: [], contextWindow: 'Not specified', availability: 'Configured', isDefault: true,
    inputPrice: 2223, outputPrice: 15390, bestFor: 'Not specified', tectonaCapabilities: [], strengths: [], capabilitySupport: {} }],
}
const event = (overrides: Partial<TokenTelemetryEvent> = {}): TokenTelemetryEvent => ({
  id: 'e1', source: 'user', kind: 'used', event: 'AI completion', category: 'llm',
  model: 'qwen/exact', provider: 'openai_compat', inputTokens: 1_000_000, outputTokens: 1_000_000,
  occurredAt: '2026-09-07T00:00:00Z', ...overrides,
})

describe('usage cost', () => {
  it('preserves the price recorded at event time', () => {
    expect(usageCost(event({ totalCostIdr: 99 }), catalog)).toEqual({ amount: 99, source: 'recorded' })
  })
  it('uses current catalog rates for an exact provider and model match', () => {
    expect(usageCost(event(), catalog)).toEqual({ amount: 17613, source: 'current_catalog' })
  })
  it('accepts an absent provider only when the exact model is unambiguous', () => {
    expect(usageCost(event({ provider: undefined }), catalog).amount).toBe(17613)
  })
  it('does not guess by model family or across providers', () => {
    expect(usageCost(event({ model: 'qwen/other' }), catalog).amount).toBeNull()
    expect(usageCost(event({ provider: 'other' }), catalog).amount).toBeNull()
  })
  it('requires pricing only for token directions that were consumed', () => {
    const missingOutput = { ...catalog, models: [{ ...catalog.models[0], outputPrice: null }] }
    expect(usageCost(event({ outputTokens: 0 }), missingOutput).amount).toBe(2223)
    expect(usageCost(event(), missingOutput).amount).toBeNull()
  })
})
