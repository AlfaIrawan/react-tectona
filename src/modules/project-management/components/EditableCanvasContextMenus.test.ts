/* eslint-disable @typescript-eslint/no-explicit-any -- Renderer boundary captures deliberately heterogeneous ReactFlow props. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from 'reactflow'
import { EditableDiagramCanvas } from './EditableDiagramCanvas'
import { EditableIntegrationArchitectureCanvas } from './EditableIntegrationArchitectureCanvas'

// Exercise real editor menus/state; isolate renderer, backend, and browser export boundaries.
const probe = vi.hoisted(() => ({ flow: {} as any, chat: vi.fn(), copyImage: vi.fn(), image: vi.fn(async () => 'data:image/png;base64,test') }))
vi.mock('./IntegrationArchitectureFlow', () => ({ IntegrationArchitectureFlow: (props: any) => { probe.flow = props; return createElement('div', { 'data-testid': 'flow' }) } }))
vi.mock('reactflow', async original => ({ ...await original<typeof import('reactflow')>(), useReactFlow: () => ({ screenToFlowPosition: (p: any) => p }) }))
vi.mock('@/auth/TenantContext', () => ({ useTenantContextOptional: () => null }))
vi.mock('@/lib/api/tectonaKbApi', () => ({ listAllKbEntries: vi.fn(async () => []) }))
vi.mock('@/lib/workspaceOrgDirectoryCache', () => ({ fetchAllWorkspaceOrgWorkspacesCached: vi.fn(async () => []) }))
vi.mock('@/lib/kb/applicationCatalogRealtime', () => ({ subscribeToApplicationCatalogChanges: () => () => {} }))
vi.mock('@/lib/api/ideaBacklogApi', () => ({ createDiagramAiDraftAudit: vi.fn(), listDiagramAiDraftAudit: vi.fn(async () => []) }))
vi.mock('@/stores/chat-navigation-store', () => ({ requestOpenIdeaDiscussChat: (...args: any[]) => probe.chat(...args) }))
vi.mock('../lib/canvasDocumentSnapshot', () => ({ canvasDocumentSnapshot: (x: any) => x, renderDiagramViewportImage: probe.image, renderDiagramViewportSvg: vi.fn() }))
vi.mock('../lib/diagramCanvasExport', () => ({ copyDiagramImage: (...args: any[]) => probe.copyImage(...args), runDiagramExportAction: vi.fn(), downloadDiagramImage: vi.fn(), downloadDiagramPdf: vi.fn(), downloadDiagramSvgDataUrl: vi.fn(), printDiagram: vi.fn() }))
vi.mock('./PlantUmlSourceEditor', () => ({ PlantUmlSourceEditor: () => null }))

let host: HTMLDivElement, root: Root
const nodes = (): Node[] => ['a', 'b', 'c'].map((id, i) => ({ id, type: 'umlClass', position: { x: i * 240 + 80, y: i * 120 + 80 }, style: { width: 160, height: 80 }, data: { kind: 'element', layer: 'application', notationId: 'class', stereotype: 'class', title: id, description: [], visual: { fillColor: '#ff0000' } } }))
const edge = (): Edge => ({ id: 'ab', source: 'a', target: 'b', sourceHandle: 'source-bottom-30', targetHandle: 'target-top-70', data: { manualConnectionHandles: true, segmentRoute: { points: [{ x: 240, y: 120 }] }, visual: { lineColor: '#123456' } } })
let serial = 0
async function mount(kind: string, editable = true, nested = false, configure?: (graph: { nodes: Node[]; edges: Edge[] }) => void) {
 const graph = { nodes: nodes(), edges: [edge()] }
 if (kind === 'erd') graph.nodes.forEach(n => { n.type = 'erdEntity'; n.data.notationId = 'entity'; n.data.description = ['*id : INT'] })
 if (kind === 'bpmn') graph.nodes.forEach(n => { n.type = 'bpmnElement'; n.data.notationId = 'task' })
 if (nested) { graph.nodes[0].type = 'archimateBoundary'; graph.nodes[0].style = { width: 400, height: 300 }; graph.nodes[0].data = { kind: 'boundary', title: 'Boundary', layer: 'application' }; graph.nodes[1].parentNode = 'a'; graph.nodes[1].position = { x: 30, y: 50 } }
 configure?.(graph)
 const ideaId = `context-test-${serial++}`
 if (kind === 'integration') {
  graph.nodes.forEach(n => { if (n.data.kind === 'element') { n.type = 'archimateElement'; n.data.notationId = 'ApplicationComponent' } })
  localStorage.setItem('tectona-idea-integration-graph-v2', JSON.stringify({ [ideaId]: { ...graph, userCustomized: true, plantumlSource: '', savedAt: new Date().toISOString() } }))
  await act(async () => root.render(createElement(EditableIntegrationArchitectureCanvas, { ideaId, fillHeight: true })))
 } else await act(async () => root.render(createElement(EditableDiagramCanvas, { ideaId, diagramKey: 'class', source: '@startuml\nclass a\nclass b\na --> b\n@enduml', format: kind === 'bpmn' ? 'bpmn' : kind === 'erd' ? 'erd' : 'class', editable, fillHeight: true, savedGraph: graph as any })))
 expect(probe.flow.nodes).toHaveLength(graph.nodes.length)
}
const menu = () => document.querySelector('[data-diagram-context-menu]')
const text = (el: Element) => (el.textContent ?? '').replace(/Ctrl.*$|DeleteDelete$/, m => m === 'DeleteDelete' ? 'Delete' : '').trim()
function button(label: string): HTMLButtonElement {
 const result = [...document.querySelectorAll<HTMLButtonElement>('[data-diagram-context-menu] button')].find(el => text(el) === label)
 if (!result) throw new Error(`Missing ${label}: ${menu()?.textContent}`)
 return result
}
async function click(label: string) { await act(async () => button(label).click()) }
async function open(target: 'pane' | 'node' | 'edge', id = 'a') {
 const e = new MouseEvent('contextmenu', { clientX: 320, clientY: 240, bubbles: true, cancelable: true })
 await act(async () => {
  if (target === 'pane') probe.flow.onPaneContextMenu?.(e)
  else if (target === 'node') probe.flow.onNodeContextMenu?.(e, probe.flow.nodes.find((n: Node) => n.id === id))
  else probe.flow.onEdgeContextMenu?.(e, probe.flow.edges.find((edge: Edge) => edge.id === id) ?? probe.flow.edges[0])
 })
}
async function submenu(label: string) { await act(async () => button(label).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))) }
beforeEach(() => {
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
 localStorage.clear(); vi.clearAllMocks()
 Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}), readText: vi.fn(async () => '') } })
 vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
 host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
for (const kind of ['generic', 'integration']) describe(`${kind} real context menus`, () => {
 it('copies and pastes a node at the requested position without modifying the original', async () => {
  await mount(kind); await open('node'); await click('Copy'); await open('pane'); expect(button('Paste here').disabled).toBe(false); await click('Paste here')
  expect(probe.flow.nodes).toHaveLength(4); const copy = probe.flow.nodes.find((n: Node) => !['a','b','c'].includes(n.id)); expect(copy.position).toEqual({ x: 320, y: 240 }); expect(copy.data.title).toBe('a')
 })
 for (const action of ['Cut', 'Delete', 'Duplicate']) it(`${action} updates nodes and incident edges`, async () => {
  await mount(kind); await open('node'); await click(action)
  expect(probe.flow.nodes).toHaveLength(action === 'Duplicate' ? 4 : 2)
  expect(probe.flow.edges).toHaveLength(action === 'Duplicate' ? 1 : 0)
  if (action === 'Cut') { await open('pane'); await click('Paste here'); expect(probe.flow.nodes).toHaveLength(3) }
 })
 for (const [label, nodeSelected, edgeSelected] of [['Select vertices',true,false],['Select edges',false,true],['Select all',true,true]] as const) it(label, async () => {
  await mount(kind); await open('pane'); await click(label)
  expect(probe.flow.nodes.every((n: Node) => !!n.selected === nodeSelected)).toBe(true); expect(probe.flow.edges.every((e: Edge) => !!e.selected === edgeSelected)).toBe(true)
 })
 for (const [label, prop] of [['Grid','showGrid'],['Snap to grid','snapToGrid'],['Guides','showGuides'],['Ruler','showRuler'],['Connection arrows','showConnectionArrows'],['Connection points','showConnectionPoints']]) it(`toggles ${label} twice`, async () => {
  await mount(kind); const original = probe.flow[prop]; await open('pane'); await submenu('Options'); await click(label); expect(probe.flow[prop]).toBe(!original); await click(label); expect(probe.flow[prop]).toBe(original)
 })
 for (const label of ['Horizontal flow','Vertical flow','Circle']) it(`applies ${label}`, async () => {
  await mount(kind); const before = probe.flow.nodes.map((n: Node) => n.position); await open('pane'); await submenu('Layout'); await click(label); expect(probe.flow.nodes.map((n: Node) => n.position)).not.toEqual(before); expect(probe.flow.edges).toHaveLength(1)
 })
 for (const label of ['Bring to front','Bring forward','Send backward','Send to back']) it(label, async () => {
  await mount(kind); await open('node', 'b'); const before = probe.flow.nodes.find((n: Node) => n.id === 'b').zIndex; await submenu('Order'); await click(label); expect(probe.flow.nodes.find((n: Node) => n.id === 'b').zIndex).not.toBe(before)
 })
 it('reverses the edge without losing visual styling', async () => {
  await mount(kind); await open('edge'); await click('Reverse'); expect(probe.flow.edges[0]).toMatchObject({ source: 'b', target: 'a', data: { visual: { lineColor: '#123456' } } })
  expect(probe.flow.edges[0].sourceHandle).toMatch(/^source-/); expect(probe.flow.edges[0].targetHandle).toMatch(/^target-/)
 })
 it('deletes only the chosen edge', async () => { await mount(kind); await open('edge'); await click('Delete'); expect(probe.flow.edges).toHaveLength(0); expect(probe.flow.nodes).toHaveLength(3) })
 it('opens actual node and edge property panels', async () => {
  await mount(kind); await open('node'); await click('Styles & formatting'); expect(menu()).toBeNull(); expect(host.textContent).toContain('Arrange'); await open('edge'); await click('Format...'); expect(menu()).toBeNull(); expect(host.textContent).toContain('Arrange')
 })
 it('dismisses with Escape and outside pointer, permits repeated reopening', async () => {
  await mount(kind)
  for (const target of ['node','pane','edge'] as const) { await open(target); expect(menu()).not.toBeNull(); await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); expect(menu()).toBeNull(); await open(target); await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))); expect(menu()).toBeNull() }
 })
})
it('does not expose editable context menus in the generic read-only viewer', async () => { await mount('generic', false); for (const target of ['node','edge','pane'] as const) { await open(target); expect(menu()).toBeNull() } })

for (const kind of ['generic', 'integration']) describe(`${kind} hierarchy and remaining leaves`, () => {
 for (const action of ['Cut', 'Delete']) it(`${action} boundary leaves no orphan children`, async () => {
  await mount(kind, true, true); await open('node'); await click(action)
  const ids = new Set(probe.flow.nodes.map((n: Node) => n.id))
  expect(probe.flow.nodes.filter((n: Node) => n.parentNode && !ids.has(n.parentNode))).toEqual([])
 })
 it('Select all followed by delete removes every selected vertex and edge', async () => {
  await mount(kind); await open('pane'); await click('Select all'); await act(async () => { if (kind === 'integration') probe.flow.onNodesChange(probe.flow.nodes.filter((n: Node) => n.selected).map((n: Node) => ({ id: n.id, type: 'remove' }))); else document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })) })
  expect(probe.flow.nodes).toHaveLength(0); expect(probe.flow.edges).toHaveLength(0)
 })
 it('Clear Waypoints preserves pinned endpoints and visual style', async () => {
  await mount(kind); const before = structuredClone(probe.flow.edges[0]); await open('edge'); await click('Clear Waypoints'); const after = probe.flow.edges[0]
  expect(after.data.segmentRoute).toBeUndefined(); expect(after.sourceHandle).toBe(before.sourceHandle); expect(after.targetHandle).toBe(before.targetHandle); expect(after.data.manualConnectionHandles).toBe(true); expect(after.data.visual).toEqual(before.data.visual)
 })
 it('Unpin Connector Ends preserves waypoint routing and visual style', async () => {
  await mount(kind); const before = structuredClone(probe.flow.edges[0]); await open('edge'); await click('Unpin Connector Ends'); const after = probe.flow.edges[0]
  expect(after.data.manualConnectionHandles).not.toBe(true); expect(after.data.segmentRoute).toEqual(before.data.segmentRoute); expect(after.data.visual).toEqual(before.data.visual)
 })
 it('clearing default style does not erase existing node styling', async () => {
  await mount(kind); await open('node'); await click('Set as default style'); const before = probe.flow.nodes.map((n: Node) => n.data.visual); await open('pane'); await click('Clear default style'); expect(probe.flow.nodes.map((n: Node) => n.data.visual)).toEqual(before)
 })
 it('routes image copy through the export boundary without live clipboard writes', async () => {
  await mount(kind); await open('node'); await click('Copy as image'); expect(probe.image).toHaveBeenCalled(); expect(probe.copyImage).toHaveBeenCalled()
 })
 it('opens notation-scoped AI through the mocked navigation boundary', async () => {
  await mount(kind); await open('node'); await click('Ask Gen AI about this notation'); expect(probe.chat).toHaveBeenCalled()
 })
})

for (const kind of ['generic', 'integration']) describe(`${kind} command history`, () => {
 for (const [target, action] of [['node','Delete'],['node','Cut'],['edge','Reverse'],['edge','Clear Waypoints']] as const) it(`${action} undo/redo restores the full graph`, async () => {
  await mount(kind); await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) }); await open(target)
  const snapshot = () => JSON.parse(JSON.stringify({ nodes: probe.flow.nodes, edges: probe.flow.edges }, (key, value) => key === 'selected' ? undefined : value))
  const before = snapshot(); await click(action); const after = snapshot(); expect(after).not.toEqual(before)
  await act(async () => probe.flow.onUndo()); expect(snapshot()).toEqual(before)
  await act(async () => probe.flow.onRedo()); expect(snapshot()).toEqual(after)
 })
})
for (const kind of ['generic', 'integration']) it(`${kind} pastes nested source preserving relative children`, async () => {
 const source = kind === 'generic' ? '@startuml\nSystem_Boundary(outer,"Outer") {\nContainer(inner,"Inner","Node")\n}\n@enduml' : '@startuml\npackage "Application Layer" {\n[API] as api <<Application Component>>\n}\n@enduml'
 if (kind === 'generic') await act(async () => root.render(createElement(EditableDiagramCanvas, { ideaId: 'nested-source', diagramKey: 'c4-l2', source, format: 'c4', editable: true, fillHeight: true })))
 else {
  const { parsePlantUmlToIntegrationGraph } = await import('../lib/parsePlantUmlToIntegrationGraph')
  const graph = parsePlantUmlToIntegrationGraph(source)
  localStorage.setItem('tectona-idea-integration-graph-v2', JSON.stringify({ 'nested-source': { ...graph, plantumlSource: source, userCustomized: true, savedAt: new Date().toISOString() } }))
  await act(async () => root.render(createElement(EditableIntegrationArchitectureCanvas, { ideaId: 'nested-source', fillHeight: true })))
 }
 const before = structuredClone(probe.flow.nodes) as Node[]
 expect(before.some(n => n.parentNode)).toBe(true)
 vi.mocked(navigator.clipboard.readText).mockResolvedValue(source)
 await open('pane'); expect(button('Paste here').disabled).toBe(false); await click('Paste here')
 const pasted = probe.flow.nodes.filter((n: Node) => !before.some(old => old.id === n.id)) as Node[]
 expect(pasted).toHaveLength(before.length)
 for (const original of before.filter(n => n.parentNode)) {
  const copy = pasted.find(n => n.data.title === original.data.title)!
  expect(copy.parentNode).toBeTruthy(); expect(copy.position).toEqual(original.position); expect(pasted.some(n => n.id === copy.parentNode)).toBe(true)
 }
})

it('C4 links, opens, clears, and cancels a diagram link using actual menu/dialog buttons', async () => {
 const navigate = vi.fn()
 await act(async () => root.render(createElement(EditableDiagramCanvas, { ideaId: 'link-test', diagramKey: 'c4-l1', source: '@startuml\nSystem(a,"A")\n@enduml', format: 'c4', editable: true, fillHeight: true, c4DrilldownTargets: [{ diagramKey: 'c4-l2', title: 'Containers', description: 'Detail' }], onOpenC4Drilldown: navigate })))
 const dialogClick = async (label: string) => { const el = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!; expect(el).toBeTruthy(); await act(async () => el.click()) }
 await open('node'); await click('Link C4 diagram...'); await dialogClick('Cancel'); expect(probe.flow.nodes[0].data.diagramLink).toBeUndefined()
 await open('node'); await click('Link C4 diagram...'); const choice = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Containers') && b.textContent.includes('Detail'))!; await act(async () => choice.click()); await dialogClick('Link diagram'); expect(probe.flow.nodes[0].data.diagramLink).toBe('c4-l2')
 await open('node'); await click('Open Containers'); expect(navigate).toHaveBeenCalledWith('c4-l2')
 await open('node'); await click('Clear Containers link'); await open('node'); expect(button('Link C4 diagram...')).toBeTruthy()
})

for (const kind of ['generic','integration']) it(`${kind} default style applies only to future insertions and clears for later insertions`, async () => {
 await mount(kind); await open('node'); await click('Set as default style')
 const drop = async () => {
  const { ARCHIMATE_PALETTE_MIME } = await import('../lib/integrationArchimatePalette')
  const mime = kind === 'generic' ? 'application/tectona-uml-palette' : ARCHIMATE_PALETTE_MIME
  const item = kind === 'generic' ? { nodeKind: 'class' } : { id: 'ApplicationComponent', kind: 'element', label: 'Application Component', stereotype: 'Application Component', layer: 'application', notationId: 'ApplicationComponent', defaultTitle: 'Inserted' }
  const event = new MouseEvent('drop', { bubbles: true, clientX: 600, clientY: 400 })
  Object.defineProperty(event, 'dataTransfer', { value: { getData: (key: string) => key === mime ? JSON.stringify(item) : '' } })
  await act(async () => host.querySelector('[data-testid="flow"]')!.dispatchEvent(event))
 }
 await drop(); expect(probe.flow.nodes).toHaveLength(4); expect(probe.flow.nodes[3].data.visual.fillColor).toBe('#ff0000')
 await open('pane'); await click('Clear default style'); await drop(); expect(probe.flow.nodes).toHaveLength(5); expect(probe.flow.nodes[4].data.visual?.fillColor).not.toBe('#ff0000'); expect(probe.flow.nodes[3].data.visual.fillColor).toBe('#ff0000')
})

describe('BPMN-specific generic wrapper smoke coverage', () => {
 for (const action of ['Copy','Cut','Delete','Duplicate','Styles & formatting']) it(`executes ${action} from task context`, async () => {
  await mount('bpmn'); await open('node'); await click(action)
  if (action === 'Copy') { await open('pane'); await click('Paste here'); expect(probe.flow.nodes).toHaveLength(4) }
  if (action === 'Cut' || action === 'Delete') expect(probe.flow.nodes).toHaveLength(2)
  if (action === 'Duplicate') expect(probe.flow.nodes).toHaveLength(4)
  if (action === 'Styles & formatting') expect(host.textContent).toContain('Arrange')
 })
})
for (const kind of ['generic','integration']) it(`${kind} edits edge styling through the actual Format panel`, async () => {
 await mount(kind); await open('edge'); await click('Format...')
 const color = host.querySelector<HTMLInputElement>('input[aria-label="Line color"]')!
 expect(color).toBeTruthy()
 await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(color, '#abcdef'); color.dispatchEvent(new Event('input', { bubbles: true })); color.dispatchEvent(new Event('change', { bubbles: true })) })
 expect(probe.flow.edges[0].data.visual.lineColor).toBe('#abcdef')
})
it('integration canvas AI action passes diagram context without calling a live service', async () => { await mount('integration'); await open('pane'); await click('Ask Gen AI'); expect(probe.chat).toHaveBeenCalled() })
for (const kind of ['generic','integration']) it(`${kind} does not read the OS clipboard on open and disables image copy without a selection`, async () => { await mount(kind); await open('pane'); expect(navigator.clipboard.readText).not.toHaveBeenCalled(); expect(button('Paste here').disabled).toBe(false); expect(button('Copy as image').disabled).toBe(true) })



for (const kind of ['generic','integration']) for (const result of ['denied','invalid']) it(`${kind} ${result} clipboard paste preserves the graph and permits reopening`, async () => {
 await mount(kind)
 const before = JSON.stringify({ nodes: probe.flow.nodes, edges: probe.flow.edges })
 if (result === 'denied') vi.mocked(navigator.clipboard.readText).mockRejectedValue(new DOMException('Denied','NotAllowedError'))
 else vi.mocked(navigator.clipboard.readText).mockResolvedValue('not a diagram')
 await open('pane'); expect(navigator.clipboard.readText).not.toHaveBeenCalled(); await click('Paste here'); expect(navigator.clipboard.readText).toHaveBeenCalledTimes(1)
 expect(JSON.stringify({ nodes: probe.flow.nodes, edges: probe.flow.edges })).toBe(before)
 await open('pane'); expect(menu()).not.toBeNull(); expect(navigator.clipboard.readText).toHaveBeenCalledTimes(1)
})



it('C4 stale link can be cleared and canvas AI can be opened', async () => {
 const graph = { nodes: nodes().slice(0,1), edges: [] }
 graph.nodes[0].type = 'c4Element'; graph.nodes[0].data.notationId = 'System'; graph.nodes[0].data.diagramLink = 'missing'
 await act(async () => root.render(createElement(EditableDiagramCanvas, { ideaId: 'stale-link', diagramKey: 'c4-l1', source: '@startuml\nSystem(a,"A")\n@enduml', format: 'c4', editable: true, fillHeight: true, savedGraph: graph as any })))
 await open('node'); await click('Clear diagram link'); expect(probe.flow.nodes[0].data.diagramLink).toBeUndefined(); expect(probe.flow.nodes[0].data.diagramLinkCleared).toBe(true)
 await open('pane'); await click('Ask Gen AI'); expect(probe.chat).toHaveBeenCalled()
})
for (const kind of ['generic','integration']) it(`${kind} copies the selected vertices as an image from the pane menu`, async () => { await mount(kind); await open('pane'); await click('Select vertices'); await open('pane'); expect(button('Copy as image').disabled).toBe(false); await click('Copy as image'); expect(probe.image).toHaveBeenCalled(); expect(probe.copyImage).toHaveBeenCalled() })


// Multi-selection extensions: graph expectations are computed independently of production helpers.
async function selectIds(ids: string[]) {
 await act(async () => probe.flow.onNodesChange(probe.flow.nodes.map((n: Node) => ({ id: n.id, type: 'select', selected: ids.includes(n.id) }))))
 await act(async () => probe.flow.onSelectionChange({ nodes: probe.flow.nodes.filter((n: Node) => n.selected), edges: probe.flow.edges.filter((e: Edge) => e.selected) }))
}
const graphSnapshot = () => JSON.parse(JSON.stringify({ nodes: probe.flow.nodes, edges: probe.flow.edges }, (key, value) => key === 'selected' ? undefined : value))
const connectedFixture = (graph: { nodes: Node[]; edges: Edge[] }) => {
 graph.edges[0].data.segmentRoute = { points: [{ x: 100, y: 90 }, { x: 220, y: 90 }, { x: 220, y: 210 }], controls: [{ id: 'bend', axis: 'x', x: 220, y: 90 }] }
 graph.edges.push({ id: 'bc', source: 'b', target: 'c' })
}
for (const kind of ['generic','integration']) describe(`${kind} multi-selection commands`, () => {
 for (const action of ['Copy','Duplicate']) it(`${action} keeps the selected pair and only their internal edge`, async () => {
  await mount(kind, true, false, connectedFixture); await selectIds(['a','b']); await open('node')
  expect(probe.flow.nodes.filter((n: Node) => n.selected).map((n: Node) => n.id)).toEqual(['a','b'])
  const before = structuredClone(probe.flow.nodes) as Node[]; const oldRoute = structuredClone(probe.flow.edges[0].data.segmentRoute)
  await click(action); if (action === 'Copy') { await open('pane'); await click('Paste here') }
  const copies = probe.flow.nodes.filter((n: Node) => !['a','b','c'].includes(n.id)) as Node[]
  expect(copies).toHaveLength(2); expect(probe.flow.nodes).toHaveLength(5); expect(probe.flow.edges).toHaveLength(3)
  const copiedEdge = probe.flow.edges.find((e: Edge) => !['ab','bc'].includes(e.id)) as Edge
  expect(copies.some(n => n.id === copiedEdge.source)).toBe(true); expect(copies.some(n => n.id === copiedEdge.target)).toBe(true)
  const a = copies.find(n => n.data.title === 'a')!, b = copies.find(n => n.data.title === 'b')!
  const dx = a.position.x - before[0].position.x, dy = a.position.y - before[0].position.y
  expect(a.position).toEqual(action === 'Copy' ? { x: 320, y: 240 } : { x: before[0].position.x + 32, y: before[0].position.y + 32 })
  expect(b.position).toEqual({ x: before[1].position.x + dx, y: before[1].position.y + dy })
  expect(copiedEdge.data.segmentRoute.points).toEqual(oldRoute.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy })))
  expect(copiedEdge.data.segmentRoute.controls).toEqual(oldRoute.controls.map((p: any) => ({ ...p, x: p.x + dx, y: p.y + dy })))
  expect(copiedEdge.data.visual).toEqual({ lineColor: '#123456' })
 })
 it('Cut removes the pair and external incident edges and undo restores the full graph', async () => {
  await mount(kind, true, false, connectedFixture); await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) }); await selectIds(['a','b']); const before = graphSnapshot()
  await open('node'); await click('Cut'); expect(probe.flow.nodes.map((n: Node) => n.id)).toEqual(['c']); expect(probe.flow.edges).toHaveLength(0)
  await act(async () => probe.flow.onUndo()); expect(graphSnapshot()).toEqual(before)
  await open('pane'); await click('Paste here'); expect(probe.flow.nodes).toHaveLength(5); expect(probe.flow.edges).toHaveLength(3)
 })
 for (const action of ['Copy','Duplicate']) it(`${action} container includes its child and rekeys hierarchy`, async () => {
  await mount(kind, true, true); const before = structuredClone(probe.flow.nodes) as Node[]
  await open('node'); await click(action); if (action === 'Copy') { await open('pane'); await click('Paste here') }
  const copies = probe.flow.nodes.filter((n: Node) => !['a','b','c'].includes(n.id)) as Node[]
  expect(copies).toHaveLength(2); const parent = copies.find(n => n.data.title === 'Boundary')!, child = copies.find(n => n.data.title === 'b')!
  expect(child.parentNode).toBe(parent.id); expect(child.position).toEqual(before.find(n => n.id === 'b')!.position)
  expect(probe.flow.edges).toHaveLength(2)
 })
 it('Copy as image includes the selected nodes and descendants', async () => {
  await mount(kind, true, true); await selectIds(['a','c']); await open('node'); await click('Copy as image'); expect(probe.image).toHaveBeenCalled()
  const args = probe.image.mock.calls[0] as any[]; expect([...args[3]].sort()).toEqual(['a','b','c'])
 })
})
const arrangeCases = [['Align left','x',0],['Align center','x',0.5],['Align right','x',1],['Align top','y',0],['Align middle','y',0.5],['Align bottom','y',1]] as const
const variedFixture = (graph: { nodes: Node[]; edges: Edge[] }) => graph.nodes.forEach((n, i) => { n.type = 'archimateElement'; n.width = [100,180,140][i]; n.height = [70,130,90][i]; n.style = { width: n.width, height: n.height }; n.position = { x: [80,290,680][i], y: [60,250,620][i] } })
for (const kind of ['generic','integration']) describe(`${kind} Align / Distribute menus`, () => {
 for (const [label,axis,fraction] of arrangeCases) it(`${label} accounts for varying dimensions`, async () => {
  await mount(kind, true, false, variedFixture); await selectIds(['a','b','c']); const before = structuredClone(probe.flow.nodes) as Node[]
  const size = (n: Node) => Number(n[axis === 'x' ? 'width' : 'height'] ?? n.style?.[axis === 'x' ? 'width' : 'height'])
  const low = Math.min(...before.map(n => n.position[axis])), high = Math.max(...before.map(n => n.position[axis] + size(n)))
  await open('node'); await submenu('Align / Distribute'); expect(button(label).disabled).toBe(false); await click(label)
  for (const n of probe.flow.nodes as Node[]) expect(n.position[axis] + size(n) * fraction).toBeCloseTo(low + (high - low) * fraction)
 })
 for (const [label,axis] of [['Distribute horizontally','x'],['Distribute vertically','y']] as const) it(`${label} equalizes clear gaps and fixes endpoints`, async () => {
  await mount(kind, true, false, variedFixture); await selectIds(['a','b','c']); const before = structuredClone(probe.flow.nodes) as Node[]
  await open('node'); await submenu('Align / Distribute'); await click(label)
  const after = probe.flow.nodes as Node[]; const dim = axis === 'x' ? 'width' : 'height'
  expect(after[0].position).toEqual(before[0].position); expect(after[2].position).toEqual(before[2].position)
  expect(after[1].position[axis] - after[0].position[axis] - Number(after[0][dim])).toBeCloseTo(after[2].position[axis] - after[1].position[axis] - Number(after[1][dim]))
 })
 it('requires two roots for alignment and three for distribution', async () => {
  await mount(kind); await open('node'); await submenu('Align / Distribute'); for (const [label] of arrangeCases) expect(button(label).disabled).toBe(true)
  expect(button('Distribute horizontally').disabled).toBe(true); await selectIds(['a','b']); await open('node'); await submenu('Align / Distribute'); expect(button('Align left').disabled).toBe(false); expect(button('Distribute vertically').disabled).toBe(true)
 })
 it('moves selected parents once, preserves child-local geometry', async () => {
  await mount(kind, true, true); await selectIds(['a','b','c']); const child = structuredClone(probe.flow.nodes.find((n: Node) => n.id === 'b').position)
  await open('node'); await submenu('Align / Distribute'); expect(button('Distribute horizontally').disabled).toBe(true); await click('Align right'); expect(probe.flow.nodes.find((n: Node) => n.id === 'b').position).toEqual(child)
 })
})
for (const kind of ['generic','integration']) describe(`${kind} protected connector menu commands`, () => {
 for (const [label,flag] of [['Format...','editDialog'],['Reverse','editable'],['Clear Waypoints','bendable'],['Unpin Connector Ends','movable'],['Delete','deletable']] as const) it(`${flag}=false disables ${label}`, async () => {
  await mount(kind, true, false, graph => { graph.edges[0].data.arrange = { [flag]: false } }); await open('edge'); const before = graphSnapshot(); expect(button(label).disabled).toBe(true); await click(label); expect(graphSnapshot()).toEqual(before)
 })
 it('protects relation deletion through native callbacks and incident-node deletion', async () => {
  await mount(kind, true, false, graph => { graph.edges[0].data.arrange = { deletable: false } }); const before = graphSnapshot()
  await act(async () => probe.flow.onEdgesChange([{ id: 'ab', type: 'remove' }])); expect(graphSnapshot()).toEqual(before)
  await open('node'); await click('Delete'); expect(graphSnapshot()).toEqual(before)
 })
 it('blocks reconnect for immovable connectors', async () => {
  await mount(kind, true, false, graph => { graph.edges[0].data.arrange = { movable: false } }); const before = graphSnapshot()
  await act(async () => probe.flow.onEdgeUpdate(probe.flow.edges[0], { source: 'a', target: 'c', sourceHandle: 'source-right', targetHandle: 'target-left' })); expect(graphSnapshot()).toEqual(before)
 })
 it('does not duplicate a noncloneable node or cut a protected node', async () => {
  await mount(kind, true, false, graph => { graph.nodes[0].data.arrange = { cloneable: false, deletable: false } }); const before = graphSnapshot()
  await open('node'); await click('Duplicate'); expect(graphSnapshot()).toEqual(before); await open('node'); await click('Cut'); expect(graphSnapshot()).toEqual(before)
 })
})

for (const kind of ['generic','integration']) describe(`${kind} selection protection and properties`, () => {
 it('aligns only movable roots and leaves the locked node unchanged', async () => {
  await mount(kind, true, false, graph => { variedFixture(graph); graph.nodes[1].data.arrange = { movable: false } }); await selectIds(['a','b','c']); const before = structuredClone(probe.flow.nodes[1])
  await open('node'); await submenu('Align / Distribute'); expect(button('Distribute horizontally').disabled).toBe(true); await click('Align left'); expect(probe.flow.nodes[1]).toEqual(before); expect(probe.flow.nodes[2].position.x).toBe(probe.flow.nodes[0].position.x)
 })
 it('Styles applies to the clicked object while collapsing a preserved multi-selection', async () => {
  await mount(kind); await selectIds(['a','b']); await open('node', 'b'); expect(probe.flow.nodes.filter((n: Node) => n.selected)).toHaveLength(2); await click('Styles & formatting'); expect(probe.flow.nodes.filter((n: Node) => n.selected).map((n: Node) => n.id)).toEqual(['b']); expect(host.textContent).toContain('Arrange')
 })
 it('does not clone an internal connector with cloneable=false', async () => {
  await mount(kind, true, false, graph => { connectedFixture(graph); graph.edges[0].data.arrange = { cloneable: false } }); await selectIds(['a','b']); await open('node'); await click('Duplicate'); expect(probe.flow.nodes).toHaveLength(5); expect(probe.flow.edges).toHaveLength(2)
 })
 it('rejects cutting a mixed selection containing a protected node', async () => {
  await mount(kind, true, false, graph => { graph.nodes[1].data.arrange = { deletable: false } }); await selectIds(['a','b']); const before = graphSnapshot(); await open('node'); await click('Cut'); expect(graphSnapshot()).toEqual(before); expect(host.querySelector('[role="alert"]')).not.toBeNull()
 })
 it('keyboard Delete removes every eligible selected node and edge', async () => {
  await mount(kind); await open('pane'); await click('Select all'); await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))); expect(probe.flow.nodes).toHaveLength(0); expect(probe.flow.edges).toHaveLength(0)
 })
})

for (const kind of ['generic','integration']) it(`${kind} aligns a nested selected child in absolute space without moving its unselected parent`, async () => {
 await mount(kind, true, true); await selectIds(['b','c'])
 const parent = structuredClone(probe.flow.nodes.find((n: Node) => n.id === 'a')) as Node
 const b = probe.flow.nodes.find((n: Node) => n.id === 'b') as Node, c = probe.flow.nodes.find((n: Node) => n.id === 'c') as Node
 const desired = Math.min(parent.position.x + b.position.x, c.position.x)
 await open('node', 'b'); await submenu('Align / Distribute'); await click('Align left')
 const afterB = probe.flow.nodes.find((n: Node) => n.id === 'b') as Node, afterC = probe.flow.nodes.find((n: Node) => n.id === 'c') as Node
 expect(probe.flow.nodes.find((n: Node) => n.id === 'a')).toEqual(parent)
 expect(afterB.position.x + parent.position.x).toBe(desired); expect(afterC.position.x).toBe(desired)
})


async function selectEdgeIds(ids: string[]) {
 await act(async () => probe.flow.onEdgesChange(probe.flow.edges.map((e: Edge) => ({ id: e.id, type: 'select', selected: ids.includes(e.id) }))))
 await act(async () => probe.flow.onSelectionChange({ nodes: probe.flow.nodes.filter((n: Node) => n.selected), edges: probe.flow.edges.filter((e: Edge) => e.selected) }))
}
const erdFixture = (graph: { nodes: Node[]; edges: Edge[] }) => {
 graph.nodes[0].data.title = 'users'; graph.nodes[1].data.title = 'orders'; graph.nodes[2].data.title = 'audit'
 graph.nodes[1].data.description = ['*id : INT', 'users_id : INT <<FK>>']
 graph.nodes[2].data.description = ['*id : INT', 'orders_id : INT <<FK>>']
 graph.edges[0].type = 'erd'; graph.edges[0].data = { sourceMany: false, targetMany: true, sourceOptional: false, targetOptional: false }
 graph.edges.push({ id: 'bc', source: 'b', target: 'c', type: 'erd', data: { sourceMany: false, targetMany: true } })
}
const sqlPreview = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Generated SQL"]')!
describe('ERD context-specific DDL interactions', () => {
 it('generates only the selected entity and explains outside dependencies without graph mutation', async () => {
  await mount('erd', true, false, erdFixture); await open('node', 'b'); const before = graphSnapshot(); await click('Generate DDL for this entity')
  expect(sqlPreview().value).toContain('CREATE TABLE "orders"'); expect(sqlPreview().value).not.toContain('CREATE TABLE "users"'); expect(sqlPreview().value).not.toContain('REFERENCES'); expect(document.body.textContent).toMatch(/outside|not selected/i); expect(graphSnapshot()).toEqual(before)
 })
 it('generates selected tables and their explicit selected FK, omitting an outside dependency', async () => {
  await mount('erd', true, false, erdFixture); await selectIds(['a','b']); await selectEdgeIds(['ab']); await open('node'); expect(button('Styles & formatting').disabled).toBe(true); expect(button('Set as default style').disabled).toBe(true)
  expect(menu()!.textContent).toContain('2 entities, 1 relationships'); const before = graphSnapshot(); await click('Generate DDL for selection')
  expect(sqlPreview().value).toContain('CREATE TABLE "users"'); expect(sqlPreview().value).toContain('CREATE TABLE "orders"'); expect(sqlPreview().value).toContain('FOREIGN KEY ("users_id") REFERENCES "users" ("id")'); expect(sqlPreview().value).not.toContain('CREATE TABLE "audit"'); expect(graphSnapshot()).toEqual(before)
 })
 it('right-clicking a selected relation preserves the selected graph and exposes selection DDL', async () => {
  await mount('erd', true, false, erdFixture); await selectIds(['a','b']); await selectEdgeIds(['ab']); await open('edge', 'ab')
  expect(probe.flow.nodes.filter((n: Node) => n.selected).map((n: Node) => n.id)).toEqual(['a','b']); expect(probe.flow.edges.filter((e: Edge) => e.selected).map((e: Edge) => e.id)).toEqual(['ab']); await click('Generate DDL for selection'); expect(sqlPreview().value).toContain('FOREIGN KEY')
 })
 it('right-clicking an unselected relation replaces the old graph selection', async () => {
  await mount('erd', true, false, erdFixture); await selectIds(['a','b']); await selectEdgeIds(['ab']); await open('edge', 'bc')
  expect(probe.flow.nodes.filter((n: Node) => n.selected)).toHaveLength(0); expect(probe.flow.edges.filter((e: Edge) => e.selected).map((e: Edge) => e.id)).toEqual(['bc']); expect(menu()!.textContent).not.toContain('Generate DDL'); expect(button('Format...')).toBeTruthy()
 })
 it('right-clicking an unselected entity replaces the graph selection and offers only that entity DDL', async () => {
  await mount('erd', true, false, erdFixture); await selectIds(['a','b']); await selectEdgeIds(['ab']); await open('node', 'c')
  expect(probe.flow.nodes.filter((n: Node) => n.selected).map((n: Node) => n.id)).toEqual(['c']); expect(probe.flow.edges.filter((e: Edge) => e.selected)).toHaveLength(0); expect(button('Styles & formatting').disabled).toBe(false); await click('Generate DDL for this entity'); expect(sqlPreview().value).toContain('CREATE TABLE "audit"'); expect(sqlPreview().value).not.toContain('CREATE TABLE "users"')
 })
 it('never exposes DDL or mutation context menus in read-only ERD', async () => {
  await mount('erd', false, false, erdFixture); for (const target of ['node','edge','pane'] as const) { await open(target); expect(menu()).toBeNull() }; expect(sqlPreview()).toBeNull()
 })
})
const independentEdgeFixture = (graph: { nodes: Node[]; edges: Edge[] }) => {
 graph.nodes.push({ ...structuredClone(graph.nodes[2]), id: 'd', data: { ...graph.nodes[2].data, title: 'd' }, position: { x: 900, y: 500 } })
 graph.edges.push({ id: 'cd', source: 'c', target: 'd' })
}
for (const kind of ['generic','integration','erd']) describe(`${kind} context Delete selection scope`, () => {
 it('deletes the selected node pair and separately selected independent edge', async () => {
  await mount(kind, true, false, independentEdgeFixture); await selectIds(['a','b']); await selectEdgeIds(['cd']); await open('node'); await click('Delete')
  expect(probe.flow.nodes.map((n: Node) => n.id)).toEqual(['c','d']); expect(probe.flow.edges).toHaveLength(0)
 })
 it('right-clicking an unselected node deletes only that node, not the previous selection', async () => {
  await mount(kind, true, false, independentEdgeFixture); await selectIds(['a','b']); await selectEdgeIds(['ab']); await open('node', 'c'); await click('Delete')
  expect(probe.flow.nodes.map((n: Node) => n.id)).toEqual(['a','b','d']); expect(probe.flow.edges.map((e: Edge) => e.id)).toEqual(['ab'])
 })
 it('retains protected selected nodes and independent protected edges', async () => {
  await mount(kind, true, false, graph => { independentEdgeFixture(graph); graph.nodes[1].data.arrange = { deletable: false }; graph.edges[1].data = { arrange: { deletable: false } } }); await selectIds(['a','b']); await selectEdgeIds(['cd']); await open('node'); await click('Delete')
  expect(probe.flow.nodes.map((n: Node) => n.id)).toEqual(['b','c','d']); expect(probe.flow.edges.map((e: Edge) => e.id)).toEqual(['cd'])
 })
})
it('ERD pane menu generates DDL for the active entity and relation selection', async () => {
 await mount('erd', true, false, erdFixture); await selectIds(['a','b']); await selectEdgeIds(['ab']); await open('pane'); await click('Generate DDL for selection')
 expect(sqlPreview().value).toContain('CREATE TABLE "users"'); expect(sqlPreview().value).toContain('CREATE TABLE "orders"'); expect(sqlPreview().value).toContain('FOREIGN KEY'); expect(sqlPreview().value).not.toContain('CREATE TABLE "audit"')
})
