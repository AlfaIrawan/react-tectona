import { describe, expect, it } from 'vitest'
import { bpmnXmlToPlantUml, isBpmnXml, parseBpmnSource } from '@/modules/project-management/lib/bpmnPlantUml'

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
})
