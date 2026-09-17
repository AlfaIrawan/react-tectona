import type { Node } from 'reactflow'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'
import { bpmnDefaultLineColor, bpmnNodeSizeForType } from '@/modules/project-management/lib/bpmnNotationSpec'

export const BPMN_PALETTE_MIME = 'application/bpmn-palette'

export type BpmnPaletteItemKind = 'shape' | 'flow'

export type BpmnPaletteItem = {
  id: string
  label: string
  defaultTitle: string
  bpmnType: string
  kind?: BpmnPaletteItemKind
}

export type BpmnPaletteGroup = {
  id: string
  label: string
  items: BpmnPaletteItem[]
}

function item(id: string, label: string, bpmnType: string, defaultTitle = label, kind: BpmnPaletteItemKind = 'shape'): BpmnPaletteItem {
  return { id, label, defaultTitle, bpmnType, kind }
}

function flow(id: string, label: string, bpmnType: string): BpmnPaletteItem {
  return item(id, label, bpmnType, label, 'flow')
}

export const BPMN_PALETTE_GROUPS: BpmnPaletteGroup[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    items: [
      item('task', 'Task', 'task'),
      item('service-task', 'Service Task', 'serviceTask'),
      item('send-task', 'Send Task', 'sendTask'),
      item('receive-task', 'Receive Task', 'receiveTask'),
      item('user-task', 'User Task', 'userTask'),
      item('manual-task', 'Manual Task', 'manualTask'),
      item('business-rule-task', 'Business Rule Task', 'businessRuleTask'),
      item('script-task', 'Script Task', 'scriptTask'),
      item('reference-task', 'Reference Task', 'referenceTask'),
      item('call-activity', 'Call Activity', 'callActivity'),
    ],
  },
  {
    id: 'subprocess',
    label: 'Sub-Process',
    items: [
      item('sub-process', 'Sub-Process', 'subProcess'),
      item('embedded-sub-process', 'Embedded Sub-Process', 'embeddedSubProcess'),
      item('reusable-sub-process', 'Reusable Sub-Process', 'reusableSubProcess'),
      item('event-sub-process', 'Event Sub-Process', 'eventSubProcess'),
      item('reference-sub-process', 'Reference Sub-Process', 'referenceSubProcess'),
    ],
  },
  {
    id: 'start',
    label: 'Start Events',
    items: [
      item('start', 'Start Event', 'startEvent', 'Start'),
      item('message-start', 'Message Start Event', 'messageStartEvent', 'Message Start'),
      item('timer-start', 'Timer Start Event', 'timerStartEvent', 'Timer Start'),
      item('error-start', 'Error Start Event', 'errorStartEvent', 'Error Start'),
      item('escalation-start', 'Escalation Start Event', 'escalationStartEvent', 'Escalation Start'),
      item('compensation-start', 'Compensation Start Event', 'compensationStartEvent', 'Compensation Start'),
      item('conditional-start', 'Conditional Start Event', 'conditionalStartEvent', 'Conditional Start'),
      item('signal-start', 'Signal Start Event', 'signalStartEvent', 'Signal Start'),
      item('multiple-start', 'Multiple Start Event', 'multipleStartEvent', 'Multiple Start'),
      item('parallel-multiple-start', 'Parallel Multiple Start Event', 'parallelMultipleStartEvent', 'Parallel Start'),
    ],
  },
  {
    id: 'intermediate',
    label: 'Intermediate Events',
    items: [
      item('intermediate', 'Intermediate Event', 'intermediateEvent', 'Intermediate'),
      item('message-intermediate', 'Message Intermediate Event', 'messageIntermediateEvent', 'Message'),
      item('timer-intermediate', 'Timer Intermediate Event', 'timerIntermediateEvent', 'Timer'),
      item('error-intermediate', 'Error Intermediate Event', 'errorIntermediateEvent', 'Error'),
      item('escalation-intermediate', 'Escalation Intermediate Event', 'escalationIntermediateEvent', 'Escalation'),
      item('cancel-intermediate', 'Cancel Intermediate Event', 'cancelIntermediateEvent', 'Cancel'),
      item('compensation-intermediate', 'Compensation Intermediate Event', 'compensationIntermediateEvent', 'Compensation'),
      item('conditional-intermediate', 'Conditional Intermediate Event', 'conditionalIntermediateEvent', 'Conditional'),
      item('link-intermediate', 'Link Intermediate Event', 'linkIntermediateEvent', 'Link'),
      item('signal-intermediate', 'Signal Intermediate Event', 'signalIntermediateEvent', 'Signal'),
      item('multiple-intermediate', 'Multiple Intermediate Event', 'multipleIntermediateEvent', 'Multiple'),
      item('parallel-multiple-intermediate', 'Parallel Multiple Intermediate Event', 'parallelMultipleIntermediateEvent', 'Parallel Multiple'),
    ],
  },
  {
    id: 'end',
    label: 'End Events',
    items: [
      item('end', 'End Event', 'endEvent', 'End'),
      item('message-end', 'Message End Event', 'messageEndEvent', 'Message End'),
      item('error-end', 'Error End Event', 'errorEndEvent', 'Error End'),
      item('escalation-end', 'Escalation End Event', 'escalationEndEvent', 'Escalation End'),
      item('cancel-end', 'Cancel End Event', 'cancelEndEvent', 'Cancel End'),
      item('compensation-end', 'Compensation End Event', 'compensationEndEvent', 'Compensation End'),
      item('signal-end', 'Signal End Event', 'signalEndEvent', 'Signal End'),
      item('terminate-end', 'Terminate End Event', 'terminateEndEvent', 'Terminate'),
      item('multiple-end', 'Multiple End Event', 'multipleEndEvent', 'Multiple End'),
    ],
  },
  {
    id: 'gateways',
    label: 'Gateways',
    items: [
      item('gateway', 'Gateway', 'gateway'),
      item('exclusive', 'Data-Based Exclusive (XOR)', 'exclusiveGateway', 'Gateway'),
      item('event-based', 'Event-Based Exclusive (XOR)', 'eventBasedGateway', 'Gateway'),
      item('inclusive', 'Inclusive (OR)', 'inclusiveGateway', 'Gateway'),
      item('complex', 'Complex', 'complexGateway', 'Gateway'),
      item('parallel', 'Parallel (AND)', 'parallelGateway', 'Gateway'),
    ],
  },
  {
    id: 'flows',
    label: 'Flows',
    items: [
      flow('sequence-flow', 'Sequence Flow', 'sequenceFlow'),
      flow('expression-sequence-flow', 'Expression Sequence Flow', 'expressionSequenceFlow'),
      flow('default-sequence-flow', 'Default Sequence Flow', 'defaultSequenceFlow'),
      flow('message-flow', 'Message Flow', 'messageFlow'),
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    items: [
      item('horizontal-pool', 'Horizontal Pool', 'horizontalPool', 'Pool'),
      item('vertical-pool', 'Vertical Pool', 'verticalPool', 'Pool'),
      item('lane', 'Lane', 'lane', 'Lane'),
      item('group', 'Group', 'group', 'Group'),
      item('choreography-task', 'Choreography Task', 'choreographyTask'),
      item('choreography-sub-process', 'Choreography Sub-Process', 'choreographySubProcess'),
      item('call-choreography', 'Call Choreography Activity', 'callChoreographyActivity'),
      item('call-activity-collab', 'Call Activity', 'callActivity'),
    ],
  },
  {
    id: 'artifacts',
    label: 'Artifacts',
    items: [
      item('annotation', 'Text Annotation', 'textAnnotation', 'Annotation'),
    ],
  },
]

