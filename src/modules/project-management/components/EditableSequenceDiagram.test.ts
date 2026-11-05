import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditableSequenceDiagram } from './EditableSequenceDiagram'
import { fetchPlantUmlPng } from '../lib/plantumlRenderClient'
import { usePlantUmlPngPreview } from '../lib/usePlantUmlPngPreview'

vi.mock('../lib/usePlantUmlPngPreview', () => ({ usePlantUmlPngPreview: vi.fn(() => ({ objectUrl: 'blob:preview', isLoading: false, error: null })) }))
vi.mock('../lib/plantumlRenderClient', () => ({ fetchPlantUmlPng: vi.fn() }))
vi.mock('./PlantUmlSourceEditor', () => ({ PlantUmlSourceEditor: ({ onChange }: { onChange: (value: string) => void }) =>
  createElement('button', { onClick: () => onChange('edited sequence') }, 'Edit fixture') }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
async function mount(save = vi.fn(), locked = false) {
  await act(async () => root.render(createElement(EditableSequenceDiagram, { source: 'original', locked, ideaId: 'idea', diagramKey: 'brainstorm-sequence', onSave: save })))
}
async function click(label: string) {
  await act(async () => { Array.from(container.querySelectorAll('button')).find(button => button.textContent === label)!.click() })
}

it('persists the edited sequence source and its exact rendered image together', async () => {
  vi.mocked(fetchPlantUmlPng).mockResolvedValue(new Blob(['exact-preview-image'], { type: 'image/png' }))
  const save = vi.fn()
  await mount(save)
  await click('Edit fixture')
  await click('Save')
  await act(async () => { await vi.waitFor(() => expect(save).toHaveBeenCalledOnce()) })
  expect(save.mock.calls[0][0]).toMatchObject({ source: 'edited sequence', canvasPngBase64: btoa('exact-preview-image'), nodes: [], edges: [] })
})
it('does not allow editing or saving while approval has locked content', async () => {
  await mount(vi.fn(), true)
  expect(container.querySelector('button')).toBeNull()
})
it('never saves a new source with a stale preview when rendering fails', async () => {
  vi.mocked(fetchPlantUmlPng).mockRejectedValue(new Error('Render unavailable'))
  const save = vi.fn()
  await mount(save)
  await click('Save')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Render unavailable')
  expect(save).not.toHaveBeenCalled()
})

it('shows the saved document snapshot without requesting another render', async () => {
  await act(async () => root.render(createElement(EditableSequenceDiagram, { source: 'saved source', locked: true,
    ideaId: 'idea', diagramKey: 'brainstorm-sequence', savedPngBase64: 'c25hcHNob3Q=' })))
  expect(usePlantUmlPngPreview).toHaveBeenLastCalledWith(null)
  expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,c25hcHNob3Q=')
  expect(fetchPlantUmlPng).not.toHaveBeenCalled()
})

it('reuses the saved image when saving an unchanged source', async () => {
  const save = vi.fn()
  await act(async () => root.render(createElement(EditableSequenceDiagram, { source: 'saved source', locked: false,
    ideaId: 'idea', diagramKey: 'brainstorm-sequence', savedPngBase64: 'c25hcHNob3Q=', onSave: save })))
  await click('Save')
  expect(fetchPlantUmlPng).not.toHaveBeenCalled()
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ canvasPngBase64: 'c25hcHNob3Q=' }))
})
