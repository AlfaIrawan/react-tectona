import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { ErdEntityNode } from './integrationArchimateNodeTypes'
vi.mock('reactflow', () => ({ Handle: () => null, NodeResizer: () => null, NodeResizeControl: () => null, useNodeId: () => 'n', useReactFlow: () => ({ setNodes: vi.fn() }), useUpdateNodeInternals: () => vi.fn(), useStore: (selector: (state: unknown) => unknown) => selector({ transform: [0,0,1], nodesConnectable: true, edges: [], nodeInternals: new Map() }), Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' } }))
vi.mock('./InlineDiagramNodeTitle', () => ({ InlineDiagramNodeTitle: ({ value }: { value: string }) => createElement('span', null, value) }))
it('keeps long ERD columns in a bounded scroll compartment when manually resized small', () => {
 const html = renderToStaticMarkup(createElement(ErdEntityNode, { id: 'qa_child', selected: false, width: 168, height: 80, data: { kind: 'element', title: 'qa_child', description: ['*id : INTEGER', 'parent_id : INTEGER NOT NULL <<FK>>'] } } as never))
 const document = new DOMParser().parseFromString(html, 'text/html')
 const compartment = document.querySelector('[data-erd-column-compartment]')!
 expect(compartment.classList.contains('min-h-0')).toBe(true); expect(compartment.classList.contains('overflow-auto')).toBe(true); expect(compartment.parentElement?.classList.contains('overflow-hidden')).toBe(true)
 expect(compartment.textContent).toContain('parent_id : INTEGER NOT NULL')
 expect(compartment.querySelector('[title="parent_id : INTEGER NOT NULL"]')?.classList.contains('break-words')).toBe(true)
})
