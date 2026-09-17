import type { Node } from 'reactflow'
import { c4Stereotype, isC4External, type C4ElementKind } from '@/modules/project-management/lib/c4PlantUml'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

export const C4_PALETTE_MIME = 'application/c4-palette'

export type C4PaletteItem = {
  id: string
  label: string
  defaultTitle: string
  kind: 'boundary' | C4ElementKind
  fill: string
  shape: 'person' | 'box' | 'cylinder' | 'boundary'
}

export const C4_PALETTE_ITEMS: C4PaletteItem[] = [
  { id: 'person', label: 'Person', defaultTitle: 'Person', kind: 'Person', fill: '#08427B', shape: 'person' },
  { id: 'system', label: 'Software System', defaultTitle: 'Software System', kind: 'System', fill: '#1168BD', shape: 'box' },
  { id: 'system-ext', label: 'External System', defaultTitle: 'External System', kind: 'System_Ext', fill: '#999999', shape: 'box' },
  { id: 'container', label: 'Container', defaultTitle: 'Container', kind: 'Container', fill: '#438DD5', shape: 'box' },
  { id: 'component', label: 'Component', defaultTitle: 'Component', kind: 'Component', fill: '#85BBF0', shape: 'box' },
  { id: 'container-db', label: 'Database', defaultTitle: 'Database', kind: 'ContainerDb', fill: '#438DD5', shape: 'cylinder' },
  { id: 'container-ext', label: 'External Container', defaultTitle: 'External Container', kind: 'Container_Ext', fill: '#999999', shape: 'box' },
  { id: 'boundary', label: 'System Boundary', defaultTitle: 'System Boundary', kind: 'boundary', fill: '#ffffff', shape: 'boundary' },
]

function uniqueNodeId(base: string, existing: Iterable<string>): string {
  const used = new Set(existing)
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'element'
  let candidate = slug
  let index = 2
  while (used.has(candidate)) {
    candidate = `${slug}_${index}`
    index += 1
  }
  return candidate
}

export function createC4NodeFromPaletteItem(
  item: C4PaletteItem,
  position: { x: number; y: number },
  existingNodeIds: Iterable<string>,
): Node<ArchimateNodeData> {
  const id = uniqueNodeId(item.defaultTitle, existingNodeIds)
  if (item.kind === 'boundary') {
    return {
      id,
      type: 'archimateBoundary',
      position,
      zIndex: 0,
      style: { width: 360, height: 280 },
      data: {
        kind: 'boundary',
        title: item.defaultTitle,
        visual: { fillEnabled: false, lineEnabled: true, lineColor: '#64748b', lineStyle: 'dashed', rounded: true },
      },
    }
  }

  const external = isC4External(item.kind)
  const isContainerLike = item.kind.startsWith('Container') || item.kind === 'Component'
  return {
    id,
    type: 'c4Element',
    position,
    zIndex: 1,
    style: { width: 240, height: item.kind.includes('Person') ? 128 : 120 },
    data: {
      kind: 'element',
      layer: 'application',
      stereotype: c4Stereotype(item.kind),
      title: item.defaultTitle,
      description: isContainerLike ? ['[Application]', 'Description'] : ['Description'],
      notationId: item.kind,
      visual: {
        fillEnabled: true,
        fillColor: item.fill,
        lineEnabled: true,
        lineColor: external ? '#8A8A8A' : '#3C7FC0',
        lineWidth: 1.5,
        lineStyle: 'solid',
        rounded: true,
        shadow: true,
      },
    },
  }
}
