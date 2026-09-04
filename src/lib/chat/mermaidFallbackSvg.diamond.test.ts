import { describe, expect, it } from 'vitest'
import { layoutFlowchartGraph, parseFlowchartFallback } from './mermaidFallbackSvg'

describe('flowchart diamond layout', () => {
  it('keeps decision nodes square so they render as diamonds, not tilted rectangles', () => {
    const graph = parseFlowchartFallback(`
flowchart TD
  A[Dealer Submit via API]
  B{Validasi Format & NFS Routing}
  A --> B
`)
    expect(graph).not.toBeNull()
    const diamond = graph!.nodes.find((node) => node.shape === 'diamond')
    expect(diamond?.id).toBe('B')
    const { positions } = layoutFlowchartGraph(graph!)
    const box = positions.get('B')
    expect(box).toBeDefined()
    expect(box!.w).toBe(box!.h)
  })
})
