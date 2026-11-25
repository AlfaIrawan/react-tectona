import { describe, expect, it } from 'vitest'
import { bpmnGraphToPlantUml, bpmnXmlToPlantUml, isBpmnXml, parseBpmnSource, serializeBpmnCanvasToPlantUml } from '@/modules/project-management/lib/bpmnPlantUml'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="Start_1" name="Isu Nasabah Ditemukan"/>
    <bpmn:task id="Task_1" name="Bertanya via Chat GenAI"/>
    <bpmn:exclusiveGateway id="Gw_1" name="GenAI Bisa Menjawab?"/>
    <bpmn:endEvent id="End_1" name="Isu Selesai Instan"/>
    <bpmn:sequenceFlow id="f1" sourceRef="Start_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="Task_1" targetRef="Gw_1"/>
    <bpmn:sequenceFlow id="f3" sourceRef="Gw_1" targetRef="End_1" name="Ya"/>
  </bpmn:process>
</bpmn:definitions>`

describe('bpmnPlantUml', () => {
  it('detects BPMN XML', () => {
    expect(isBpmnXml(SAMPLE_XML)).toBe(true)
    expect(isBpmnXml('@startuml\nrectangle "A" as a\n@enduml')).toBe(false)
  })

  it('converts BPMN XML to PlantUML graph source', () => {
    const plantuml = bpmnXmlToPlantUml(SAMPLE_XML)
    expect(plantuml).toContain('@startuml')
    expect(plantuml).toContain('() "Isu Nasabah Ditemukan" as Start_1')
    expect(plantuml).toContain('rectangle "Bertanya via Chat GenAI" as Task_1')
    expect(plantuml).toContain('hexagon "GenAI Bisa Menjawab?" as Gw_1')
    expect(plantuml).toContain('Start_1 --> Task_1')
    expect(plantuml).toContain('Gw_1 --> End_1 : Ya')
    expect(plantuml).toContain('@enduml')
  })

  it('parses the converted PlantUML back to the same topology', () => {
    const graph = parseBpmnSource(bpmnXmlToPlantUml(SAMPLE_XML))
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(['End_1', 'Gw_1', 'Start_1', 'Task_1'])
    expect(graph.nodes.find((node) => node.id === 'Gw_1')?.kind).toBe('decision')
    expect(graph.edges.some((edge) => edge.source === 'Gw_1' && edge.target === 'End_1' && edge.label === 'Ya')).toBe(true)
  })

  it('parses mermaid flowcharts as BPMN start, task, gateway, and end', () => {
    const graph = parseBpmnSource(`flowchart TD
      Start((Mulai)) --> Task[Lapor tiket]
      Task --> Gw{Butuh eskalasi?}
      Gw -->|Ya| End((Selesai))
    `)
    expect(graph.nodes.find((node) => node.id === 'Start')?.bpmnType).toBe('startEvent')
    expect(graph.nodes.find((node) => node.id === 'Task')?.bpmnType).toBe('task')
    expect(graph.nodes.find((node) => node.id === 'Gw')?.kind).toBe('decision')
    expect(graph.nodes.find((node) => node.id === 'End')?.bpmnType).toBe('endEvent')
    expect(graph.edges.some((edge) => edge.source === 'Gw' && edge.target === 'End' && edge.label === 'Ya')).toBe(true)
  })

  it('keeps the full mermaid task label, including quoted text and line breaks', () => {
    const graph = parseBpmnSource(`flowchart TD
      Start((Mulai)) --> Task["Saat ini ketika ada isu di nasabah dan cabang tidak tahu<br/>apa yang harus dilakukan"]
      Task --> End((Selesai))
    `)
    expect(graph.nodes.find((node) => node.id === 'Task')?.label).toBe(
      'Saat ini ketika ada isu di nasabah dan cabang tidak tahu apa yang harus dilakukan',
    )
  })

  it('puts each named participant on its own swimlane, like the brainstorm diagram', () => {
    const graph = parseBpmnSource(`@startuml
      () "Isu diterima Tim Cabang" as StartEvent_1
      rectangle "Tim Cabang: Interaksi dengan Chat Gen AI" as Task_Chat
      hexagon "Jenis Isu?" as Gateway_Issue
      rectangle "Ivanti: Otomasi Pembuatan Tiket (via API)" as Task_Ivanti
      rectangle "Chat Gen AI: Pemberian Jawaban Real-time (Policy/Process)" as Task_Answer
      StartEvent_1 --> Task_Chat
      Task_Chat --> Gateway_Issue
      Gateway_Issue --> Task_Ivanti
      Gateway_Issue --> Task_Answer
      @enduml`)
    expect(graph.nodes.find((node) => node.id === 'StartEvent_1')?.lane).toBe('Tim Cabang')
    expect(graph.nodes.find((node) => node.id === 'Task_Chat')?.lane).toBe('Tim Cabang')
    expect(graph.nodes.find((node) => node.id === 'Task_Ivanti')?.lane).toBe('Ivanti')
    expect(graph.nodes.find((node) => node.id === 'Gateway_Issue')?.lane).toBe('Tim Cabang')
    expect(graph.nodes.find((node) => node.id === 'Task_Answer')?.lane).toBe('Chat Gen AI')
  })

  it('does not infer ownership from an application mentioned as a destination', () => {
    const graph = parseBpmnSource(`@startuml
      rectangle "Clerk: validate invoice" as check
      rectangle "Store invoice in Archive" as store
      check --> store
      @enduml`)
    expect(graph.nodes.find(node => node.id === 'check')?.lane).toBe('Clerk')
    expect(graph.nodes.find(node => node.id === 'store')?.lane).toBe('Unassigned')
  })

  it('hides escape characters and does not repeat the swimlane name inside the task', () => {
    const graph = parseBpmnSource(`@startuml
      rectangle "Nasabah: melaporkan isu\\nke\\\\nTim Cabang" as Task_Report
      rectangle "Tim Cabang: chat dengan\\nChat Gen AI" as Task_Chat
      Task_Report --> Task_Chat
      @enduml`)
    expect(graph.nodes.find((node) => node.id === 'Task_Report')?.label).toBe('melaporkan isu ke Tim Cabang')
    expect(graph.nodes.find((node) => node.id === 'Task_Report')?.lane).toBe('Nasabah')
    expect(graph.nodes.find((node) => node.id === 'Task_Chat')?.label).toBe('chat dengan Chat Gen AI')
    expect(graph.nodes.find((node) => node.id === 'Task_Chat')?.label).not.toMatch(/\\/)
  })

  it('repairs a misplaced Start event and serializes BPMN vertically', () => {
    const graph = parseBpmnSource(`@startuml
      left to right direction
      rectangle "Cabang temukan isu nasabah" as activity_1
      rectangle "Tim HO proses penyelesaian" as activity_2
      () "Start" as process_start
      () "End" as process_end
      activity_1 --> activity_2
      activity_2 --> process_start
      process_start --> process_end
      @enduml`)

    expect(graph.edges.some((edge) => edge.source === 'process_start' && edge.target === 'activity_1')).toBe(true)
    expect(graph.edges.some((edge) => edge.source === 'activity_2' && edge.target === 'process_end')).toBe(true)
    expect(graph.edges.some((edge) => edge.source === 'activity_2' && edge.target === 'process_start')).toBe(false)

    const plantuml = bpmnGraphToPlantUml(graph)
    expect(plantuml).toContain('top to bottom direction')
    expect(plantuml.indexOf('() "Start" as process_start')).toBeLessThan(plantuml.indexOf('rectangle "Cabang temukan isu nasabah" as activity_1'))
  })
})


it('preserves explicit canvas lane metadata through source serialization', () => {
  const source = serializeBpmnCanvasToPlantUml([
    { id: 'a', type: 'bpmnElement', position: { x: 999, y: 999 }, data: { kind: 'element', layer: 'business', stereotype: 'Task', title: 'Review', description: [], notationId: 'task', ...{ bpmnLane: 'Reviewer' } } },
    { id: 'b', type: 'bpmnElement', position: { x: 0, y: 0 }, data: { kind: 'element', layer: 'business', stereotype: 'Task', title: 'Submit', description: [], notationId: 'task' } },
  ], [])
  const graph = parseBpmnSource(source)
  expect(graph.nodes.find(node => node.id === 'a')?.lane).toBe('Reviewer')
  expect(graph.nodes.find(node => node.id === 'b')?.lane).toBeUndefined()
})

it.each(['', '<bpmn:messageFlow id="m" sourceRef="a" targetRef="b"/>'])('does not invent sequence flows from XML without supported edges: %s', extra => {
  const source = bpmnXmlToPlantUml(`<bpmn:definitions><bpmn:process><bpmn:task id="a"/><bpmn:task id="b"/>${extra}</bpmn:process></bpmn:definitions>`)
  expect(source).not.toContain('a --> b')
})

it('recovers legacy lane membership only by exact source IDs', () => {
  const nodes = [{ id: 'a', type: 'bpmnElement', position: { x: 999, y: 999 }, data: { kind: 'element' as const, layer: 'business' as const, stereotype: 'Task', title: 'Edited', description: [], notationId: 'task' } }]
  const original = bpmnGraphToPlantUml({ nodes: [{ id: 'a', label: 'Old', kind: 'activity', bpmnType: 'task', lane: 'Reviewer' }], edges: [] })
  const graph = parseBpmnSource(serializeBpmnCanvasToPlantUml(nodes, [], original))
  expect(graph.nodes[0]?.lane).toBe('Reviewer')
  expect(graph.nodes[0]?.label).toBe('Edited')
  const renamed = original.replace('Reviewer', 'Approver')
  expect(parseBpmnSource(serializeBpmnCanvasToPlantUml(nodes, [], renamed)).nodes[0]?.lane).toBe('Approver')
  expect(serializeBpmnCanvasToPlantUml([{ ...nodes[0], id: 'unknown' }], [], original)).toBe(original)
})


it('keeps known unassigned and explicitly new unassigned nodes editable in a laned graph', () => {
  const node = (id: string, title: string, bpmnLane?: string | null) => ({ id, type: 'bpmnElement', position: { x: 0, y: 0 }, data: { kind: 'element' as const, layer: 'business' as const, stereotype: 'Task', title, description: [], notationId: 'task', bpmnLane } })
  const original = serializeBpmnCanvasToPlantUml([node('a', 'Review', 'Reviewer'), node('b', 'Old')], [])
  const edited = serializeBpmnCanvasToPlantUml([node('a', 'Review'), node('b', 'Edited'), node('c', 'New', null)], [{ id: 'e', source: 'a', target: 'b', label: 'Continue' }], original)
  expect(edited).toContain('Edited')
  expect(edited).toContain('New')
  expect(edited).toContain('a --> b : Continue')
  expect(edited).toContain("' lane a: Reviewer")
  expect(edited).not.toContain("' lane b:")
  expect(edited).not.toContain("' lane c:")
  expect(serializeBpmnCanvasToPlantUml([node('a', 'Review'), node('legacy-unknown', 'Unknown')], [], original)).toBe(original)
})
