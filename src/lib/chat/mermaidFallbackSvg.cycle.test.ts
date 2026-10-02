import { describe, expect, it } from 'vitest'

import { buildFlowchartFallbackSvg, layoutFlowchartGraph, parseFlowchartFallback } from './mermaidFallbackSvg'

// "Belum clear → diskusi → review lagi": a loop back is normal in a long process.
const LOOPING_FLOW = [
  'flowchart TD',
  'A([Mulai]) --> B[Buat URD]',
  'B --> C[Review URD]',
  'C --> D{Sudah clear?}',
  'D -->|Tidak| E[Diskusi via email]',
  'E --> C',
  'D -->|Ya| F[Approval di Monday]',
  'F --> G[Assign PMO dan PO]',
  'G --> F2[Buat BRD]',
  'F2 --> H([Selesai])',
].join('\n')

describe('flowchart layout with a loop', () => {
  it('terminates and still ranks the flow top to bottom', () => {
    const graph = parseFlowchartFallback(LOOPING_FLOW)
    expect(graph).not.toBeNull()
    const started = performance.now()
    const { positions } = layoutFlowchartGraph(graph!)
    expect(performance.now() - started).toBeLessThan(500)
    const y = (id: string) => positions.get(id)!.y
    expect(y('B')).toBeLessThan(y('C'))
    expect(y('C')).toBeLessThan(y('D'))
    expect(y('D')).toBeLessThan(y('F'))
    expect(y('F')).toBeLessThan(y('H'))
    expect(buildFlowchartFallbackSvg(LOOPING_FLOW)).toContain('<svg')
  })
})
