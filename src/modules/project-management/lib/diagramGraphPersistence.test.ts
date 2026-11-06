import { describe, expect, it } from 'vitest'
import { isStoredDiagramGraph } from './diagramGraphPersistence'
import { IDEA_INTEGRATION_GRAPH_STORAGE_KEY, loadIntegrationGraph, saveIntegrationGraph } from './integrationGraphStorage'

describe('saved diagram recovery', () => {
  it('accepts populated and intentionally empty documents and rejects damaged records', () => {
    expect(isStoredDiagramGraph({ nodes: [{ id: 'new', position: { x: 42, y: 80 }, data: {} }], edges: [] })).toBe(true)
    expect(isStoredDiagramGraph({ nodes: [], edges: [], source: '@startuml\n@enduml' })).toBe(true)
    expect(isStoredDiagramGraph(undefined)).toBe(false)
    expect(isStoredDiagramGraph({ nodes: [], edges: null })).toBe(false)
    expect(isStoredDiagramGraph({ nodes: [{ id: 'broken' }], edges: [] })).toBe(false)
  })
  it('round-trips an empty ArchiMate document instead of resurrecting a default graph', () => {
    localStorage.removeItem(IDEA_INTEGRATION_GRAPH_STORAGE_KEY)
    const record = { nodes: [], edges: [], plantumlSource: '@startuml\n@enduml', userCustomized: true, savedAt: '2026-11-06T00:00:00Z' }
    saveIntegrationGraph('disposable-test', record)
    expect(loadIntegrationGraph('disposable-test')).toEqual(record)
    localStorage.removeItem(IDEA_INTEGRATION_GRAPH_STORAGE_KEY)
  })
})
