import { describe, expect, it } from 'vitest'
import { parseUseCaseDiagram, serializeUseCaseDiagram, getUseCaseConnectionStyle } from './useCasePlantUml'
import { technicalDiagramKind, latestValidatedTechnicalDiagrams, technicalDiagramGallery } from '@/lib/chat/extractProcessDiagrams'
const source = `@startuml
actor "Customer" as customer
actor "Member" as member
rectangle "Shop" as shop {
usecase "Place order" as order
usecase "Pay" as pay
usecase "Discount" as discount
}
customer -- order
member --|> customer
order ..> pay : <<include>>
discount ..> order : <<extend>>
@enduml`
describe('use case UML', () => {
  it('recognizes use cases before actor-based sequence detection and persists the slot', () => {
    expect(technicalDiagramKind(source)).toBe('use-case')
    expect(latestValidatedTechnicalDiagrams('```plantuml\n' + source + '\n```')[0].kind).toBe('use-case')
  })
  it('round trips actors, use cases, boundary membership and correct relationship direction', () => {
    const graph = parseUseCaseDiagram(source)
    const round = parseUseCaseDiagram(serializeUseCaseDiagram(graph.nodes, graph.edges))
    expect(round.nodes.map(n => [n.id, n.data.notationId])).toEqual(graph.nodes.map(n => [n.id, n.data.notationId]))
    expect(round.nodes.find(n => n.id === 'pay')?.data.description).toEqual(['boundary:shop'])
    expect(round.edges.map(e => [e.source,e.target,e.data.useCaseRelation])).toEqual([
      ['customer','order','association'], ['member','customer','generalization'], ['order','pay','include'], ['discount','order','extend'],
    ])
    expect(getUseCaseConnectionStyle('generalization').data?.targetDecoration).toBe('triangle')
    expect(getUseCaseConnectionStyle('include').data?.targetDecoration).toBe('arrow')
  })
  it('normalizes reverse arrows without flipping semantic direction', () => {
    const graph = parseUseCaseDiagram(source.replace('member --|> customer','customer <|-- member').replace('order ..> pay','pay <.. order'))
    expect(graph.edges[1].source).toBe('member')
    expect(graph.edges[2].target).toBe('pay')
  })
  it('preserves saved graph title edits and moved-out boundary membership', () => {
    const graph = parseUseCaseDiagram(source)
    const pay = graph.nodes.find(n => n.id === 'pay')!
    pay.data.title = 'Confirm payment'
    pay.position.x = 900
    const saved = serializeUseCaseDiagram(graph.nodes, graph.edges)
    expect(saved).toContain('usecase "Confirm payment" as pay')
    expect(parseUseCaseDiagram(saved).nodes.find(n => n.id === 'pay')?.data.description).toEqual([])
  })
  it('keeps saved manual use cases authoritative over repeated drafts and empty generation', () => {
    const saved = source.replace('Place order', 'Manually reviewed order')
    const slot = (draft: string) => technicalDiagramGallery([{ kind: 'use-case', label: 'Use Case', source: draft }], { 'brainstorm-use-case': { source: saved } }).find(d => d.kind === 'use-case')
    expect(slot(source)?.source).toBe(saved)
    expect(slot('')?.source).toBe(saved)
  })
  it('does not invent nodes for empty evidence or unknown edge endpoints', () => {
    expect(parseUseCaseDiagram('')).toEqual({nodes:[], edges:[]})
    expect(parseUseCaseDiagram(source + '\nunknown -- order').edges).toHaveLength(4)
  })
})
