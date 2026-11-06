import type { Edge, Node } from 'reactflow'

export type DiagramGraph = { nodes: Node[]; edges: Edge[]; source: string }
export type DiagramHistory<T> = { past: T[]; present: T; future: T[] }

/** Selection and React Flow's measured/drag state are not document edits. */
export function diagramGraphKey(graph: DiagramGraph): string {
  return JSON.stringify({
    nodes: graph.nodes.map(value => {
      const { selected, dragging, resizing, positionAbsolute, measured, width, height, ...node } = value as Node & { resizing?: boolean; measured?: unknown }
      return { ...node, width: Number(width ?? node.style?.width ?? 0), height: Number(height ?? node.style?.height ?? 0) }
    }),
    edges: graph.edges.map(({ selected, ...edge }) => edge),
  })
}

export function recordDiagramEdit<T extends DiagramGraph>(history: DiagramHistory<T>, graph: T, limit = 100): DiagramHistory<T> {
  if (diagramGraphKey(history.present) === diagramGraphKey(graph)) return { ...history, present: graph }
  return { past: [...history.past, history.present].slice(-limit), present: graph, future: [] }
}

export function undoDiagramEdit<T>(history: DiagramHistory<T>): DiagramHistory<T> {
  if (!history.past.length) return history
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future] }
}

export function redoDiagramEdit<T>(history: DiagramHistory<T>): DiagramHistory<T> {
  if (!history.future.length) return history
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) }
}
