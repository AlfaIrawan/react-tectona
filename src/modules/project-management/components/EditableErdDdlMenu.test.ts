/* eslint-disable @typescript-eslint/no-explicit-any -- Renderer boundary captures deliberately heterogeneous ReactFlow props. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
 if (kind === 'erd') graph.nodes.forEach(n => { n.type = 'erdEntity'; n.data.description = ['*id : INT'] })
 if (kind === 'bpmn') graph.nodes.forEach(n => { n.type = 'bpmnElement'; n.data.notationId = 'task' })
 if (nested) { graph.nodes[0].type = 'archimateBoundary'; graph.nodes[0].style = { width: 400, height: 300 }; graph.nodes[0].data = { kind: 'boundary', title: 'Boundary', layer: 'application' }; graph.nodes[1].parentNode = 'a'; graph.nodes[1].position = { x: 30, y: 50 } }
 configure?.(graph)
 const ideaId = `context-test-${serial++}`
 if (kind === 'integration') {
  graph.nodes.forEach(n => { if (n.data.kind === 'element') { n.type = 'archimateElement'; n.data.notationId = 'ApplicationComponent' } })
  localStorage.setItem('tectona-idea-integration-graph-v2', JSON.stringify({ [ideaId]: { ...graph, userCustomized: true, plantumlSource: '', savedAt: new Date().toISOString() } }))
  await act(async () => root.render(createElement(EditableIntegrationArchitectureCanvas, { ideaId, fillHeight: true })))
 } else await act(async () => root.render(createElement(EditableDiagramCanvas, { ideaId, diagramKey: 'class', source: '@startuml\nclass a\nclass b\na --> b\n@enduml', format: kind === 'bpmn' ? 'bpmn' : kind === 'erd' ? 'erd' : 'class', editable, fillHeight: true, savedGraph: graph as any })))
 expect(probe.flow.nodes).toHaveLength(3)
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
  else probe.flow.onEdgeContextMenu?.(e, probe.flow.edges[0])
 })
}

beforeEach(() => {
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
 localStorage.clear(); vi.clearAllMocks()
 Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}), readText: vi.fn(async () => '') } })
 vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
 host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('distinguishes entity and selected-subset menus and preserves selected relationships', async () => {
 await mount('erd', true, false, graph => { graph.nodes[0].selected = true; graph.nodes[1].selected = true; graph.edges[0].selected = true })
 await open('node', 'a'); expect(button('Generate DDL for selection')).toBeTruthy(); expect(menu()?.textContent).toContain('2 entities, 1 relationships'); expect(button('Styles & formatting').disabled).toBe(true); expect(menu()?.textContent).not.toContain('Order')
 expect(button('Ask Gen AI about this notation').disabled).toBe(true)
 await click('Generate DDL for selection'); expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Generated SQL"]')?.value).toContain('CREATE TABLE "b"'); expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Generated SQL"]')?.value).not.toContain('CREATE TABLE "c"')
 await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Close')!.click())
 await open('node', 'c'); expect(button('Generate DDL for this entity')).toBeTruthy(); expect(probe.flow.nodes.filter((n: Node) => n.selected).map((n: Node) => n.id)).toEqual(['c']); expect(probe.flow.edges[0].selected).toBe(false)
 await click('Generate DDL for this entity'); const sql = document.querySelector<HTMLTextAreaElement>('[aria-label="Generated SQL"]')!.value; expect(sql).toContain('CREATE TABLE "c"'); expect(sql).not.toContain('CREATE TABLE "a"')
})
it('deletes selected entities and a separately selected relationship while preserving other entities', async () => {
 await mount('erd', true, false, graph => { graph.nodes[0].selected = true; graph.edges = [{ id: 'bc', source: 'b', target: 'c', selected: true }] })
 await open('node'); await click('Delete'); expect(probe.flow.nodes.map((n: Node) => n.id)).toEqual(['b', 'c']); expect(probe.flow.edges).toHaveLength(0)
})
it('does not offer DDL in other formats or read-only ERD', async () => {
 await mount('generic'); await open('node'); expect(menu()?.textContent).not.toContain('Generate DDL'); await mount('erd', false); expect(probe.flow.onNodeContextMenu).toBeUndefined()
})

const advertisedDialectIds = ['postgresql','mysql','mariadb','oracle','sqlserver','sybase-ase','sql-anywhere','db2','ingres','openedge','informix','firebird','sqlite','h2','cache','hsqldb']
const dialectSelect = () => document.querySelector<HTMLSelectElement>('select[aria-label="SQL dialect"]')!
const ddlPreview = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Generated SQL"]')!.value
const graphState = () => JSON.parse(JSON.stringify({ nodes: probe.flow.nodes, edges: probe.flow.edges }))
function createdTables(sql: string) {
 return [...sql.matchAll(/CREATE TABLE\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[^\s(]+)/gi)].map(match => match[1].replace(/^["`[]|["`\]]$/g, '')).sort()
}
async function closeDdl() {
 const close = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b => b.textContent?.trim() === 'Close')!
 expect(close).toBeTruthy(); await act(async () => close.click()); expect(document.querySelector('[aria-label="Generated SQL"]')).toBeNull()
}
it('advertises exactly the 16 review profiles without Derby or FrontBase choices', async () => {
 await mount('erd'); await open('node'); await click('Generate DDL for this entity')
 expect([...dialectSelect().options].map(option => option.value).sort()).toEqual([...advertisedDialectIds].sort())
 expect([...dialectSelect().options].every(option => !option.disabled && option.textContent!.trim())).toBe(true)
 expect(dialectSelect().textContent).not.toMatch(/derby|frontbase/i)
 expect(document.querySelector('[role="dialog"]')!.textContent).toMatch(/not.*(?:parsed|tested)|review/i)
})
for (const scope of ['single','multi'] as const) it(`${scope} ERD scope and graph selection survive every dialect switch, close, and reopen`, async () => {
 await mount('erd', true, false, graph => {
  graph.nodes[0].data.title = 'users'; graph.nodes[1].data.title = 'orders'; graph.nodes[2].data.title = 'audit'
  graph.nodes[1].data.description = ['*id : INT', 'users_id : INT <<FK>>']
  graph.nodes[2].data.description = ['*id : INT', 'orders_id : INT <<FK>>']
  graph.nodes[0].selected = scope === 'multi'; graph.nodes[1].selected = scope === 'multi'; graph.edges[0].selected = scope === 'multi'
  graph.edges[0].data = { sourceMany: false, targetMany: true, sourceOptional: false, targetOptional: false }
  graph.edges.push({ id: 'bc', source: 'b', target: 'c', selected: false, data: { sourceMany: false, targetMany: true } })
 })
 const expectedTables = scope === 'single' ? ['orders'] : ['orders','users']
 const menuAction = scope === 'single' ? 'Generate DDL for this entity' : 'Generate DDL for selection'
 await open('node', 'b'); const before = graphState(); await click(menuAction)
 for (const dialect of advertisedDialectIds) {
  await act(async () => { dialectSelect().value = dialect; dialectSelect().dispatchEvent(new Event('change', { bubbles: true })) })
  expect(dialectSelect().value).toBe(dialect); expect(createdTables(ddlPreview())).toEqual(expectedTables)
  expect(graphState()).toEqual(before)
  expect(document.querySelector('[role="dialog"]')!.textContent).toContain(scope === 'multi' ? '2 selected entities' : '1 selected entities')
  await closeDdl(); expect(graphState()).toEqual(before)
  await open('node', 'b'); expect(button(menuAction)).toBeTruthy(); await click(menuAction)
  expect(dialectSelect().value).toBe('postgresql'); expect(createdTables(ddlPreview())).toEqual(expectedTables); expect(graphState()).toEqual(before)
 }
})
