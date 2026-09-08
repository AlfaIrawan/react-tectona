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

  it('promotes a task with two outgoing branches to a diamond gateway', () => {
    const graph = parseFlowchartFallback(`
flowchart TD
  start((Mulai)) --> A[Tim Cabang hadapi isu nasabah]
  A --> B[Tanya ke Chat Gen AI]
  B --> C[Solusi diterima Real time]
  B --> D[Sistem alihkan otomatis ke tim HO terkait]
  C --> E[Tim HO selesaikan isu]
  D --> E
  E --> done((Selesai))
`)
    expect(graph).not.toBeNull()
    const ask = graph!.nodes.find((node) => /tanya ke chat gen ai/i.test(node.label))
    expect(ask?.shape).toBe('diamond')
    expect(graph!.nodes.find((node) => /tim cabang/i.test(node.label))?.shape).toBe('rect')
  })
})
