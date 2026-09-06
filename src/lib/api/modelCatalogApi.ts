import { tectonaAgentRuntimeApiBase } from './gatewayBase'

export type CatalogModel = {
  id: string
  modelId: string
  providerId: string
  providerName: string
  name: string
  type: string
  capabilities: string[]
  contextWindow: string
  availability: 'Configured'
  isDefault: boolean
  inputPrice: number | null
  outputPrice: number | null
  bestFor: string
  tectonaCapabilities: string[]
  strengths: string[]
  capabilitySupport: Record<string, 'supported' | 'partial' | 'none'>
}

export type ModelCatalog = {
  scope: 'shared_runtime'
  updatedAt: string
  providers: { id: string; name: string; protocol: string; status: string; region: string }[]
  models: CatalogModel[]
}

export async function fetchModelCatalog(signal: AbortSignal, accessToken?: string): Promise<ModelCatalog> {
  const response = await fetch(`${tectonaAgentRuntimeApiBase()}/v1/agent/model-catalog`, {
    signal, cache: 'no-store', credentials: 'same-origin',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
  if (!response.ok) throw new Error('Unable to load AI model catalog')
  const data = await response.json() as ModelCatalog
  if (data.scope !== 'shared_runtime' || !Array.isArray(data.providers) || !Array.isArray(data.models)) {
    throw new Error('Invalid AI model catalog')
  }
  return data
}

export function catalogPrice(price: number | null): string {
  return price === null ? 'Not specified' : `Rp ${price.toLocaleString('en-US')}`
}
