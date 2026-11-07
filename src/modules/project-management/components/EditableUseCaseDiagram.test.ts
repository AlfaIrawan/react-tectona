/* eslint-disable @typescript-eslint/no-explicit-any -- Renderer boundary captures deliberately heterogeneous ReactFlow props. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditableDiagramCanvas } from './EditableDiagramCanvas'

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


import { parseUseCaseDiagram } from '../lib/useCasePlantUml'
let host: HTMLDivElement, root: Root
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); localStorage.clear() })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
it('opens the saved use-case graph and offers UML editing without losing saved labels', async () => {
 const source = '@startuml\nactor Customer as customer\nusecase "Order" as order\ncustomer -- order\n@enduml'
 const savedGraph = parseUseCaseDiagram(source)
 savedGraph.nodes[1].data.title = 'Saved order'
 await act(async () => root.render(createElement(EditableDiagramCanvas, { ideaId: 'use-case-test', diagramKey: 'brainstorm-use-case', source, format: 'use-case', editable: true, fillHeight: true, savedGraph })))
 expect(probe.flow.nodes.find((n: any) => n.id === 'order').data.title).toBe('Saved order')
 expect(probe.flow.nodes.every((n: any) => n.type === 'umlUseCase')).toBe(true)
 expect(document.querySelector('[aria-label="Actor"]')).not.toBeNull()
 expect([...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label'))).toContain('<<include>> (base to included)')
 await act(async () => (document.querySelector('[aria-label="Use case"]') as HTMLButtonElement).click())
 expect(probe.flow.nodes).toHaveLength(3)
})