export const BPMN_PALETTE_ITEMS: BpmnPaletteItem[] = BPMN_PALETTE_GROUPS.flatMap((group) => group.items)

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

export function createBpmnNodeFromPaletteItem(
  item: BpmnPaletteItem,
  position: { x: number; y: number },
  existingNodeIds: Iterable<string>,
): Node<ArchimateNodeData> {
  const size = bpmnNodeSizeForType(item.bpmnType)
  const isDashed = item.bpmnType === 'group' || item.bpmnType === 'eventSubProcess'
  return {
    id: uniqueNodeId(item.id, existingNodeIds),
    type: 'bpmnElement',
    position,
    style: { width: size.width, height: size.height },
    zIndex: item.bpmnType.includes('Pool') || item.bpmnType === 'lane' || item.bpmnType === 'group' ? 0 : 1,
    data: {
      kind: 'element',
      layer: 'business',
      stereotype: item.label,
      title: item.defaultTitle,
      description: [],
      notationId: item.bpmnType,
      visual: {
        fillEnabled: true,
        fillColor: item.bpmnType === 'textAnnotation' || item.bpmnType === 'group' ? 'transparent' : '#ffffff',
        lineEnabled: true,
        lineColor: bpmnDefaultLineColor(item.bpmnType),
        lineWidth: 2,
        lineStyle: isDashed ? 'dashed' : 'solid',
        rounded: !['textAnnotation', 'horizontalPool', 'verticalPool', 'lane'].includes(item.bpmnType),
      },
    },
  }
}
