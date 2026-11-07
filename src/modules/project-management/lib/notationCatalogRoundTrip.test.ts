import { describe, expect, it } from 'vitest'
import { parseUmlDiagram, serializeUmlDiagram, umlLinkFromCanvasEdge, umlLinkToCanvasData, umlRelationDefaults, erdRelationDefaults } from './classErdPlantUml'
import { C4_PALETTE_ITEMS, createC4NodeFromPaletteItem } from './c4NotationPalette'
import { c4GraphFromCanvas } from './c4CanvasPersistence'
import { parseC4Graph, serializeC4Graph } from './c4PlantUml'
import { parseBpmnSource, serializeBpmnCanvasToPlantUml, toBpmnEditorSource, aliasPlantUml } from './bpmnPlantUml'
import { BPMN_PALETTE_ITEMS, createBpmnNodeFromPaletteItem } from './bpmnNotationPalette'
import { classifyBpmnType } from './bpmnNotationSpec'
import { CLASS_ITEMS, ERD_ITEMS } from './umlNotationCatalog'

describe('notation catalog and semantic source round trips', () => {
  it.each(['--', '-->', '<--', 'o--', '--o', '*--', '--*', '<|--', '--|>', '<|..', '..|>', '..>'])('preserves UML connector %s through canvas and source', connector => {
    const parsed = parseUmlDiagram(`@startuml\nclass A\ninterface B\nA "1" ${connector} "0..*" B : works\n@enduml`, 'class')
    expect(parsed.links).toHaveLength(1)
    const link = parsed.links[0]
    const restored = umlLinkFromCanvasEdge({ source: link.source, target: link.target, label: link.label, data: umlLinkToCanvasData(link) }, 'class')
    const output = serializeUmlDiagram({ ...parsed, links: [restored] })
    expect(output).toContain(`A "1" ${connector} "0..*" B : works`)
    expect(parseUmlDiagram(output, 'class').links).toEqual(parsed.links)
  })
  it.each(['||--||', '||--o|', '||--o{', '}o..o{', '}|--|{'])('preserves ERD cardinality %s', connector => {
    const parsed = parseUmlDiagram(`entity A\nentity B\nA ${connector} B`, 'erd')
    expect(parsed.links).toHaveLength(1)
    const link = parsed.links[0]
    const restored = umlLinkFromCanvasEdge({ source: 'A', target: 'B', data: umlLinkToCanvasData(link) }, 'erd')
    expect(serializeUmlDiagram({ ...parsed, links: [restored] })).toContain(`A ${connector} B`)
  })
  it('every UML palette relation has meaningful serialized semantics', () => {
    for (const item of CLASS_ITEMS.filter(i => i.relation)) {
      const relation = item.relation as Parameters<typeof umlRelationDefaults>[0]
      const link = { source: 'A', target: 'B', label: '', ...umlRelationDefaults(relation) }
      expect(parseUmlDiagram(serializeUmlDiagram({ view: 'class', boxes: [], links: [link] }), 'class').links[0].relation).toBe(relation)
    }
  })
  it('ERD optional variants carry endpoint semantics', () => {
    for (const item of ERD_ITEMS.filter(i => i.relation)) {
      const data = erdRelationDefaults(item.relation!)
      const link = umlLinkFromCanvasEdge({ source: 'A', target: 'B', data }, 'erd')
      const result = parseUmlDiagram(serializeUmlDiagram({ view: 'erd', boxes: [], links: [link] }), 'erd').links[0]
      expect(result.targetEnd).toEqual({ many: data.targetMany, optional: data.targetOptional })
    }
  })
  it('preserves duplicate/paste UUID aliases and nested C4 boundaries with matching edge endpoints', () => {
    const a = 'original-copy-4bd4baf0-1234-4567-8899-0123456789ab'
    const b = 'original-copy-9bd4baf0-1234-4567-8899-0123456789ab'
    const uml = parseUmlDiagram(`class "Copied A" as ${a}\ninterface "Copied B" as ${b}\n${a} ..|> ${b}`, 'class')
    const restoredUml = parseUmlDiagram(serializeUmlDiagram(uml), 'class')
    expect(restoredUml.boxes.map(box => box.id)).toEqual([a, b])
    expect(restoredUml.links[0]).toMatchObject({ source: a, target: b, relation: 'realization' })
    const source = `@startuml\nSystem_Boundary(root, "Root") {\nContainer_Boundary(nested, "Nested") {\nContainer(${a}, "A", "Web")\nContainerDb(${b}, "B", "SQL")\n}\n}\nRel(${a}, ${b}, "reads")\n@enduml`
    const c4 = parseC4Graph(serializeC4Graph(parseC4Graph(source), 'L2'))
    expect(c4.boundaries.find(item => item.id === 'nested')?.parentId).toBe('root')
    expect(c4.elements.map(item => item.parentId)).toEqual(['nested', 'nested'])
    expect(c4.relations[0]).toMatchObject({ source: a, target: b })
  })
  it('existing BPMN event and gateway palette types create the correct rendered semantic family', () => {
    for (const item of BPMN_PALETTE_ITEMS.filter(item => /Event$|Gateway$/.test(item.bpmnType))) {
      const node = createBpmnNodeFromPaletteItem(item, { x: 0, y: 0 }, [])
      expect(node.data.kind === 'element' && node.data.notationId).toBe(item.bpmnType)
      const spec = classifyBpmnType(item.bpmnType)
      if (item.bpmnType.endsWith('Gateway')) expect(spec.family).toBe('gateway')
      else {
        expect(spec.family).toBe('event')
        expect(spec.eventPhase).toBe(item.bpmnType.includes('End') || item.bpmnType === 'endEvent' ? 'end' : item.bpmnType.includes('Intermediate') || item.bpmnType === 'intermediateEvent' ? 'intermediate' : 'start')
      }
    }
    expect(classifyBpmnType('timerIntermediateEvent')).toMatchObject({ eventMarker: 'timer', eventPhase: 'intermediate' })
    expect(classifyBpmnType('parallelGateway').gateway).toBe('parallel')
    expect(classifyBpmnType('eventBasedGateway').gateway).toBe('eventBased')
  })
  it.each(['high', 'detail'])('retains BPMN subtype and flow semantics through the %s editor source pipeline', () => {
    const items = BPMN_PALETTE_ITEMS.filter(item => item.kind !== 'flow')
    const nodes = items.map((item, index) => ({ ...createBpmnNodeFromPaletteItem(item, { x: index * 100, y: 0 }, []), id: `${item.id}-copy-${index}` }))
    const flowKinds = ['sequenceFlow', 'messageFlow', 'expressionSequenceFlow', 'defaultSequenceFlow']
    const edges = flowKinds.map((bpmnFlowType, index) => ({ id: `e${index}`, source: nodes[index].id, target: nodes[index + 1].id, label: `flow ${index}`, data: { bpmnFlowType } }))
    const source = serializeBpmnCanvasToPlantUml(nodes, edges)
    const restored = parseBpmnSource(toBpmnEditorSource(source))
    for (const node of nodes) expect(restored.nodes.find(item => item.id === aliasPlantUml(node.id))?.bpmnType).toBe(node.data.kind === 'element' ? node.data.notationId : '')
    expect(restored.edges.map(edge => edge.bpmnFlowType)).toEqual(flowKinds)
    const withoutFirstArrow = source.split('\n').filter(line => !line.startsWith(`${aliasPlantUml(edges[0].source)} -->`)).join('\n')
    expect(parseBpmnSource(withoutFirstArrow).edges.map(edge => edge.bpmnFlowType)).toEqual(flowKinds.slice(1))
    expect(restored.edges.map(edge => [edge.source, edge.target])).toEqual(edges.map(edge => [aliasPlantUml(edge.source), aliasPlantUml(edge.target)]))
  })
  it('does not invent BPMN connections for unconnected palette nodes and respects source deletion', () => {
    const nodes = BPMN_PALETTE_ITEMS.filter(item => ['timer-start', 'parallel'].includes(item.id)).map(item => createBpmnNodeFromPaletteItem(item, { x: 0, y: 0 }, []))
    const source = serializeBpmnCanvasToPlantUml(nodes, [])
    expect(parseBpmnSource(source).edges).toEqual([])
    const edited = source.split('\n').filter(line => !line.includes(' as timer_start')).join('\n')
    expect(parseBpmnSource(edited).nodes.map(node => node.id)).not.toContain('timer_start')
  })
  it('all eleven supported C4 element kinds are creatable and retain identity through source', () => {
    const elements = C4_PALETTE_ITEMS.filter(i => i.kind !== 'boundary')
    expect(new Set(elements.map(i => i.kind)).size).toBe(11)
    const nodes = elements.map(item => createC4NodeFromPaletteItem(item, { x: 0, y: 0 }, []))
    const graph = c4GraphFromCanvas(nodes, [], '')
    expect(serializeC4Graph(graph, 'L2')).toContain('!include <C4/C4_Component>')
    const restored = parseC4Graph(serializeC4Graph(graph, 'L2'))
    expect(restored.elements.map(e => e.kind)).toEqual(elements.map(i => i.kind))
    expect(restored.elements.find(e => e.kind === 'Component_Ext')?.technology).toBe('Application')
  })
})
