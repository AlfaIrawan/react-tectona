import type { CSSProperties } from 'react'
import type {
  ArchimateElementNodeData,
  ArchimateLayer,
} from '@/modules/project-management/lib/integrationArchitectureTypes'

export const ARCHIMATE_NOTATION_IMAGE_BASE = '/images/archimate-notation'

/** Warna fill & border selaras PNG notasi ArchiMate (draw.io). */
export const ARCHIMATE_NOTATION_LAYER_COLORS: Record<
  ArchimateLayer,
  { bg: string; border: string; accent: string; text: string }
> = {
  business: { bg: '#FFF3B0', border: '#455A64', accent: '#455A64', text: '#0f172a' },
  application: { bg: '#C8EEF9', border: '#455A64', accent: '#455A64', text: '#0f172a' },
  data: { bg: '#C8EEF9', border: '#455A64', accent: '#455A64', text: '#0f172a' },
  technology: { bg: '#C8F0C8', border: '#455A64', accent: '#455A64', text: '#0f172a' },
}

const ARCHIMATE_LAYER_FILL_GRADIENTS: Record<ArchimateLayer, string> = {
  business: 'linear-gradient(180deg, #FFFEF8 0%, #FFF3B0 52%, #FFE998 100%)',
  application: 'linear-gradient(180deg, #F5FCFF 0%, #C8EEF9 52%, #A8E2F4 100%)',
  data: 'linear-gradient(180deg, #F5FCFF 0%, #C8EEF9 52%, #A8E2F4 100%)',
  technology: 'linear-gradient(180deg, #F4FFF6 0%, #C8F0C8 52%, #B0E8B0 100%)',
}

export function getArchimateLayerFillBackground(
  layer: ArchimateLayer,
  fillColor?: string,
  fillEnabled = true,
): Pick<CSSProperties, 'background' | 'backgroundColor'> {
  if (!fillEnabled) {
    return { backgroundColor: 'transparent' }
  }
  const layerBg = ARCHIMATE_NOTATION_LAYER_COLORS[layer].bg
  if (!fillColor || fillColor.toLowerCase() === layerBg.toLowerCase()) {
    return { background: ARCHIMATE_LAYER_FILL_GRADIENTS[layer] }
  }
  return { backgroundColor: fillColor }
}

export type ArchimatePaletteSectionId = 'business' | 'application' | 'technology' | 'general'

export type ArchimateNotationDefinition = {
  id: string
  imageFile: string
  label: string
  stereotype: string
  layer: ArchimateLayer
  section: ArchimatePaletteSectionId
  defaultWidth?: number
}

const LEGACY_VARIANT_TO_NOTATION: Record<string, string> = {
  'business-role': 'business-layer-role',
  'application-component': 'application-layer-component',
  'application-service': 'application-layer-service',
  'data-object': 'application-layer-data',
  'technology-node': 'technology-layer-node',
}

const STEREOTYPE_TO_NOTATION: Record<string, string> = {
  'Business Actor': 'business-layer-actor',
  'Business Role': 'business-layer-role',
  'Business Process': 'business-layer-business-process',
  'Business Function': 'business-layer-function',
  'Business Interaction': 'business-layer-interaction',
  'Business Event': 'business-layer-event',
  'Business Service': 'business-layer-service',
  'Business Interface': 'business-layer-business-interface',
  'Business Object': 'business-layer-business-object',
  'Business Collaboration': 'business-layer-collaboration',
  Contract: 'business-layer-contract',
  Representation: 'business-layer-representation',
  Product: 'business-layer-product',
  'Application Component': 'application-layer-component',
  'Application Service': 'application-layer-service',
  'Application Process': 'application-layer-process',
  'Application Function': 'application-layer-function',
  'Application Interaction': 'application-layer-interaction',
  'Application Event': 'application-layer-event',
  'Application Interface': 'application-layer-interface',
  'Application Collaboration': 'application-layer-collaboration',
  'Application Data Object': 'application-layer-data',
  'Data Object': 'application-layer-data',
  'Technology Node': 'technology-layer-node',
}

