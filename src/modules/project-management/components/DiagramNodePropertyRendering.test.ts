import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ArchimateBoundaryNode, ArchimateNoteNode, ArchimateImageNode, C4ElementNode, BpmnElementNode, UmlClassNode, ErdEntityNode, UmlUseCaseNode } from './integrationArchimateNodeTypes'
vi.mock('reactflow', () => ({ Handle: () => null, NodeResizer: () => null, NodeResizeControl: () => null, useNodeId: () => 'n', useReactFlow: () => ({ setNodes: vi.fn() }), useUpdateNodeInternals: () => vi.fn(), useStore: (selector: (state: unknown) => unknown) => selector({ transform: [0,0,1], nodesConnectable: true, edges: [], nodeInternals: new Map() }), Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' } }))
vi.mock('./InlineDiagramNodeTitle', () => ({ InlineDiagramNodeTitle: ({ value }: { value: string }) => createElement('span', null, value) }))
const textStyle = { fontFamily: 'Georgia', fontSize: 23, bold: true, italic: true, underline: true, fontColor: '#123456', wordWrap: false, angle: 25, offsetX: -8, offsetY: 4, boxWidth: 130, boxHeight: 70, verticalAlign: 'bottom' }
const visual = { fillEnabled: true, fillColor: '#abcdef', lineColor: '#123456', lineWidth: 5, lineStyle: 'dotted', opacity: 60, rounded: false, shadow: false }
function render(component: unknown, data: unknown) { return renderToStaticMarkup(createElement(component as never, { id: 'n', data, selected: false, width: 200, height: 120 } as never)) }
describe('node renderer property effects', () => {
  it.each(['usecase', 'system-boundary'])('keeps %s outlines and configurable visual properties', notationId => {
    const data = { kind: 'element', title: 'Use case', notationId, description: [] }
    const defaults = render(UmlUseCaseNode, data)
    expect(defaults).toContain('border-width:1px')
    expect(defaults).toContain('border-style:solid')
    const styled = render(UmlUseCaseNode, { ...data, visual })
    expect(styled).toContain('border-width:5px')
    expect(styled).toContain('border-style:dotted')
    expect(styled).toContain('#123456')
    expect(styled).toContain('#abcdef')
    expect(render(UmlUseCaseNode, { ...data, visual: { ...visual, lineEnabled: false } })).toContain('border-width:0')
  })

  it.each([['UML', UmlClassNode, ['name : String', 'save()']], ['ERD', ErdEntityNode, ['name : String', '*id : UUID', 'owner_id : UUID']]])('applies %s member typography without moving compartment rows', (_name, component, description) => {
    const html = render(component, { kind: 'element', title: 'Title', stereotype: 'class', description, textStyle })
    const document = new DOMParser().parseFromString(html, 'text/html')
    const row = [...document.querySelectorAll('span,p')].find(el => el.textContent === 'name : String' && el.getAttribute('style')?.includes('font-family')) as HTMLElement
    expect(row).toBeTruthy()
    expect(row.style.fontFamily).toBe('Georgia')
    expect(row.style.fontSize).toBe('23px')
    expect(row.style.fontWeight).toBe('700')
    expect(row.style.fontStyle).toBe('italic')
    expect(row.style.whiteSpace).toBe('nowrap')
    expect(row.style.color).toBe('rgb(18, 52, 86)')
    expect(row.style.transform).toBe('')
    expect(row.style.width).toBe('')
  })

  it('aligns an external BPMN label inside its configured box without forcing wrapping', () => {
    const html = render(BpmnElementNode, { kind: 'element', title: 'Event label', notationId: 'startEvent', description: [], visual, textStyle })
    expect(html).toContain('data-diagram-node-label')
    expect(html).toContain('display:flex;flex-direction:column;justify-content:flex-end')
    expect(html).toContain('white-space:nowrap')
    expect(html).toContain('height:70px')
  })
  it('does not add an unconfigurable second border on an image', () => {
    const html = render(ArchimateImageNode, { kind: 'image', src: 'data:image/png;base64,test', alt: 'Fixture', visual: { ...visual, lineEnabled: false } })
    expect(html).toContain('border-width:0')
    expect(html).toContain('border-radius:inherit')
    expect(html).not.toContain('border-slate-200')
  })
  it.each([['boundary', ArchimateBoundaryNode, { kind: 'boundary' }], ['note', ArchimateNoteNode, { kind: 'note', lines: ['Detail'] }], ['C4', C4ElementNode, { kind: 'element', stereotype: 'Container', description: ['Detail'] }], ['BPMN task', BpmnElementNode, { kind: 'element', stereotype: 'task', notationId: 'task', description: [] }], ['UML', UmlClassNode, { kind: 'element', stereotype: 'class', description: [] }], ['ERD', ErdEntityNode, { kind: 'element', description: [] }]])('renders %s visual and text properties', (_name, component, extra) => {
    const html = render(component, { ...extra, title: 'Changed title', visual, textStyle })
    for (const fragment of ['Changed title', '#abcdef', 'border-width:5px', 'border-style:dotted', 'opacity:0.6', 'font-family:Georgia', 'font-size:23px', 'rotate(25deg)', 'translate(-8px, 4px)', 'width:130px', 'white-space:nowrap']) expect(html).toContain(fragment)
  })
})
