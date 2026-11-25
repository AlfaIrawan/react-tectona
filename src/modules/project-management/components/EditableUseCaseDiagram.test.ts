/* eslint-disable @typescript-eslint/no-explicit-any -- Renderer boundary captures deliberately heterogeneous ReactFlow props. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditableDiagramCanvas } from './EditableDiagramCanvas'

// Exercise real editor menus/state; isolate renderer, backend, and browser export boundaries.
const probe = vi.hoisted(() => ({ flow: {} as any, workspaceId: null as string | null, chat: vi.fn(), copyImage: vi.fn(), image: vi.fn(async () => 'data:image/png;base64,test') }))
vi.mock('./IntegrationArchitectureFlow', () => ({ IntegrationArchitectureFlow: (props: any) => { probe.flow = props; return createElement('div', { 'data-testid': 'flow' }) } }))
vi.mock('reactflow', async original => ({ ...await original<typeof import('reactflow')>(), useReactFlow: () => ({ screenToFlowPosition: (p: any) => p }) }))
vi.mock('@/auth/TenantContext', () => ({ useTenantContextOptional: () => probe.workspaceId ? { workspaceId: probe.workspaceId } : null }))
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
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; probe.workspaceId = null; host = document.createElement('div'); document.body.append(host); root = createRoot(host); localStorage.clear() })
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); host.remove() })
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

const bootstrapSource = '@startuml\nactor Customer as customer\nusecase "From source" as order\ncustomer -- order\n@enduml'
const graphWithTitle = (title: string) => {
  const graph = parseUseCaseDiagram(bootstrapSource)
  graph.nodes[1].data.title = title
  return graph
}
const bootKey = 'brainstorm-use-case'
function renderBootstrap(ideaId: string, savedGraph?: ReturnType<typeof graphWithTitle>, editable = true, onPersistGraph?: ReturnType<typeof vi.fn>) {
  return act(async () => {
    root.render(createElement(EditableDiagramCanvas, {
      ideaId, diagramKey: bootKey, source: bootstrapSource, format: 'use-case', editable, savedGraph, fillHeight: true, onPersistGraph,
    }))
  })
}
function cacheGraph(ideaId: string, title: string) {
  const store = JSON.parse(localStorage.getItem('tectona-idea-editable-diagrams-v2') ?? '{}')
  localStorage.setItem('tectona-idea-editable-diagrams-v2', JSON.stringify({ ...store, [`${ideaId}:${bootKey}`]: graphWithTitle(title) }))
}
const titles = (): string[] => probe.flow.nodes.map((node: { data: { title: string } }) => node.data.title)
const addUnsavedNode = () => act(async () => {
  const button = document.querySelector<HTMLButtonElement>('[aria-label="Use case"]')
  expect(button).not.toBeNull()
  button?.click()
})

it('uses provided saved graph ahead of cached and source graphs, then retains edits on same-key refresh', async () => {
  cacheGraph('saved', 'From cache')
  await renderBootstrap('saved', graphWithTitle('From saved graph'))
  expect(titles()).toEqual(['Customer', 'From saved graph'])
  await addUnsavedNode()
  const edited = titles()
  expect(edited).toHaveLength(3)
  await renderBootstrap('saved', graphWithTitle('Refetched'))
  expect(titles()).toEqual(edited)
  cacheGraph('other', 'Other cached graph')
  await renderBootstrap('other')
  expect(titles()).toEqual(['Customer', 'Other cached graph'])
})

it('uses source for read-only canvas without a saved graph, even when a browser cache exists', async () => {
  cacheGraph('readonly', 'From cache')
  await renderBootstrap('readonly', undefined, false)
  expect(titles()).toEqual(['Customer', 'From source'])
})

const reload = 'Reload saved diagram'
const discard = 'Discard edits and reload'
const findButton = (label: string) => Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === label)
const clickButton = (label: string) => act(async () => {
  const button = findButton(label)
  expect(button).toBeDefined()
  button?.click()
})

it('applies the first late saved graph when only cache, selection and renderer measurements changed', async () => {
  cacheGraph('clean', 'From cache')
  await renderBootstrap('clean')
  expect(titles()).toEqual(['Customer', 'From cache'])
  await act(async () => probe.flow.onNodesChange([
    { type: 'select', id: 'order', selected: true },
    { type: 'dimensions', id: 'order', dimensions: { width: 180, height: 80 } },
  ]))
  await renderBootstrap('clean', graphWithTitle('First saved graph'))
  expect(titles()).toEqual(['Customer', 'First saved graph'])
  expect(findButton(reload)).toBeUndefined()
})

it('keeps local edits when the first response arrives and only reloads after explicit confirmation', async () => {
  vi.useFakeTimers()
  const persist = vi.fn()
  cacheGraph('late', 'From cache')
  await renderBootstrap('late', undefined, true, persist)
  expect(titles()).toEqual(['Customer', 'From cache'])
  await addUnsavedNode()
  const edited = titles()
  expect(edited).toHaveLength(3)
  await renderBootstrap('late', graphWithTitle('First late saved graph'), true, persist)
  expect(titles()).toEqual(edited)
  await act(async () => { vi.advanceTimersByTime(701) })
  expect(persist).not.toHaveBeenCalled()
  await clickButton(reload)
  await clickButton('Keep editing')
  expect(findButton(discard)).toBeUndefined()
  expect(titles()).toEqual(edited)
  await clickButton(reload)
  await clickButton(discard)
  expect(titles()).toEqual(['Customer', 'First late saved graph'])
  expect(findButton(reload)).toBeUndefined()
  await act(async () => probe.flow.onUndo())
  expect(titles()).toEqual(['Customer', 'First late saved graph'])
})

it('invalidates an open recovery when a newer response arrives or the response is withdrawn', async () => {
  await renderBootstrap('stale')
  await addUnsavedNode()
  const edited = titles()
  await renderBootstrap('stale', graphWithTitle('Old response'))
  await clickButton(reload)
  expect(findButton(discard)).toBeDefined()
  await renderBootstrap('stale', graphWithTitle('Latest response'))
  expect(findButton(discard)).toBeUndefined()
  expect(titles()).toEqual(edited)
  await clickButton(reload)
  await renderBootstrap('stale')
  expect(findButton(discard)).toBeUndefined()
  expect(findButton(reload)).toBeUndefined()
  expect(titles()).toEqual(edited)
  await renderBootstrap('stale', graphWithTitle('Final response'))
  await clickButton(reload)
  await clickButton(discard)
  expect(titles()).toEqual(['Customer', 'Final response'])
})

it('does not carry dirty state or confirmation into another workspace with the same canvas key', async () => {
  probe.workspaceId = 'workspace-a'
  await renderBootstrap('same-idea')
  await addUnsavedNode()
  await renderBootstrap('same-idea', graphWithTitle('Workspace A response'))
  await clickButton(reload)
  probe.workspaceId = 'workspace-b'
  await renderBootstrap('same-idea')
  expect(titles()).toEqual(['Customer', 'From source'])
  await renderBootstrap('same-idea', graphWithTitle('Workspace B graph'))
  expect(titles()).toEqual(['Customer', 'Workspace B graph'])
  expect(findButton(discard)).toBeUndefined()
  expect(findButton(reload)).toBeUndefined()
  probe.workspaceId = 'workspace-a'
  await renderBootstrap('same-idea', graphWithTitle('Workspace A response'))
  expect(titles()).toHaveLength(3)
  expect(findButton(reload)).toBeDefined()
  expect(findButton(discard)).toBeUndefined()
})