export const ARCHIMATE_NOTATION_DEFINITIONS: ArchimateNotationDefinition[] = [
  { id: 'business-layer-actor', imageFile: 'business-layer-actor.png', label: 'Business Actor', stereotype: 'Business Actor', layer: 'business', section: 'business' },
  { id: 'business-layer-business-object', imageFile: 'business-layer-business-object.png', label: 'Business Object', stereotype: 'Business Object', layer: 'business', section: 'business' },
  { id: 'business-layer-collaboration', imageFile: 'business-layer-collaboration.png', label: 'Business Collaboration', stereotype: 'Business Collaboration', layer: 'business', section: 'business' },
  { id: 'business-layer-business-process', imageFile: 'business-layer-business-process.png', label: 'Business Process', stereotype: 'Business Process', layer: 'business', section: 'business' },
  { id: 'business-layer-function', imageFile: 'business-layer-function.png', label: 'Business Function', stereotype: 'Business Function', layer: 'business', section: 'business' },
  { id: 'business-layer-interaction', imageFile: 'business-layer-interaction.png', label: 'Business Interaction', stereotype: 'Business Interaction', layer: 'business', section: 'business' },
  { id: 'business-layer-event', imageFile: 'business-layer-event.png', label: 'Business Event', stereotype: 'Business Event', layer: 'business', section: 'business' },
  { id: 'business-layer-service', imageFile: 'business-layer-service.png', label: 'Business Service', stereotype: 'Business Service', layer: 'business', section: 'business' },
  { id: 'business-layer-business-interface', imageFile: 'business-layer-business-interface.png', label: 'Business Interface', stereotype: 'Business Interface', layer: 'business', section: 'business' },
  { id: 'business-layer-contract', imageFile: 'business-layer-contract.png', label: 'Contract', stereotype: 'Contract', layer: 'business', section: 'business' },
  { id: 'business-layer-role', imageFile: 'business-layer-role.png', label: 'Business Role', stereotype: 'Business Role', layer: 'business', section: 'business', defaultWidth: 180 },
  { id: 'business-layer-representation', imageFile: 'business-layer-representation.png', label: 'Representation', stereotype: 'Representation', layer: 'business', section: 'business' },
  { id: 'business-layer-product', imageFile: 'business-layer-product.png', label: 'Product', stereotype: 'Product', layer: 'business', section: 'business' },
  { id: 'application-layer-collaboration', imageFile: 'application-layer-collaboration.png', label: 'Application Collaboration', stereotype: 'Application Collaboration', layer: 'application', section: 'application' },
  { id: 'application-layer-component', imageFile: 'application-layer-component.png', label: 'Application Component', stereotype: 'Application Component', layer: 'application', section: 'application', defaultWidth: 210 },
  { id: 'application-layer-service', imageFile: 'application-layer-service.png', label: 'Application Service', stereotype: 'Application Service', layer: 'application', section: 'application', defaultWidth: 210 },
  { id: 'application-layer-function', imageFile: 'application-layer-function.png', label: 'Application Function', stereotype: 'Application Function', layer: 'application', section: 'application' },
  { id: 'application-layer-interaction', imageFile: 'application-layer-interaction.png', label: 'Application Interaction', stereotype: 'Application Interaction', layer: 'application', section: 'application' },
  { id: 'application-layer-interface', imageFile: 'application-layer-interface.png', label: 'Application Interface', stereotype: 'Application Interface', layer: 'application', section: 'application' },
  { id: 'application-layer-process', imageFile: 'application-layer-process.png', label: 'Application Process', stereotype: 'Application Process', layer: 'application', section: 'application' },
  { id: 'application-layer-event', imageFile: 'application-layer-event.png', label: 'Application Event', stereotype: 'Application Event', layer: 'application', section: 'application' },
  { id: 'application-layer-data', imageFile: 'application-layer-data.png', label: 'Data Object', stereotype: 'Application Data Object', layer: 'data', section: 'application', defaultWidth: 210 },
  { id: 'technology-layer-node', imageFile: 'technology-layer-node.png', label: 'Technology Node', stereotype: 'Technology Node', layer: 'technology', section: 'technology', defaultWidth: 210 },
]

