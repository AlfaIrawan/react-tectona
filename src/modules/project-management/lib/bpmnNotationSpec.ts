export type BpmnEventPhase = 'start' | 'intermediate' | 'end'
export type BpmnEventMarker =
  | 'none'
  | 'message'
  | 'timer'
  | 'error'
  | 'escalation'
  | 'compensation'
  | 'conditional'
  | 'signal'
  | 'multiple'
  | 'parallelMultiple'
  | 'terminate'
  | 'cancel'
  | 'link'
export type BpmnTaskMarker = 'none' | 'user' | 'service' | 'send' | 'receive' | 'manual' | 'businessRule' | 'script' | 'call'
export type BpmnGatewayKind = 'none' | 'exclusive' | 'parallel' | 'inclusive' | 'eventBased' | 'complex'
export type BpmnShapeFamily =
  | 'event'
  | 'gateway'
  | 'task'
  | 'subprocess'
  | 'pool'
  | 'lane'
  | 'group'
  | 'annotation'
  | 'choreography'

export type BpmnShapeClass = {
  family: BpmnShapeFamily
  eventPhase?: BpmnEventPhase
  eventMarker?: BpmnEventMarker
  taskMarker?: BpmnTaskMarker
  gateway?: BpmnGatewayKind
  expanded?: boolean
  eventSubprocess?: boolean
}

const EVENT_MARKER_FROM_PREFIX: Array<[string, BpmnEventMarker]> = [
  ['parallelMultiple', 'parallelMultiple'],
  ['multiple', 'multiple'],
  ['message', 'message'],
  ['timer', 'timer'],
  ['error', 'error'],
  ['escalation', 'escalation'],
  ['compensation', 'compensation'],
  ['conditional', 'conditional'],
  ['signal', 'signal'],
  ['terminate', 'terminate'],
  ['cancel', 'cancel'],
  ['link', 'link'],
]

export function classifyBpmnType(type: string): BpmnShapeClass {
  const id = type || 'task'
  if (id === 'textAnnotation') return { family: 'annotation' }
  if (id === 'group') return { family: 'group' }
  if (id === 'lane') return { family: 'lane' }
  if (id === 'horizontalPool' || id === 'verticalPool' || id === 'pool') return { family: 'pool' }
  if (id.toLowerCase().includes('choreography')) return { family: 'choreography' }
  if (id.toLowerCase().includes('gateway')) {
    if (id.includes('parallel')) return { family: 'gateway', gateway: 'parallel' }
    if (id.includes('inclusive')) return { family: 'gateway', gateway: 'inclusive' }
    if (id.includes('eventBased') || id.includes('event')) return { family: 'gateway', gateway: 'eventBased' }
    if (id.includes('complex')) return { family: 'gateway', gateway: 'complex' }
    if (id.includes('exclusive') || id.includes('xor')) return { family: 'gateway', gateway: 'exclusive' }
    return { family: 'gateway', gateway: 'none' }
  }
  if (/Event$/i.test(id) || /StartEvent|EndEvent|Intermediate/i.test(id)) {
    const eventPhase: BpmnEventPhase = /end/i.test(id) ? 'end' : /intermediate/i.test(id) ? 'intermediate' : 'start'
    const eventMarker = EVENT_MARKER_FROM_PREFIX.find(([prefix]) => id.toLowerCase().startsWith(prefix.toLowerCase()))?.[1] ?? 'none'
    return { family: 'event', eventPhase, eventMarker }
  }
  if (/subProcess|callActivity/i.test(id)) {
    return {
      family: 'subprocess',
      expanded: /embedded/i.test(id),
      eventSubprocess: /eventSubProcess/i.test(id),
      taskMarker: /call/i.test(id) || /reference/i.test(id) ? 'call' : 'none',
    }
  }
  const taskMarker: BpmnTaskMarker = /user/i.test(id)
    ? 'user'
    : /service/i.test(id)
      ? 'service'
      : /send/i.test(id)
        ? 'send'
        : /receive/i.test(id)
          ? 'receive'
          : /manual/i.test(id)
            ? 'manual'
            : /businessRule/i.test(id)
              ? 'businessRule'
              : /script/i.test(id)
                ? 'script'
                : /call/i.test(id) || /reference/i.test(id)
                  ? 'call'
                  : 'none'
  return { family: 'task', taskMarker }
}

export function bpmnNodeSizeForType(type: string): { width: number; height: number } {
  const kind = classifyBpmnType(type)
  if (kind.family === 'event') return { width: 48, height: 48 }
  if (kind.family === 'gateway') return { width: 76, height: 76 }
  if (kind.family === 'annotation') return { width: 168, height: 72 }
  if (kind.family === 'pool') return type === 'verticalPool' ? { width: 180, height: 420 } : { width: 520, height: 180 }
  if (kind.family === 'lane') return { width: 500, height: 90 }
  if (kind.family === 'group') return { width: 260, height: 160 }
  if (kind.family === 'subprocess' || kind.family === 'choreography') return { width: 220, height: 120 }
  return { width: 176, height: 88 }
}

export function isBpmnSquareShape(type: string): boolean {
  const kind = classifyBpmnType(type)
  return kind.family === 'event' || kind.family === 'gateway'
}

export const BPMN_GENERIC_LINE_COLOR = '#0f172a'

export function bpmnDefaultLineColor(type: string): string {
  const kind = classifyBpmnType(type)
  if (kind.family === 'event') {
    if (kind.eventPhase === 'end') return '#c0392b'
    if (kind.eventPhase === 'intermediate') return '#d68910'
    return '#1e8449'
  }
  if (kind.family === 'gateway') return '#b7950b'
  if (kind.family === 'pool' || kind.family === 'lane') return '#0284c7'
  if (kind.family === 'group') return '#64748b'
  return BPMN_GENERIC_LINE_COLOR
}

export function bpmnResolvedLineColor(type: string, lineColor?: string): string {
  if (lineColor && lineColor !== BPMN_GENERIC_LINE_COLOR) return lineColor
  return bpmnDefaultLineColor(type)
}
