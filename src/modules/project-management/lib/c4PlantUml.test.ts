import { describe, expect, it } from 'vitest'
import { normalizeC4PlantUml, parseC4Graph, serializeC4Graph } from './c4PlantUml'
import { c4GraphFromCanvas, mapC4Relations } from './c4CanvasPersistence'
const source = `@startuml
!include <C4/C4_Container>
title Architecture
LAYOUT_LEFT_RIGHT()
Person(user, "User")
Enterprise_Boundary(org, "Organisation") {
  System_Boundary(first, "First") {
    Container(api, "API", "", "Description (with brackets) and \\"quotes\\"", "tag")
  }
  Container_Boundary(second, "Second") {
    Component_Ext(worker, "Worker", "Node", "Processes jobs")
  }
}
System_Ext(bank, "Bank")
Rel(api, worker, "Requests", "HTTP")
Rel(worker, api, "Responses", "HTTP")
Rel(api, worker, "Events", "AMQP")
BiRel(user, api, "Talks", "HTTPS", "tag", "link")
Rel_L(bank, api, "Settlement")
@enduml`
function semantic(graph: ReturnType<typeof parseC4Graph>) {
  return { ...graph, boundaries: [...graph.boundaries].sort((a,b)=>a.id.localeCompare(b.id)), elements: [...graph.elements].sort((a,b)=>a.id.localeCompare(b.id)) }
}
describe('C4 data preservation', () => {
  it('keeps parallel/reverse relations, BiRel, directions, hierarchy and optional arguments through normalization and repeated serialization', () => {
    const parsed = parseC4Graph(source)
    expect(parsed.relations).toHaveLength(5)
    expect(parsed.boundaries).toHaveLength(3)
    expect(parsed.elements.find(e=>e.id==='api')).toMatchObject({ parentId:'first', technology:'', description:'Description (with brackets) and "quotes"', extraArgs:['tag'] })
    expect(parsed.elements.find(e=>e.id==='worker')).toMatchObject({ parentId:'second',kind:'Component_Ext' })
    expect(parsed.boundaries.find(b=>b.id==='second')).toMatchObject({parentId:'org',kind:'Container_Boundary'})
    expect(parseC4Graph(normalizeC4PlantUml(source))).toEqual(parsed)
    const once = parseC4Graph(serializeC4Graph(parsed,'L2'))
    expect(semantic(once)).toEqual(semantic(parsed))
    expect(semantic(parseC4Graph(serializeC4Graph(once,'L2')))).toEqual(semantic(parsed))
  })
  it('preserves long multiline labels, punctuation, backslashes and explicit empty arguments', () => {
    const graph = parseC4Graph(source)
    graph.elements[0].title = 'Long title '.repeat(40) + '[brackets] {braces} (parentheses) "quotes" \\path\nnext line'
    graph.relations[0].label = 'Relationship '.repeat(30) + '\nnext line'
    expect(semantic(parseC4Graph(serializeC4Graph(graph,'L1')))).toEqual(semantic(graph))
  })
  it('does not parse macro-looking text in comments or labels', () => {
    const graph = parseC4Graph(`' Rel(a,b,"comment")\n/' Container(hidden,"No") '/\nSystem(a,"Rel(fake,other)")\nSystem(b,"B")\nRel(a,b,"real")`)
    expect(graph.elements.map(e=>e.id)).toEqual(['a','b'])
    expect(graph.relations).toHaveLength(1)
  })
  it('preserves C4 semantics while moving/editing canvas nodes and reloading saved parallel edges', () => {
    const parsed = parseC4Graph(source)
    const nodes = [...parsed.boundaries.map(b=>({id:b.id,type:'archimateBoundary',parentNode:b.parentId,data:{kind:'boundary',title:b.title}})), ...parsed.elements.map(e=>({id:e.id,type:'c4Element',parentNode:e.parentId,data:{kind:'element',title:e.title,notationId:e.kind,description:[...(e.technology?[`[${e.technology}]`]:[]),e.description].filter(Boolean)}}))]
    const edges = parsed.relations.map(r=>({id:r.id,source:r.source,target:r.target,label:r.technology?`${r.label} [${r.technology}]`:r.label,data:{c4Relation:r}}))
    const restored = mapC4Relations(edges, edge=>({...edge}))
    expect(restored).toHaveLength(5)
    const canvas = c4GraphFromCanvas(nodes, restored, source)
    expect(semantic(parseC4Graph(serializeC4Graph(canvas,'L2')))).toEqual(semantic(parsed))
    const edited = restored.map(e=>e.id===edges[3].id?{...e,label:'New label [TLS]'}:e)
    expect(c4GraphFromCanvas(nodes,edited,source).relations[3]).toMatchObject({macro:'BiRel',label:'New label',technology:'TLS',extraArgs:['tag','link']})
  })
})
