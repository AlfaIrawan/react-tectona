import { readFileSync } from 'node:fs'
import { act, createElement, useCallback, useEffect, useEffectEvent } from 'react'
import { createRoot } from 'react-dom/client'
import ts from 'typescript'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const page = ts.createSourceFile(
  'IdeaDetailPage.tsx',
  readFileSync('src/modules/project-management/pages/IdeaDetailPage.tsx', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)

// Mount the actual effect expressions without mounting unrelated Idea Detail services.
function bindEffect<Props extends object>(matches: (call: ts.CallExpression) => boolean, locals: string) {
  const calls: ts.CallExpression[] = []
  let eventDeclaration = ''
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect' && matches(node)) calls.push(node)
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(
      (declaration) => declaration.name.getText(page) === 'scheduleBrdAutoPagination',
    )) eventDeclaration = node.getText(page)
    ts.forEachChild(node, visit)
  }
  visit(page)
  expect(calls).toHaveLength(1)
  const Component: (props: Props) => null = new Function('useEffect', 'useEffectEvent', `
    return function EffectHarness(props) {
      ${locals}
      ${eventDeclaration && calls[0].getText(page).includes('scheduleBrdAutoPagination') ? eventDeclaration : ''}
      ${calls[0].getText(page)}
      return null
    }`
  )(useEffect, useEffectEvent)
  return Component
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function bindAction<Idea, Args extends unknown[]>(name: string, services: Record<string, unknown>) {
  const matches: ts.VariableDeclaration[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(page) === name) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(page)
  expect(matches).toHaveLength(1)
  expect(matches[0].initializer?.getText(page)).toMatch(/^useCallback\(/)
  const harness = ts.transpile(`
      return function ActionHarness({ idea, capture }) {
        const ${name} = ${matches[0].initializer?.getText(page)}
        capture(${name})
        return null
      }
    `, { target: ts.ScriptTarget.ES2022 })
  const Component: (props: { idea: Idea; capture: (action: (...args: Args) => Promise<void>) => void }) => null =
    new Function('useCallback', ...Object.keys(services), harness)(useCallback, ...Object.values(services))
  return Component
}

it('uses the latest rendered idea version if the summary refresh fails, and prefers the server version on success', async () => {
  const generateIdeaSummary = vi.fn().mockResolvedValue({ summary_mode: 'llm_first' })
  const getIdeaById = vi.fn()
  const upsertPersistentIdeaSummary = vi.fn()
  const Component = bindAction<{ version: number }, ['llm_first', { forceRefresh: boolean }]>('loadRuntimeSummary', {
    getPersistentIdeaSummary: vi.fn().mockResolvedValue(null), generateIdeaSummary, getIdeaById,
    upsertPersistentIdeaSummary, runtimeUserId: 'test-user', applyRuntimeSummary: vi.fn(),
    setIdea: vi.fn(), ideaFromApi: (record: unknown) => record,
    setSummaryGenerationError: vi.fn(), setSummaryMissing: vi.fn(),
  })
  const idea = { id: 'test-idea', version: 1, title: 'Test', description: '', workspace: 'qa',
    status: 'new', scoring: {}, tags: [] }
  const root = createRoot(document.createElement('div'))
  let action!: (mode: 'llm_first', options: { forceRefresh: boolean }) => Promise<void>
  const capture = (next: typeof action) => { action = next }
  try {
    await act(() => root.render(createElement(Component, { idea, capture })))
    await act(() => root.render(createElement(Component, { idea: { ...idea, version: 2 }, capture })))
    expect(generateIdeaSummary).not.toHaveBeenCalled()
    getIdeaById.mockResolvedValueOnce({ version: 3 }).mockRejectedValueOnce(new Error('offline'))
    await act(() => action('llm_first', { forceRefresh: true }))
    expect(upsertPersistentIdeaSummary).toHaveBeenNthCalledWith(1, idea.id, expect.objectContaining({ version: 3 }))
    await act(() => action('llm_first', { forceRefresh: true }))
    expect(upsertPersistentIdeaSummary).toHaveBeenNthCalledWith(2, idea.id, expect.objectContaining({ version: 2 }))
    expect(generateIdeaSummary).toHaveBeenCalledTimes(2)
  } finally {
    await act(() => root.unmount())
  }
})

it('loads intake for the currently rendered workspace without issuing a request on rerender', async () => {
  const fetchIdeaIntakeAnswers = vi.fn().mockResolvedValue({ block: 'Confirmed intake' })
  const setIdeaDocGenerateSource = vi.fn()
  const Component = bindAction<{ workspace: string }, []>('openIdeaDocGenerateDialog', {
    fetchIdeaIntakeAnswers, setIdeaDocGenerateSource, addToast: vi.fn(),
    ideaDocTemplates: [{ id: 'srd' }], templateAllowedByWorkflow: () => true,
    refreshIdeaDocWorkflowGate: vi.fn().mockResolvedValue({}),
    getIdeaById: vi.fn().mockResolvedValue({ approved_sections: {} }),
    setIdeaDocGenerateTemplateId: vi.fn(), setIdeaDocGenerateIntakeBlock: vi.fn(),
    setIdeaDocGenerateIntakeAnswers: vi.fn(), setIdeaDocGenerateIntakeFollowups: vi.fn(),
    setIdeaDocGenerateIntakeOpenPoints: vi.fn(), setIdeaDocGenerateIntakeOpenPointTurns: vi.fn(),
    setIdeaDocGenerateIntakeOpenPointQuestionKinds: vi.fn(), setIdeaDocSourceTab: vi.fn(),
    setIdeaDocSourceMode: vi.fn(), setIdeaDocGenerateOpen: vi.fn(),
  })
  const idea = { id: 'test-idea', title: 'Test', description: 'Narrative', workspace: 'qa-old' }
  const root = createRoot(document.createElement('div'))
  let action!: () => Promise<void>
  const capture = (next: typeof action) => { action = next }
  try {
    await act(() => root.render(createElement(Component, { idea, capture })))
    await act(() => root.render(createElement(Component, { idea: { ...idea, workspace: 'qa-current' }, capture })))
    expect(fetchIdeaIntakeAnswers).not.toHaveBeenCalled()
    await act(action)
    expect(fetchIdeaIntakeAnswers.mock.calls).toEqual([[idea.id, { title: idea.title, workspaceId: 'qa-current' }]])
    expect(setIdeaDocGenerateSource.mock.calls).toEqual([['Confirmed intake\n\nNarrative']])
  } finally {
    await act(() => root.unmount())
  }
})

beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
afterEach(() => vi.unstubAllGlobals())

it('refreshes subfolders only on the document panel and folder ID; ignores stale results and clears on a current failure', async () => {
  type Folder = { id: string; name: string }
  const requests: ReturnType<typeof deferred<{ folders: Folder[] }>>[] = []
  const fetchDocumentFolders = vi.fn<(params: { parent_id: string; page: number; page_size: number }) => Promise<{ folders: Folder[] }>>(() => {
    const request = deferred<{ folders: Folder[] }>()
    requests.push(request)
    return request.promise
  })
  const setIdeaDocSubfolders = vi.fn()
  const Harness = bindEffect<{
    activePanel: string
    ideaDocCurrentFolder: Folder | null
    fetchDocumentFolders: typeof fetchDocumentFolders
    setIdeaDocSubfolders: typeof setIdeaDocSubfolders
  }>(
    (call) => call.getText(page).includes('setIdeaDocSubfolders(response.folders)'),
    'const { activePanel, ideaDocCurrentFolder, fetchDocumentFolders, setIdeaDocSubfolders } = props; const ideaDocCurrentFolderId = ideaDocCurrentFolder?.id;',
  )
  const root = createRoot(document.createElement('div'))
  const render = (activePanel: string, ideaDocCurrentFolder: Folder | null) => act(async () => {
    root.render(createElement(Harness, { activePanel, ideaDocCurrentFolder, fetchDocumentFolders, setIdeaDocSubfolders }))
  })
  const a = { id: 'a', name: 'Folder A' }
  const b = { id: 'b', name: 'Folder B' }
  const child = { id: 'child', name: 'Child' }
  try {
    await render('summary', a)
    await render('document', null)
    expect(fetchDocumentFolders).not.toHaveBeenCalled()
    await render('document', a)
    expect(fetchDocumentFolders).toHaveBeenNthCalledWith(1, { parent_id: 'a', page: 1, page_size: 100 })
    await render('document', { ...a, name: 'Renamed' })
    expect(fetchDocumentFolders).toHaveBeenCalledTimes(1)
    await render('document', b)
    expect(fetchDocumentFolders).toHaveBeenNthCalledWith(2, { parent_id: 'b', page: 1, page_size: 100 })
    await act(async () => requests[1].resolve({ folders: [child] }))
    await act(async () => requests[0].resolve({ folders: [a] }))
    expect(setIdeaDocSubfolders.mock.calls).toEqual([[[child]]])
    await render('document', a)
    await render('summary', a)
    await act(async () => requests[2].reject(new Error('stale failure')))
    expect(setIdeaDocSubfolders).toHaveBeenCalledTimes(1)
    await render('document', a)
    await act(async () => requests[3].reject(new Error('current failure')))
    expect(setIdeaDocSubfolders.mock.calls).toEqual([[[child]], [[]]])
  } finally {
    await act(async () => root.unmount())
  }
})

it('preserves BRD frame cancellation, the scheduled callbacks, and the pagination lock sequence', async () => {
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
    frames.set(++frameId, fn)
    return frameId
  })
  const frame = () => act(async () => {
    const current = [...frames]
    for (const [id, callback] of current) {
      if (frames.delete(id)) callback(0)
    }
  })
  const pages = ['input']
  const next = ['first', 'second']
  const brdPagesRef = { current: pages }
  const brdAutoPaginatingRef = { current: false }
  const brdPageEditableRefs = { current: [{ isConnected: false }] }
  const isBrdRenderLockedRef = { current: false }
  const order: string[] = []
  const setBrdPages = vi.fn((result: string[]) => {
    expect(brdPagesRef.current).toBe(result)
    expect(brdAutoPaginatingRef.current).toBe(true)
    order.push('write')
  })
  const scheduleWordCountUpdate = vi.fn(() => {
    expect(brdPagesRef.current).toBe(next)
    order.push('words')
  })
  const rebalancePagesFrom = vi.fn<(input: string[], index: number) => string[]>(() => {
    order.push('rebalance')
    return next
  })
  const otherRebalance = vi.fn<(input: string[], index: number) => string[]>((input) => input)
  const otherWordCount = vi.fn()
  const defaults = {
    brdPagesRef, brdAutoPaginatingRef, brdPageEditableRefs, isBrdRenderLockedRef, setBrdPages,
    scheduleWordCountUpdate, rebalancePagesFrom, activePanel: 'brd', brdFontFamily: 'Arial', brdFontSize: 11,
    brdLineHeight: 1.5, brdHeaderHeights: [18], brdPages: pages, isBrdGenerating: false, isBrdRenderLocked: false,
  }
  const Harness = bindEffect<typeof defaults>(
    (call) => /rebalancePagesFrom\(currentPages, 0\)|scheduleBrdAutoPagination\(/.test(call.arguments[0].getText(page)),
    `const { ${Object.keys(defaults).join(', ')} } = props;`,
  )
  const root = createRoot(document.createElement('div'))
  const render = (props: Partial<typeof defaults> = {}) => act(async () => {
    root.render(createElement(Harness, { ...defaults, ...props }))
  })
  try {
    await render()
    brdPageEditableRefs.current[0].isConnected = true
    await render({ isBrdGenerating: true })
    isBrdRenderLockedRef.current = true
    await render({ isBrdRenderLocked: true })
    expect(request).not.toHaveBeenCalled()
    isBrdRenderLockedRef.current = false
    await render()
    expect(frames.size).toBe(1)
    await render({ brdFontSize: 12 })
    expect(cancel).toHaveBeenCalledWith(1)
    expect([...frames.keys()]).toEqual([2])
    await render({ brdFontSize: 12, rebalancePagesFrom: otherRebalance, scheduleWordCountUpdate: otherWordCount })
    expect([...frames.keys()]).toEqual([2])
    await frame()
    expect(rebalancePagesFrom.mock.calls).toEqual([[pages, 0]])
    expect(rebalancePagesFrom.mock.calls[0][0]).not.toBe(pages)
    expect(otherRebalance).not.toHaveBeenCalled()
    expect(otherWordCount).not.toHaveBeenCalled()
    expect(order).toEqual(['rebalance', 'write', 'words'])
    expect(brdAutoPaginatingRef.current).toBe(true)
    await render({ isBrdGenerating: true })
    expect(frames.size).toBe(1)
    await frame()
    expect(brdAutoPaginatingRef.current).toBe(false)
    await render({ rebalancePagesFrom: otherRebalance })
    await frame()
    expect(otherRebalance.mock.calls).toEqual([[next, 0]])
    expect(setBrdPages).toHaveBeenCalledTimes(1)
    expect(scheduleWordCountUpdate).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  } finally {
    await act(async () => root.unmount())
    request.mockRestore()
    cancel.mockRestore()
  }
})
