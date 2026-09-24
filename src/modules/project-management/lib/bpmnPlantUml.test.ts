import { describe, expect, it } from 'vitest'
import { bpmnGraphToPlantUml, bpmnXmlToPlantUml, isBpmnXml, parseBpmnSource } from '@/modules/project-management/lib/bpmnPlantUml'

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
      'Saat ini ketika ada isu di nasabah dan cabang tidak tahu\napa yang harus dilakukan',
    )
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
