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
  expect(container.querySelector('fieldset')).toBeNull()
  expect(container.textContent).not.toContain('Save')
  expect(container.textContent).not.toContain('Edit fixture')
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


it('switches documents without retaining a previous edited draft', async () => {
  await mount()
  await click('Edit fixture')
  await act(async () => root.render(createElement(EditableSequenceDiagram, { source: 'second source', locked: false, ideaId: 'other', diagramKey: 'sequence' })))
  expect(usePlantUmlPngPreview).toHaveBeenLastCalledWith('second source')
  expect(container.textContent).not.toContain('Unsaved changes')
})
it('accepts an authoritative source update for the same document', async () => {
  await mount()
  await click('Edit fixture')
  await act(async () => root.render(createElement(EditableSequenceDiagram, { source: 'updated source', locked: false, ideaId: 'idea', diagramKey: 'brainstorm-sequence' })))
  expect(usePlantUmlPngPreview).toHaveBeenLastCalledWith('updated source')
})
it('does not present the previous image as the current draft while rendering', async () => {
  vi.mocked(usePlantUmlPngPreview).mockReturnValueOnce({ objectUrl: 'blob:old-preview', isLoading: true, error: null })
  await mount()
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Rendering preview...')
})
it('provides explicit fit and readable actual-size controls', async () => {
  await mount()
  await click('100%')
  expect(container.querySelector('img')?.style.maxWidth).toBe('none')
  await click('Fit')
  expect(container.querySelector('img')?.style.maxWidth).toBe('100%')
})
it('inserts notation into the editable and persisted source, never just the preview', async () => {
  vi.mocked(fetchPlantUmlPng).mockResolvedValue(new Blob(['notation-image'], { type: 'image/png' }))
  const save = vi.fn()
  await act(async () => root.render(createElement(EditableSequenceDiagram, { source: '@startuml\nparticipant Client\nparticipant API\n@enduml', locked: false, ideaId: 'idea', diagramKey: 'sequence', onSave: save })))
  await click('Insert notation')
  expect(usePlantUmlPngPreview).toHaveBeenLastCalledWith('@startuml\nparticipant Client\nparticipant API\nClient -> API: Message\n@enduml')
  await click('Save')
  await act(async () => { await vi.waitFor(() => expect(save).toHaveBeenCalledOnce()) })
  expect(save.mock.calls[0][0].source).toContain('Client -> API: Message')
})
it('does not save an obsolete document after switching during rendering', async () => {
  let resolveRender!: (blob: Blob) => void
  vi.mocked(fetchPlantUmlPng).mockReturnValue(new Promise(resolve => { resolveRender = resolve }))
  const save = vi.fn()
  await mount(save)
  await click('Save')
  await act(async () => root.render(createElement(EditableSequenceDiagram, { source: 'next', locked: false, ideaId: 'next', diagramKey: 'sequence' })))
  await act(async () => { resolveRender(new Blob(['old'], { type: 'image/png' })); await new Promise(resolve => setTimeout(resolve, 30)) })
  expect(save).not.toHaveBeenCalled()
})

it('treats additional lifeline roles as declarations with no endpoint requirement', async () => {
  await act(async () => root.render(createElement(EditableSequenceDiagram, { source: '', locked: false, ideaId: 'empty', diagramKey: 'sequence' })))
  const selector = container.querySelector('select[aria-label="Sequence notation"]') as HTMLSelectElement
  await act(async () => { selector.value = 'database'; selector.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(container.querySelector('select[aria-label="From participant"]')).toBeNull()
  await click('Insert notation')
  expect(usePlantUmlPngPreview).toHaveBeenLastCalledWith('@startuml\ndatabase "New participant" as Database1\n@enduml')
})
