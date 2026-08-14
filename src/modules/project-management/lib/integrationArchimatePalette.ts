import type {
  ArchimateElementNodeData,
  ArchimateLayer,
  ArchimateNodeData,
} from '@/modules/project-management/lib/integrationArchitectureTypes'
import {
  getArchimateNotationDefinition,
  inferArchimateNotationId,
  normalizeArchimateElementData,
  ARCHIMATE_NOTATION_LAYER_COLORS,
} from '@/modules/project-management/lib/integrationArchimateNotationCatalog'
import type { Node } from 'reactflow'

export type ArchimatePaletteKind = 'element' | 'boundary' | 'note'

export type ArchimatePaletteItem = {
  id: string
  kind: ArchimatePaletteKind
  label: string
  stereotype: string
  layer?: ArchimateLayer
  notationId?: string
  defaultTitle: string
  defaultWidth?: number
  defaultHeight?: number
  hint?: string
}

export const ARCHIMATE_LAYER_COLORS = ARCHIMATE_NOTATION_LAYER_COLORS

export const ARCHIMATE_GENERAL_PALETTE_ITEMS: ArchimatePaletteItem[] = [
  {
    id: 'boundary',
    kind: 'boundary',
    label: 'Collaboration Boundary',
    stereotype: 'Boundary',
    defaultTitle: 'Collaboration Boundary',
    defaultWidth: 360,
    defaultHeight: 280,
    hint: 'Batas kolaborasi atau grouping layer',
  },
  {
    id: 'note',
    kind: 'note',
    label: 'Canvas Note',
    stereotype: 'Note',
    defaultTitle: 'Catatan',
    defaultWidth: 320,
    defaultHeight: 72,
    hint: 'Anotasi bebas pada diagram',
  },
]

/** @deprecated Use catalog sections via ArchimateNotationPalette */
export const ARCHIMATE_PALETTE_ITEMS: ArchimatePaletteItem[] = ARCHIMATE_GENERAL_PALETTE_ITEMS

export const ARCHIMATE_PALETTE_MIME = 'application/archimate-palette'

function slugifyId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'node'
}

export function createNodeFromPaletteItem(
  item: ArchimatePaletteItem,
  position: { x: number; y: number },
  existingNodeIds: Iterable<string>,
): Node<ArchimateNodeData> {
  const used = new Set(existingNodeIds)
  let base = slugifyId(item.defaultTitle)
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }

  if (item.kind === 'boundary') {
    return {
      id: candidate,
      type: 'archimateBoundary',
      position,
      data: { kind: 'boundary', title: item.defaultTitle },
      style: { width: item.defaultWidth ?? 360, height: item.defaultHeight ?? 280 },
      zIndex: 0,
    }
  }

  if (item.kind === 'note') {
    return {
      id: candidate,
      type: 'archimateNote',
      position,
      data: { kind: 'note', title: item.defaultTitle, lines: ['Tambahkan catatan di sini'] },
      style: { width: item.defaultWidth ?? 320, height: item.defaultHeight ?? 72 },
      zIndex: 2,
    }
  }

  const notationId = item.notationId ?? inferArchimateNotationId(item.layer ?? 'application', item.stereotype)
  const definition = getArchimateNotationDefinition(notationId)
  const elementData: ArchimateElementNodeData = normalizeArchimateElementData({
    kind: 'element',
    layer: definition?.layer ?? item.layer ?? 'application',
    stereotype: definition?.stereotype ?? item.stereotype,
    title: item.defaultTitle,
    description: [''],
    notationId,
  })

  return {
    id: candidate,
    type: 'archimateElement',
    position,
    data: elementData,
    style: { width: item.defaultWidth ?? definition?.defaultWidth ?? 200 },
  }
}
