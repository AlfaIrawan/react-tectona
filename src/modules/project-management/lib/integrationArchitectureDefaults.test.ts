import { describe, expect, it } from 'vitest'
import type { Node } from 'reactflow'
import {
  isIntegrationNodeContainable,
  normalizeIntegrationNodesForCanvas,
} from '@/modules/project-management/lib/integrationArchitectureDefaults'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

const boundary = (containable?: boolean): Node<ArchimateNodeData> => ({
  id: 'parent',
  type: 'archimateBoundary',
  position: { x: 100, y: 80 },
  style: { width: 360, height: 280 },
  data: {
    kind: 'boundary',
    title: 'Collaboration Boundary',
    arrange: containable === undefined ? undefined : { containable },
  },
})

const child = (parentNode?: string): Node<ArchimateNodeData> => ({
  id: 'child',
  type: 'archimateElement',
  position: parentNode ? { x: 60, y: 70 } : { x: 160, y: 150 },
  parentNode,
  extent: parentNode ? 'parent' : undefined,
  style: { width: 180, height: 80 },
  data: {
    kind: 'element',
    layer: 'business',
    stereotype: 'Business Actor',
    title: 'Business Actor',
    description: [],
    notationId: 'business-layer-actor',
    arrange: { containable: false },
  },
})

describe('normalizeIntegrationNodesForCanvas', () => {
  it('keeps a non-containable node as a child of a containable parent', () => {
    const result = normalizeIntegrationNodesForCanvas([boundary(), child('parent')])
    const normalizedChild = result.find((node) => node.id === 'child')

    expect(normalizedChild?.parentNode).toBe('parent')
    expect(normalizedChild?.position).toEqual({ x: 60, y: 70 })
    expect(normalizedChild?.extent).toBeUndefined()
  })

  it('detaches a child when its parent is not containable', () => {
    const result = normalizeIntegrationNodesForCanvas([boundary(false), child('parent')])
    const normalizedChild = result.find((node) => node.id === 'child')

    expect(normalizedChild?.parentNode).toBeUndefined()
    expect(normalizedChild?.position).toEqual({ x: 160, y: 150 })
  })

  it('adopts an existing root node that is visually inside a boundary', () => {
    const result = normalizeIntegrationNodesForCanvas([boundary(), child()])
    const normalizedChild = result.find((node) => node.id === 'child')

    expect(normalizedChild?.parentNode).toBe('parent')
    expect(normalizedChild?.position).toEqual({ x: 60, y: 70 })
  })
})

describe('isIntegrationNodeContainable', () => {
  it('requires an element to be explicitly enabled as a parent', () => {
    const actor = child()
    expect(isIntegrationNodeContainable(actor)).toBe(false)
    expect(isIntegrationNodeContainable({
      ...actor,
      data: { ...actor.data, arrange: { containable: true } },
    })).toBe(true)
  })
})
