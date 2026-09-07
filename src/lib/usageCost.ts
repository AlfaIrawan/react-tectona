import type { ModelCatalog } from './api/modelCatalogApi'
import type { TokenTelemetryEvent } from './tokenTelemetry'

export type UsageCost = {
  amount: number | null
  source: 'recorded' | 'current_catalog' | 'unavailable'
}

/**
 * Prefer the rate captured with the event. Older/local events may only contain
 * tokens; for those, use current catalog pricing after an exact deployment match.
 */
export function usageCost(event: TokenTelemetryEvent, catalog: ModelCatalog | null): UsageCost {
  if (typeof event.totalCostIdr === 'number' && Number.isFinite(event.totalCostIdr)) {
    return { amount: event.totalCostIdr, source: 'recorded' }
  }
  if (!catalog || !event.model) return { amount: null, source: 'unavailable' }

  const exactModels = catalog.models.filter((model) => model.modelId === event.model)
  const matched = event.provider
    ? exactModels.find((model) => catalog.providers.some((provider) =>
        provider.id === model.providerId && provider.protocol === event.provider))
    : exactModels.length === 1 ? exactModels[0] : undefined
  if (!matched) return { amount: null, source: 'unavailable' }

  const inputTokens = event.inputTokens ?? 0
  const outputTokens = event.outputTokens ?? 0
  if ((inputTokens > 0 && matched.inputPrice === null) ||
      (outputTokens > 0 && matched.outputPrice === null)) {
    return { amount: null, source: 'unavailable' }
  }
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return { amount: null, source: 'unavailable' }
  }
  return {
    amount: inputTokens / 1_000_000 * (matched.inputPrice ?? 0) +
      outputTokens / 1_000_000 * (matched.outputPrice ?? 0),
    source: 'current_catalog',
  }
}

export function applyCatalogPricing(event: TokenTelemetryEvent, catalog: ModelCatalog | null): TokenTelemetryEvent {
  const cost = usageCost(event, catalog)
  return cost.amount === null ? event : { ...event, totalCostIdr: cost.amount }
}
