/* eslint-disable @typescript-eslint/no-explicit-any -- Renderer boundary captures deliberately heterogeneous ReactFlow props. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Edge, Node } from 'reactflow'
import { ERD_SQL_DIALECTS } from '../lib/erdDdlDialects'
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
it('retains exact imported FK mapping through add, selection, persisted graph remount and every target export', async () => {
 await mount('erd'); await open('pane'); await click('Import SQL DDL')
 const press = async (label: string) => { await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === label)!.click()) }
 await act(async () => { const input = document.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'CREATE TABLE qa_parent (id INTEGER PRIMARY KEY); CREATE TABLE qa_child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES qa_parent(id));'); input.dispatchEvent(new Event('input', { bubbles: true })) })
 await press('Preview import'); await press('Add to diagram')
 const child = probe.flow.nodes.find((n: Node) => n.data.title === 'qa_child'), parent = probe.flow.nodes.find((n: Node) => n.data.title === 'qa_parent')
 const relation = probe.flow.edges.find((e: Edge) => e.source === child.id && e.target === parent.id)
 expect(relation.data.erdForeignKey).toEqual({ childNodeId: child.id, parentNodeId: parent.id, columns: ['parent_id'], referencedColumns: ['id'] })
 const savedGraph = JSON.parse(JSON.stringify({ nodes: probe.flow.nodes, edges: probe.flow.edges }))
 await open('node', child.id); await click('Generate DDL for selection'); expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Generated SQL"]')!.value).toContain('FOREIGN KEY ("parent_id") REFERENCES "qa_parent" ("id")'); await press('Close')
 await act(async () => root.render(createElement(EditableDiagramCanvas, { key: 'remount-roundtrip', ideaId: 'remount-roundtrip', diagramKey: 'erd', source: '', format: 'erd', editable: true, fillHeight: true, savedGraph })))
 await open('node', child.id); await click('Generate DDL for selection')
 for (const [id, profile] of Object.entries(ERD_SQL_DIALECTS)) {
  await act(async () => { const select = document.querySelector<HTMLSelectElement>('[aria-label="SQL dialect"]')!; select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })) })
  const sql = document.querySelector<HTMLTextAreaElement>('[aria-label="Generated SQL"]')!.value
  expect(sql, id).toContain(`FOREIGN KEY (${profile.quote('parent_id')}) REFERENCES ${profile.quote('qa_parent')} (${profile.quote('id')})`)
  expect(sql, id).not.toContain(`CREATE TABLE ${profile.quote('a')}`)
 }
 await press('Close'); await act(async () => probe.flow.onNodesChange([{ id: parent.id, type: 'select', selected: false }]))
 await open('node', child.id); await click('Generate DDL for selection'); expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Generated SQL"]')!.value).not.toContain('FOREIGN KEY'); expect(document.body.textContent).toContain('outside the selected usable tables')
})
