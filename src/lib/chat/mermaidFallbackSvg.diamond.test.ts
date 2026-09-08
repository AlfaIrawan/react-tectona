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

  it('places XOR branches symmetrically around the gateway', () => {
    const graph = parseFlowchartFallback(`
flowchart TD
  start((Mulai)) --> A[Tanya ke Chat Gen AI]
  A --> gw{AI bisa jawab?}
  gw -->|Ya| C[Isu selesai secara real-time]
  gw -->|Tidak| D[Alihkan ke tim HO terkait]
  C --> done((Selesai))
  D --> ho[Tim HO selesaikan isu]
  ho --> done2((Selesai))
`)
    expect(graph).not.toBeNull()
    const { positions } = layoutFlowchartGraph(graph!)
    const gw = positions.get('gw')!
    const left = positions.get('C')!
    const right = positions.get('D')!
    const gwCx = gw.x + gw.w / 2
    const leftCx = left.x + left.w / 2
    const rightCx = right.x + right.w / 2
    expect(Math.abs(gwCx - leftCx - (rightCx - gwCx))).toBeLessThan(8)
    expect(left.y).toBe(right.y)
    expect(leftCx).toBeLessThan(gwCx)
    expect(rightCx).toBeGreaterThan(gwCx)
  })
})
