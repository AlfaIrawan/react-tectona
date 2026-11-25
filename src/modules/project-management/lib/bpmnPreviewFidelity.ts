import { cleanDiagramLabel, parseBpmnSource, toBpmnEditorSource } from '@/modules/project-management/lib/bpmnPlantUml'

/** Fail closed: the native editor is a permissive parser, not a fidelity validator. */
export function canPreviewBpmnLosslessly(source: string): boolean {
  const text = source.trim()
  if (!/^@startuml\s*\n/.test(text) || !/\n@enduml$/.test(text)) return false
  if (/tectona-view:\s*(?:archimate|c4|use-case|erd|class|sequence)\b/i.test(text)) return false
  // The canonical process canvas currently draws sequence arrows only.
  if ([...text.matchAll(/^\s*'\s*tectona-bpmn-flow\s+\d+\s+(\w+)/gm)].some(match => match[1] !== 'sequenceFlow')) return false
  const nodes = new Map<string, string>()
  const lanes = new Map<string, string>()
  const edges: Array<{ source: string; target: string; label: string }> = []
  let style = false
  for (const raw of text.split(/\r?\n/).slice(1, -1)) {
    const line = raw.trim()
    if (!line) continue
    if (line === '<style>') { if (style) return false; style = true; continue }
    if (line === '</style>') { if (!style) return false; style = false; continue }
    if (style) {
      if (!/^(?:rectangle\s*\{|\}|MinimumWidth\s+\d+|HorizontalAlignment\s+(?:left|center|right))$/.test(line)) return false
      continue
    }
    const lane = /^'\s*lane\s+([\w.-]+)\s*:\s*(.+)$/.exec(line)
    if (lane) { if (lanes.has(lane[1])) return false; lanes.set(lane[1], lane[2]); continue }
    // Only explicitly supported metadata is harmless here. Unknown comments can
    // encode semantic extensions and must not be silently ignored.
    if (/^'\s*(?:tectona-upload-explicit-graph-v1|tectona-bpmn: 1)$/.test(line)) continue
    if (/^'\s*tectona-bpmn-flow\s+\d+\s+sequenceFlow$/.test(line)) continue
    if (/^'\s*tectona-bpmn-node\s+[\w.-]+\s+(?:startEvent|endEvent|task|userTask|serviceTask|scriptTask|exclusiveGateway|parallelGateway|inclusiveGateway|textAnnotation)\s+(?:activity|decision|start|end)$/.test(line)) continue
    if (/^skinparam\s+(?:wrapWidth\s+\d+|shadowing\s+(?:true|false)|defaultFontName\s+[\w -]+|roundcorner\s+\d+)$/.test(line) || /^(?:top to bottom|left to right) direction$/.test(line)) continue
    const node = /^(?:\(\)|circle|rectangle|hexagon|usecase|note)\s+"([^"\n]+)"\s+as\s+([\w.-]+)$/.exec(line)
    if (node) {
      if (nodes.has(node[2]) || !node[1].trim() || /\\(?!n)/.test(node[1])) return false
      nodes.set(node[2], cleanDiagramLabel(node[1]))
      continue
    }
    const edge = /^([\w.-]+)\s*--?>\s*([\w.-]+)(?:\s*:\s*(.+))?$/.exec(line)
    if (edge) {
      if (/\\(?!n)/.test(edge[3] ?? '')) return false
      edges.push({ source: edge[1], target: edge[2], label: cleanDiagramLabel(edge[3] ?? '') })
      continue
    }
    return false
  }
  if (style || !nodes.size || [...lanes.keys()].some(id => !nodes.has(id))) return false
  if (edges.some(edge => !nodes.has(edge.source) || !nodes.has(edge.target))) return false
  const signature = (items: typeof edges) => items.map(e => JSON.stringify([e.source, e.target, e.label || ''])).sort().join('\n')
  try {
    const parsed = parseBpmnSource(source)
    const converted = parseBpmnSource(toBpmnEditorSource(source))
    for (const graph of [parsed, converted]) {
      if (graph.nodes.length !== nodes.size || signature(graph.edges.map(e => ({ ...e, label: e.label ?? '' }))) !== signature(edges)) return false
      if (graph.nodes.some(n => {
        const original = nodes.get(n.id)
        // The canonical canvas moves an exact actor prefix into its swimlane header.
        const sameText = original === n.label || original === `${n.lane}: ${n.label}`
        return !sameText || (lanes.has(n.id) && lanes.get(n.id) !== n.lane)
      })) return false
    }
    // Preserve inferred lane membership and notation through the editor's conversion too.
    const semantics = (graph: typeof parsed) => graph.nodes.map(n => JSON.stringify([n.id, n.label, n.kind, n.bpmnType, n.lane ?? ''])).sort().join('\n')
    return semantics(parsed) === semantics(converted)
  } catch {
    return false
  }
}