export const ARCHIMATE_PALETTE_SECTIONS: Array<{ id: ArchimatePaletteSectionId; title: string }> = [
  { id: 'business', title: 'ArchiMate / Business Layer' },
  { id: 'application', title: 'ArchiMate / Application Layer' },
  { id: 'technology', title: 'ArchiMate / Technology Layer' },
  { id: 'general', title: 'General' },
]

const notationById = new Map(ARCHIMATE_NOTATION_DEFINITIONS.map((item) => [item.id, item]))

export function getArchimateNotationDefinition(notationId: string | undefined): ArchimateNotationDefinition | undefined {
  if (!notationId) return undefined
  return notationById.get(notationId)
}

export function getArchimateNotationImageUrl(notationId: string | undefined): string | undefined {
  const definition = getArchimateNotationDefinition(notationId)
  if (!definition) return undefined
  return `${ARCHIMATE_NOTATION_IMAGE_BASE}/${definition.imageFile}`
}

export function inferArchimateNotationId(
  layer: ArchimateLayer,
  stereotype: string,
  legacyVariant?: string,
): string {
  if (legacyVariant && LEGACY_VARIANT_TO_NOTATION[legacyVariant]) {
    return LEGACY_VARIANT_TO_NOTATION[legacyVariant]
  }
  const fromStereotype = STEREOTYPE_TO_NOTATION[stereotype.trim()]
  if (fromStereotype) return fromStereotype
  if (layer === 'business') return 'business-layer-role'
  if (layer === 'data') return 'application-layer-data'
  if (layer === 'technology') return 'technology-layer-node'
  return 'application-layer-component'
}

/** Cocokkan label node PlantUML ke notasi ArchiMate (mis. "Business Collaboration"). */
export function resolveArchimateFromLabel(label: string): {
  notationId: string
  layer: ArchimateLayer
  stereotype: string
} | null {
  const trimmed = label.trim()
  if (!trimmed) return null

  const lowered = trimmed.toLowerCase()
  for (const [stereotype, notationId] of Object.entries(STEREOTYPE_TO_NOTATION)) {
    if (stereotype.toLowerCase() === lowered) {
      const definition = getArchimateNotationDefinition(notationId)
      if (definition) {
        return { notationId, layer: definition.layer, stereotype: definition.stereotype }
      }
    }
  }

  for (const definition of ARCHIMATE_NOTATION_DEFINITIONS) {
    if (definition.label.toLowerCase() === lowered) {
      return { notationId: definition.id, layer: definition.layer, stereotype: definition.stereotype }
    }
  }

  return null
}

export function normalizeArchimateElementData(data: ArchimateElementNodeData): ArchimateElementNodeData {
  const legacyVariant = (data as ArchimateElementNodeData & { variant?: string }).variant
  const notationId = data.notationId ?? inferArchimateNotationId(data.layer, data.stereotype, legacyVariant)
  const definition = getArchimateNotationDefinition(notationId)
  const next: ArchimateElementNodeData = {
    ...data,
    notationId,
    layer: definition?.layer ?? data.layer,
  }
  delete (next as ArchimateElementNodeData & { variant?: string }).variant
  return next
}

export function listArchimateNotationsBySection(section: ArchimatePaletteSectionId): ArchimateNotationDefinition[] {
  return ARCHIMATE_NOTATION_DEFINITIONS.filter((item) => item.section === section)
}
