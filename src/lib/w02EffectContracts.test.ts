import { readFileSync } from 'node:fs'
import { act, createElement, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import ts from 'typescript'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mapWorkItemsToPlanningGantt } from '@/modules/planning-scheduling/utils/mapWorkItemsToPlanningGantt'

const backlog = 'src/modules/project-management/pages/IdeaBacklogManagementPage.tsx'
const knowledge = 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx'
const chat = 'src/modules/core-shell/components/ChatSidebarPanel.tsx'
const diagram = 'src/modules/project-management/components/EditableDiagramCanvas.tsx'
const taskWork = 'src/modules/task-work-management/pages/TaskWorkManagementPage.tsx'
const planningGantt = 'src/modules/planning-scheduling/components/PlanningSvarGantt.tsx'
const planningPage = 'src/modules/planning-scheduling/pages/PlanningSchedulingPage.tsx'

function readNodes(path: string, hook = 'useEffect') {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const statements = new Map<string, string>()
  const effects: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.length === 1) {
      statements.set(node.declarationList.declarations[0].name.getText(file), node.getText(file))
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      statements.set(node.name.text, node.getText(file))
    }
    if (ts.isCallExpression(node) && node.expression.getText(file) === hook) effects.push(node.getText(file))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { statements, effects }
}

// Exercise the actual effects with controlled inputs instead of mounting service-heavy routes.
function mountEffect<Props extends object>(path: string, contains: string | RegExp, locals: string, event?: string, hook = 'useEffect') {
  const { statements, effects } = readNodes(path, hook)
  const matching = effects.filter((effect) => typeof contains === 'string' ? effect.includes(contains) : contains.test(effect))
  expect(matching).toHaveLength(1)
  const source = ts.transpileModule(`
    const harness = function EffectHarness(props) {
      ${locals}
      ${(event && statements.get(event)) || ''}
      ${matching[0]}
      return null
    }
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const Harness: (props: Props) => null = new Function(
    'useEffect', 'useEffectEvent', 'useLayoutEffect', source + '\nreturn harness;',
  )(useEffect, useEffectEvent, useLayoutEffect)
  const root = createRoot(document.createElement('div'))
  return {
    render: (props: Props) => act(async () => { root.render(createElement(Harness, props)) }),
    unmount: () => act(async () => root.unmount()),
  }
}

beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function mountControl<Props extends object>(
  path: string, name: string, bindings: Record<string, unknown>,
  dependencies: string[] = [], wrapper?: string,
) {
  const { statements } = readNodes(path)
  const declarations = [...dependencies, name].map((key) => {
    const declaration = statements.get(key)
    expect(declaration).toBeDefined()
    return declaration
  })
  const wrapped = wrapper?.replace('/* fixture declaration */', () => declarations.pop() ?? '')
  const source = ts.transpileModule([...declarations, wrapped].join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'createElement' },
  }).outputText
  const scope = {
    createElement, createPortal, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useState, useRef,
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
    ...bindings,
  }
  const Control: ComponentType<Props> = new Function(...Object.keys(scope), source + '\nreturn ' + (wrapper ? 'Harness' : name))(
    ...Object.values(scope),
  )
  const host = document.body.appendChild(document.createElement('div'))
  const root = createRoot(host)
  return {
    host,
    render: (props: Props) => act(async () => { root.render(createElement(Control, props)) }),
    unmount: async () => {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

it('refreshes shareable contacts when the directory arrives and does not expose rejected contacts', async () => {
  const props = { chatContacts: [] as Array<{ id: string; disabled?: boolean }> }
  const pick = vi.fn((contact: { id: string; disabled?: boolean }, actor: string) => !contact.disabled && contact.id !== actor)
  const view = mountControl<typeof props>(chat, 'shareableTeamContacts', {
    getCurrentChatActorId: () => 'self', canPickContactForGroupChat: pick,
  }, [], `function Harness({chatContacts}) {
    /* fixture declaration */
    return <output>{shareableTeamContacts.map(contact => contact.id).join(',')}</output>
  }`)
  try {
    await view.render(props)
    expect(view.host.textContent).toBe('')
    await view.render({ chatContacts: [{ id: 'self' }, { id: 'new' }, { id: 'disabled', disabled: true }] })
    expect(view.host.textContent).toBe('new')
    expect(pick).toHaveBeenCalledTimes(3)
    await view.render({ chatContacts: [] })
    expect(view.host.textContent).toBe('')
  } finally {
    await view.unmount()
  }
})

it('refreshes group member names without changing the selected IDs or conversation fallback', async () => {
  const props = {
    groupDialogPendingContactIds: ['one'],
    groupDialogPendingIds: ['thread'],
    conversations: [{ id: 'thread', mode: 'team', title: 'Conversation name' }],
    chatContacts: [{ id: 'one', name: 'Old name' }],
  }
  const view = mountControl<typeof props>(chat, 'groupDialogMemberPreview', {}, [],
    `function Harness({groupDialogPendingContactIds, groupDialogPendingIds, conversations, chatContacts}) {
      /* fixture declaration */
      return <output>{groupDialogMemberPreview}</output>
    }`)
  try {
    await view.render(props)
    expect(view.host.textContent).toBe('Old name')
    const updated = { ...props, chatContacts: [{ id: 'one', name: 'Current name' }] }
    await view.render(updated)
    expect(view.host.textContent).toBe('Current name')
    await view.render({ ...updated, groupDialogPendingContactIds: [] })
    expect(view.host.textContent).toBe('Conversation name')
  } finally {
    await view.unmount()
  }
})

it('refreshes contact media when a thread binds to a channel and when its conversation alias changes', async () => {
  const props = {
    contactInfoConversationId: 'direct' as string | null,
    contactInfoConversation: { channelId: undefined as string | undefined },
    messagesById: { 'conv-channel-a': [{ attachments: [{ id: 'a', url: '/a', kind: 'image', name: 'A' }] }],
      alias: [{ attachments: [{ id: 'b', url: '/b', kind: 'image', name: 'B' }] }] },
    conversations: [{ id: 'direct' }] as Array<{ id: string; channelId?: string }>,
  }
  const view = mountControl<typeof props>(chat, 'contactInfoMediaItems', {
    materializePeopleChatUiMessage: (message: unknown) => message,
    applyClearHistoryFilter: (messages: unknown) => messages,
    applyDisappearingExpiryFilter: (messages: unknown) => messages,
  }, ['channelConversationId', 'resolveThreadMessages'],
  `function Harness({contactInfoConversationId, contactInfoConversation, messagesById, conversations}) {
    /* fixture declaration */
    return <output>{contactInfoMediaItems.map(item => item.name).join(',')}</output>
  }`)
  try {
    await view.render(props)
    expect(view.host.textContent).toBe('')
    await view.render({ ...props, contactInfoConversation: { channelId: 'a' } })
    expect(view.host.textContent).toBe('A')
    const bound = { ...props, contactInfoConversation: { channelId: 'b' } }
    await view.render(bound)
    expect(view.host.textContent).toBe('')
    await view.render({ ...bound, conversations: [...props.conversations, { id: 'alias', channelId: 'b' }] })
    expect(view.host.textContent).toBe('B')
    await view.render({ ...bound, contactInfoConversationId: null })
    expect(view.host.textContent).toBe('')
  } finally {
    await view.unmount()
  }
})

it('preserves timeline selection when present, selects the first replacement, and clears on an empty mapped model', async () => {
  const model = mapWorkItemsToPlanningGantt([], [])
  expect(model).toEqual({ items: [], workspaceOrder: [] })
  const props = { timelineItems: [{ id: 'one' }, { id: 'two' }], setSelectedItemId: vi.fn() }
  const view = mountEffect<typeof props>(planningPage, 'if (timelineItems.length === 0)',
    'const { timelineItems, setSelectedItemId } = props;')
  try {
    await view.render(props)
    const select = props.setSelectedItemId.mock.lastCall![0] as (previous: string) => string
    expect(select('two')).toBe('two')
    expect(select('missing')).toBe('one')
    await view.render({ ...props })
    expect(props.setSelectedItemId).toHaveBeenCalledOnce()
    await view.render({ ...props, timelineItems: model.items })
    expect(props.setSelectedItemId).toHaveBeenLastCalledWith('')
  } finally {
    await view.unmount()
  }
})

it('closes the Work Item person portal on containment changes without selecting or leaking listeners', async () => {
  const props = {
    id: 'person-test', label: 'Assignee', value: 'Alex', options: ['Alex', 'Taylor'],
    onChange: vi.fn(), containmentOpen: true,
  }
  const view = mountControl<typeof props>(taskWork, 'WorkItemPersonSelect', {
    Label: 'label', WorkItemPersonAvatar: () => null, ChevronDown: () => null, CheckCircle2: () => null,
  })
  const panel = () => document.querySelector('[role=listbox][aria-label="Assignee options"]')
  const toggle = () => act(async () => { view.host.querySelector('button')!.click() })
  const add = vi.spyOn(window, 'addEventListener')
  const remove = vi.spyOn(window, 'removeEventListener')
  try {
    await view.render(props)
    await toggle()
    expect(panel()?.querySelector('[aria-selected=true]')?.textContent).toBe('Alex')
    await view.render({ ...props, options: [...props.options, 'Morgan'] })
    expect(panel()?.textContent).toContain('Morgan')
    const scrollHandlers = add.mock.calls.filter(([event]) => event === 'scroll')
    expect(scrollHandlers).toHaveLength(1)
    await view.render({ ...props, containmentOpen: false })
    expect(panel()).toBeNull()
    expect(remove).toHaveBeenCalledWith(...scrollHandlers[0])
    expect(props.onChange).not.toHaveBeenCalled()
    await view.render(props)
    expect(panel()).toBeNull()
    await toggle()
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(panel()).toBeNull()
    await toggle()
    await act(async () => { panel()?.querySelectorAll('button')[1].click() })
    expect(props.onChange).toHaveBeenCalledOnce()
    expect(props.onChange).toHaveBeenCalledWith('Taylor')
    expect(panel()).toBeNull()
  } finally {
    await view.unmount()
    add.mockRestore()
    remove.mockRestore()
  }
})

it('retries a failed team avatar only after a conversation id or image URL change', async () => {
  const conversation = { id: 'a', mode: 'team', title: 'Alex Morgan', contactAvatarSrc: '/avatar-a.png' }
  const view = mountControl<{ conversation: typeof conversation }>(chat, 'ConversationRowAvatar', {
    titleToInitials: () => 'AM', resolveConversationDisappearingDuration: () => 'off',
    teamAvatarClassForConversation: () => '',
  })
  const image = () => view.host.querySelector('img')
  const fail = () => act(async () => { image()!.dispatchEvent(new Event('error')) })
  try {
    await view.render({ conversation })
    expect(image()?.getAttribute('src')).toBe('/avatar-a.png')
    await fail()
    expect(image()).toBeNull()
    expect(view.host.textContent).toBe('AM')
    await view.render({ conversation: { ...conversation, title: 'Updated title' } })
    expect(image()).toBeNull()
    await view.render({ conversation: { ...conversation, id: 'b' } })
    expect(image()?.getAttribute('src')).toBe('/avatar-a.png')
    await fail()
    await view.render({ conversation: { ...conversation, id: 'b', contactAvatarSrc: '/avatar-b.png' } })
    expect(image()?.getAttribute('src')).toBe('/avatar-b.png')
    await view.render({ conversation })
    expect(image()?.getAttribute('src')).toBe('/avatar-a.png')
  } finally {
    await view.unmount()
  }
})

it('binds group chat to selected conversations, not the contact directory', () => {
  const declaration = readNodes(chat).statements.get('createGroupFromSelectedConversations')
  expect(declaration).toBeDefined()
  const conversations = [
    { id: 'one', mode: 'team', contactId: 'alice', contactName: 'Alice in thread', title: 'Alice' },
    { id: 'two', mode: 'team', contactId: 'bob', title: 'Bob in thread' },
    { id: 'ai', mode: 'ai', contactId: 'ignored', title: 'Not a team conversation' },
  ]
  const scope = {
    conversations,
    chatContacts: [{ id: 'alice', name: 'Different directory name' }],
    setConversations: vi.fn<(update: (prior: typeof conversations) => typeof conversations) => void>(),
    setMessagesById: vi.fn<(update: (prior: object) => object) => void>(),
    bindGroupChannelToConversation: vi.fn(),
    setGroupDialogOpen: vi.fn(),
    setGroupDialogPendingIds: vi.fn(),
    setGroupDialogPendingContactIds: vi.fn(),
    setGroupNameDraft: vi.fn(),
    setActiveConversationId: vi.fn(),
    setScreen: vi.fn(),
    setDraft: vi.fn(),
    clearSelection: vi.fn(),
  }
  const js = ts.transpileModule(declaration ?? '', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const createGroup: (ids: string[], title: string) => void = new Function(
    'useCallback', ...Object.keys(scope), js + '\nreturn createGroupFromSelectedConversations;',
  )((callback: unknown) => callback, ...Object.values(scope))

  createGroup(['one', 'ai'], 'Group')
  createGroup(['one', 'two'], '  ')
  expect(scope.bindGroupChannelToConversation).not.toHaveBeenCalled()
  expect(scope.setConversations).not.toHaveBeenCalled()
  createGroup(['two', 'ai', 'one'], '  Group  ')
  const group = scope.setConversations.mock.lastCall![0](conversations)[0]
  expect(group).toMatchObject({
    title: 'Group', groupMemberContactIds: ['alice', 'bob'], groupMemberNames: ['Alice in thread', 'Bob in thread'],
  })
  expect(scope.bindGroupChannelToConversation).toHaveBeenCalledOnce()
  expect(scope.bindGroupChannelToConversation).toHaveBeenCalledWith(group.id, 'Group', ['alice', 'bob'])
  expect(scope.setMessagesById.mock.lastCall![0]({})).toEqual({ [group.id]: [] })
  expect(scope.setActiveConversationId).toHaveBeenCalledWith(group.id)
  expect(scope.setScreen).toHaveBeenCalledWith('thread')
  expect(scope.clearSelection).toHaveBeenCalledOnce()
})

it('samples the Gantt override when paging binds and cancels old frames on rebind', async () => {
  const chart = document.createElement('div')
  Object.defineProperties(chart, {
    scrollWidth: { value: 1000 },
    clientWidth: { value: 250 },
  })
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
    frames.set(++frameId, run)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const props = {
    onTimelinePagingChange: vi.fn(),
    timelineWindowOverride: undefined as { start: Date; end: Date } | undefined,
    ganttWindow: { start: new Date(0), end: new Date(100_000) },
    canExtendForward: true,
    ganttInnerRef: { current: chart },
    bindPagingScrollRef: { current: null as null | (() => void) },
    findGanttChart: () => chart,
    shouldPublishTimelinePaging: () => true,
    startTransition: (run: () => void) => run(),
    TIMELINE_SCROLL_EDGE_THRESHOLD_PX: 12,
  }
  const view = mountEffect<typeof props>(
    planningGantt, 'bindPagingScrollRef.current = bind', `const { ${Object.keys(props).join(', ')} } = props;`,
    'hasPagingWindowOverride',
  )
  try {
    await view.render(props)
    const initialBind = props.bindPagingScrollRef.current
    expect(initialBind).toBeTypeOf('function')
    const overridden = { ...props, timelineWindowOverride: props.ganttWindow }
    await view.render(overridden)
    expect(props.bindPagingScrollRef.current).toBe(initialBind)
    chart.scrollLeft = 750
    chart.dispatchEvent(new Event('scroll'))
    expect(frames.size).toBe(1)
    for (const [id, run] of frames) {
      frames.delete(id)
      run(0)
    }
    expect(props.onTimelinePagingChange.mock.calls).toEqual([[expect.objectContaining({
      viewportStart: new Date(75_000), viewportEnd: new Date(100_000), atRightEdge: true,
    })]])

    chart.dispatchEvent(new Event('scroll'))
    expect(frames.size).toBe(1)
    await view.render({ ...overridden, canExtendForward: false })
    expect(props.bindPagingScrollRef.current).toBeNull()
    chart.dispatchEvent(new Event('scroll'))
    expect(frames.size).toBe(0)
    expect(props.onTimelinePagingChange).toHaveBeenCalledOnce()
  } finally {
    await view.unmount()
  }
})

it('preserves category option precedence and the legacy fallback label formatting', () => {
  const declaration = readNodes(knowledge).statements.get('formatKbCategoryLabel')
  expect(declaration).toBeDefined()
  const source = ts.transpileModule(declaration ?? '', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const format: (value: string, options?: Array<{ value: string; label: string }>) => string = new Function(
    'KB_CATEGORIES', source + '\nreturn formatKbCategoryLabel;',
  )([{ value: 'operations', label: 'Built-in' }])
  expect(format('  operations  ')).toBe('Built-in')
  expect(format('operations', [{ value: 'operations', label: 'Configured' }])).toBe('Configured')
  expect(format('   ')).toBe('')
  expect(format(' risk_management ')).toBe('risk management')
  expect(format('a\bb_\bc\b7\b!\b\u00e9\b\bx\b')).toBe('a\bB \bC\b7\b!\b\u00e9\b\bX\b')
})

it('guards template actions while busy and awaits each upload before starting the next', async () => {
  const { statements } = readNodes(knowledge)
  const declarations = ['runTemplateUploadBatch', 'queueTemplateUploadFiles', 'handleCreateMasterTemplate'].map(name => {
    const statement = statements.get(name)
    expect(statement, name).toBeDefined()
    return statement
  })
  const source = ts.transpileModule(`
    let templateBusy = false
    const setBusy = (value) => { templateBusy = value }
    ${declarations.join('\n')}
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const templateUploadBatchRunningRef = { current: false }
  const resolveRepositoryUploadWorkspaceCandidates = vi.fn(() => ({ mode: 'resolved', workspaceId: 'fixture-workspace' }))
  const setUploadWorkspacePicker = vi.fn()
  const processCreateMasterTemplate = vi.fn()
  let release!: () => void
  const firstDone = new Promise<void>(resolve => { release = resolve })
  const processUploadMasterTemplateFile = vi.fn()
    .mockReturnValueOnce(firstDone)
    .mockResolvedValue(undefined)
  const bindings = {
    useCallback: (callback: unknown) => callback,
    templateUploadBatchRunningRef, resolveRepositoryUploadWorkspaceCandidates, setUploadWorkspacePicker,
    processCreateMasterTemplate, processUploadMasterTemplateFile,
  }
  const api: {
    setBusy: (value: boolean) => void
    queueTemplateUploadFiles: (files: File[]) => void
    handleCreateMasterTemplate: () => Promise<void>
    runTemplateUploadBatch: (files: File[], workspaceId: string) => Promise<void>
  } = new Function(
    ...Object.keys(bindings),
    source + '\nreturn { setBusy, queueTemplateUploadFiles, handleCreateMasterTemplate, runTemplateUploadBatch };',
  )(...Object.values(bindings))
  const files = [new File([], 'one.docx'), new File([], 'two.docx')]
  api.setBusy(true)
  api.queueTemplateUploadFiles(files)
  await api.handleCreateMasterTemplate()
  expect(resolveRepositoryUploadWorkspaceCandidates).not.toHaveBeenCalled()
  expect(processUploadMasterTemplateFile).not.toHaveBeenCalled()
  expect(processCreateMasterTemplate).not.toHaveBeenCalled()
  api.setBusy(false)
  const batch = api.runTemplateUploadBatch(files, 'fixture-workspace')
  expect(processUploadMasterTemplateFile.mock.calls).toEqual([[files[0], 'fixture-workspace', undefined]])
  api.queueTemplateUploadFiles(files)
  expect(resolveRepositoryUploadWorkspaceCandidates).not.toHaveBeenCalled()
  release()
  await batch
  expect(processUploadMasterTemplateFile.mock.calls).toEqual(files.map(file => [file, 'fixture-workspace', undefined]))
  expect(templateUploadBatchRunningRef.current).toBe(false)
  await api.handleCreateMasterTemplate()
  expect(processCreateMasterTemplate.mock.calls).toEqual([['fixture-workspace']])
  expect(setUploadWorkspacePicker).not.toHaveBeenCalled()
})

it('captures Work Item Escape reset when the listener binds, and removes it on close', async () => {
  const calls: string[] = []
  const props = {
    workItemAddOpen: false,
    workItemAddSaving: false,
    filterOptions: { projects: ['Project A'] },
    workspacePickerGroups: { tectona: ['Workspace A'], monday: [] },
    setWorkItemAddOpen: vi.fn((open: boolean) => calls.push(`open:${open}`)),
    resetWorkItemAddForm: () => { calls.push('first reset') },
  }
  const view = mountEffect<typeof props>(
    taskWork, "if (event.key !== 'Escape' || workItemAddSaving) return",
    `const { ${Object.keys(props).join(', ')} } = props;`, 'captureWorkItemEscapeReset',
  )
  const key = (value: string) => act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: value }))
  })
  try {
    await view.render(props)
    await key('Escape')
    const opened = { ...props, workItemAddOpen: true }
    await view.render(opened)
    const updated = { ...opened, resetWorkItemAddForm: () => { calls.push('latest reset') } }
    await view.render(updated)
    await key('Enter')
    expect(calls).toEqual([])
    await key('Escape')
    expect(calls.splice(0)).toEqual(['open:false', 'first reset'])
    const changedScope = { ...updated, workspacePickerGroups: { tectona: ['Workspace B'], monday: [] } }
    await view.render(changedScope)
    await key('Escape')
    expect(calls.splice(0)).toEqual(['open:false', 'latest reset'])
    const saving = { ...changedScope, workItemAddSaving: true }
    await view.render(saving)
    await key('Escape')
    await view.render({ ...saving, workItemAddOpen: false, workItemAddSaving: false })
    await key('Escape')
    expect(calls).toEqual([])
  } finally {
    await view.unmount()
  }
  await key('Escape')
  expect(calls).toEqual([])
})

it('clears only the requested AI folder label and keeps missing-key updates as no-ops', () => {
  const original = Object.freeze({ first: 'Original', second: 'Keep' })
  let labels: Record<string, string> = original
  const setLabels = vi.fn((update: (previous: Record<string, string>) => Record<string, string>) => {
    labels = update(labels)
  })
  const { statements } = readNodes(chat)
  const declaration = statements.get('renameAiFolder')
  expect(declaration).toBeDefined()
  const source = ts.transpileModule(declaration ?? '', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const rename: (key: string, label: string) => void = new Function(
    'useCallback', 'setAiFolderLabelByKey', source + '\nreturn renameAiFolder;',
  )((callback: unknown) => callback, setLabels)

  rename('  ', 'Ignored')
  expect(setLabels).not.toHaveBeenCalled()
  rename('missing', '')
  expect(labels).toBe(original)
  rename(' first ', ' New label ')
  expect(labels).toEqual({ first: 'New label', second: 'Keep' })
  rename('first', ' ')
  expect(labels).toEqual({ second: 'Keep' })
  expect(original).toEqual({ first: 'Original', second: 'Keep' })
})

it('remeasures the brainstorming composer only for the existing layout triggers', async () => {
  const composer = document.createElement('textarea')
  const props = {
    brainstormComposerRef: { current: composer as HTMLTextAreaElement | null },
    isBrainstormMode: false,
    brainstormInput: '',
    isEvidenceDialogOpen: false,
    isMobileLayout: false,
    resizeBrainstormComposer: vi.fn(),
    unrelated: false,
  }
  const view = mountEffect<typeof props>(
    backlog, /syncBrainstormComposerHeight\(\)|resizeBrainstormComposer\(el, isMobileLayout\)/,
    `const { ${Object.keys(props).join(', ')} } = props;`, 'syncBrainstormComposerHeight', 'useLayoutEffect',
  )
  try {
    await view.render(props)
    expect(props.resizeBrainstormComposer).not.toHaveBeenCalled()
    const active = { ...props, isBrainstormMode: true }
    await view.render(active)
    await view.render({ ...active, unrelated: true })
    expect(props.resizeBrainstormComposer.mock.calls).toEqual([[composer, false]])
    const typed = { ...active, brainstormInput: 'text' }
    await view.render(typed)
    const evidenceOpen = { ...typed, isEvidenceDialogOpen: true }
    await view.render(evidenceOpen)
    await view.render({ ...evidenceOpen, isMobileLayout: true })
    await view.render({ ...evidenceOpen, isMobileLayout: true, brainstormInput: 'next', brainstormComposerRef: { current: null } })
    expect(props.resizeBrainstormComposer.mock.calls).toEqual([
      [composer, false], [composer, false], [composer, false], [composer, true],
    ])
  } finally {
    await view.unmount()
  }
})

it('preserves the archive and deferred chat-lock navigation and reset order', async () => {
  const { statements } = readNodes(chat)
  const names = ['exitMessageSelection', 'goHome', 'archiveConversation', 'requestLockChat']
  const declarations = names.map((name) => {
    const declaration = statements.get(name)
    expect(declaration, name).toBeDefined()
    return declaration
  })
  const source = ts.transpileModule(`
    const harness = (props) => {
      const { activeConversationId, conversations, setConversations, enableChatLock,
        setScreen, setActiveConversationId, setDraft, setMessageSearchConversationId,
        setMessageSearchQuery, setMessageSelectionActive, setSelectedMessageIds,
        openChatLockPanel } = props
      const hasChatLockPassword = Boolean
      ${declarations.join('\n')}
      props.capture({ archiveConversation, requestLockChat })
      return null
    }
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const fixture = {
    conversations: [
      { id: 'one', channelId: 'channel-one', mode: 'team', hasChatLockPassword: true },
      { id: 'two', channelId: 'channel-two', mode: 'team', hasChatLockPassword: true },
    ],
    setConversations: vi.fn(),
    enableChatLock: vi.fn<(id: string) => Promise<{ is_chat_locked: boolean }>>(),
    openChatLockPanel: vi.fn(),
    capture: vi.fn<(handlers: { archiveConversation: (id: string) => void; requestLockChat: (id: string) => void }) => void>(),
  }
  const calls: unknown[][] = []
  const record = (name: string) => (value: unknown) => calls.push([name, value])
  const props = {
    ...fixture,
    activeConversationId: 'one',
    setScreen: record('screen'),
    setActiveConversationId: record('conversation'),
    setDraft: record('draft'),
    setMessageSearchConversationId: record('search conversation'),
    setMessageSearchQuery: record('search query'),
    setMessageSelectionActive: record('selection'),
    setSelectedMessageIds: record('selected ids'),
  }
  const reset = [
    ['screen', 'home'], ['conversation', null], ['draft', ''],
    ['search conversation', null], ['search query', ''], ['selection', false], ['selected ids', new Set()],
  ]
  const Harness: (input: typeof props) => null = new Function('useCallback', source + '\nreturn harness;')(useCallback)
  const root = createRoot(document.createElement('div'))
  const render = (activeConversationId: string) => act(async () => {
    root.render(createElement(Harness, { ...props, activeConversationId }))
  })
  const handlers = () => fixture.capture.mock.lastCall![0]
  try {
    await render('one')
    handlers().archiveConversation('two')
    expect(calls).toEqual([])
    expect(fixture.setConversations.mock.lastCall?.[0](fixture.conversations)[1]).toMatchObject({ archived: true, unreadCount: 0 })
    handlers().archiveConversation('one')
    expect(calls.splice(0)).toEqual(reset)

    let release!: (value: { is_chat_locked: boolean }) => void
    fixture.enableChatLock.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    handlers().requestLockChat('one')
    expect(fixture.enableChatLock).toHaveBeenCalledWith('channel-one')
    expect(calls).toEqual([])
    await render('two')
    await act(async () => release({ is_chat_locked: true }))
    expect(calls.splice(0)).toEqual(reset)
    expect(fixture.setConversations.mock.lastCall?.[0](fixture.conversations)[0]).toMatchObject({ isLocked: true })

    fixture.enableChatLock.mockResolvedValueOnce({ is_chat_locked: true })
    await act(async () => handlers().requestLockChat('one'))
    expect(calls).toEqual([])
    expect(fixture.enableChatLock).toHaveBeenCalledTimes(2)
    expect(fixture.openChatLockPanel).not.toHaveBeenCalled()
  } finally {
    await act(async () => root.unmount())
  }
})

it('checks the current chat after a pending delete and does not close a different chat', async () => {
  const declaration = readNodes(chat).statements.get('deleteConversation')
  expect(declaration).toBeDefined()
  const source = ts.transpileModule(declaration ?? '', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const target = { id: 'one', mode: 'team', title: 'One' }
  let conversations = [target, { id: 'two', mode: 'team', title: 'Two' }]
  const activeConversationIdRef = { current: 'one' }
  const deletingConversationsRef = { current: new Set<string>() }
  const goHome = vi.fn()
  const notifyChatDeletion = vi.fn()
  const addHiddenFromConversation = vi.fn()
  const setHiddenChatRevision = vi.fn()
  let release!: () => void
  const deleteSavedChatSession = vi.fn(() => new Promise<void>(resolve => { release = resolve }))
  const bindings = {
    useCallback: (callback: unknown) => callback,
    activeConversationId: 'one',
    activeConversationIdRef, conversations, conversationsRef: { current: conversations },
    deletingConversationsRef, goHome, notifyChatDeletion, addHiddenFromConversation,
    setHiddenChatRevision, deleteSavedChatSession,
    setConversations: (update: (previous: typeof conversations) => typeof conversations) => { conversations = update(conversations) },
    setMessagesById: vi.fn(), setBrainstormSessionError: vi.fn(),
  }
  const remove: (id: string, announce?: boolean) => Promise<boolean | null> = new Function(
    ...Object.keys(bindings), source + '\nreturn deleteConversation;',
  )(...Object.values(bindings))

  const pending = remove('one')
  expect(deleteSavedChatSession.mock.calls).toEqual([[target]])
  await expect(remove('one')).resolves.toBeNull()
  expect(conversations).toHaveLength(2)
  activeConversationIdRef.current = 'two'
  release()
  await expect(pending).resolves.toBe(true)
  expect(goHome).not.toHaveBeenCalled()
  expect(addHiddenFromConversation.mock.calls).toEqual([[target]])
  expect(setHiddenChatRevision).toHaveBeenCalledTimes(1)
  expect(conversations.map(row => row.id)).toEqual(['two'])
  expect(notifyChatDeletion.mock.calls).toEqual([[{ deleted: 1, localOnly: true, title: 'One' }]])
  expect(deletingConversationsRef.current.size).toBe(0)

  const current = remove('two', false)
  release()
  await expect(current).resolves.toBe(true)
  expect(goHome).toHaveBeenCalledTimes(1)
  expect(notifyChatDeletion).toHaveBeenCalledTimes(1)
})

const advanceChatTimers = (ms: number) => act(async () => { vi.advanceTimersByTime(ms) })
const chatMarkdown = ({ content }: { content: string }) => createElement('article', null, content)

it('shows the floating date after a frame and delay, replaces its hide timer, and cancels stale work', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  const props = {
    scrollRef: { current: document.createElement('div') },
    messages: [{ date: 'First' }],
    conversationKey: 'first' as string | null,
    onThreadScroll: vi.fn(),
  }
  const resolveLabel = vi.fn((_root: HTMLElement, messages: typeof props.messages) => messages.at(-1)?.date ?? null)
  const view = mountControl<typeof props>(chat, 'useChatThreadFloatingDate', {
    CHAT_FLOATING_DATE_HIDE_MS: 2600, resolveChatThreadFloatingDateLabel: resolveLabel,
  }, [], `function Harness(props) {
    const date = useChatThreadFloatingDate(props)
    return <button aria-hidden={!date.visible} onClick={date.handleScroll}>{date.label}</button>
  }`)
  const button = () => view.host.querySelector('button')!
  try {
    await view.render(props)
    await advanceChatTimers(16)
    await advanceChatTimers(119)
    expect(button().getAttribute('aria-hidden')).toBe('true')
    expect(resolveLabel).not.toHaveBeenCalled()
    await advanceChatTimers(1)
    expect(button().textContent).toBe('First')
    expect(button().getAttribute('aria-hidden')).toBe('false')
    await advanceChatTimers(1000)
    await act(async () => button().click())
    expect(props.onThreadScroll).toHaveBeenCalledOnce()
    await advanceChatTimers(2599)
    expect(button().getAttribute('aria-hidden')).toBe('false')
    await advanceChatTimers(1)
    expect(button().getAttribute('aria-hidden')).toBe('true')

    await act(async () => button().click())
    await view.render({ ...props, conversationKey: 'stale', messages: [{ date: 'Stale' }] })
    await advanceChatTimers(16)
    await view.render({ ...props, conversationKey: null, messages: [] })
    await advanceChatTimers(120)
    expect(button().textContent).toBe('First')
    expect(button().getAttribute('aria-hidden')).toBe('true')
    expect(resolveLabel.mock.calls.map(([, messages]) => messages[0]?.date)).not.toContain('Stale')

    await view.render({ ...props, conversationKey: 'latest', messages: [{ date: 'Latest' }] })
    await advanceChatTimers(16)
    await advanceChatTimers(120)
    expect(button().textContent).toBe('Latest')
    expect(button().getAttribute('aria-hidden')).toBe('false')
    await view.render({ ...props, conversationKey: 'unmount', messages: [{ date: 'Unmount' }] })
    expect(vi.getTimerCount()).toBe(2)
  } finally {
    await view.unmount()
  }
  expect(vi.getTimerCount()).toBe(0)
})

it('retains the scheduled character callback and handles empty and instant replacements in the DOM', async () => {
  vi.useFakeTimers()
  const firstProgress = vi.fn()
  const secondProgress = vi.fn()
  const complete = vi.fn()
  const nextComplete = vi.fn()
  const props = {
    text: 'abc', messageId: 'first', speed: 'fast', onTypingProgress: firstProgress, onTypingComplete: complete,
    renderMarkdown: true,
  }
  const view = mountControl<typeof props>(chat, 'AssistantTypewriterText', { AssistantChatMarkdown: chatMarkdown })
  try {
    await view.render(props)
    expect(view.host.textContent).toBe('')
    await advanceChatTimers(266)
    expect(view.host.textContent).toBe('a')
    await view.render({ ...props, onTypingProgress: secondProgress, onTypingComplete: nextComplete })
    await advanceChatTimers(266)
    expect(view.host.textContent).toBe('ab')
    expect(firstProgress).toHaveBeenCalledTimes(2)
    expect(secondProgress).not.toHaveBeenCalled()
    await view.render({ ...props, messageId: 'empty', text: '' })
    expect(view.host.textContent).toBe('')
    expect(vi.getTimerCount()).toBe(0)
    await view.render({ ...props, messageId: 'second', text: 'new\nline', speed: 'instant', onTypingComplete: nextComplete })
    expect(view.host.querySelector('article')?.textContent).toBe('new\nline')
    expect(nextComplete.mock.calls).toEqual([['second']])
    expect(complete).not.toHaveBeenCalled()
    await view.render({ ...props, messageId: 'second', text: 'new\nline', speed: 'instant', onTypingProgress: secondProgress })
    expect(complete).not.toHaveBeenCalled()
    await advanceChatTimers(266)
    expect(firstProgress).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    await view.unmount()
  }
})

it('restarts line progress with its current callback and cancels superseded lines and unmounted characters', async () => {
  vi.useFakeTimers()
  const progress = vi.fn()
  const updatedProgress = vi.fn()
  const complete = vi.fn()
  const props = {
    text: 'a\nb', messageId: 'first', speed: 'fast', onTypingProgress: progress,
    onTypingComplete: complete, renderMarkdown: true,
  }
  const view = mountControl<typeof props>(chat, 'AssistantTypewriterText', { AssistantChatMarkdown: chatMarkdown })
  const opacity = () => Array.from(view.host.querySelectorAll('span')).map(span => span.style.opacity)
  try {
    await view.render(props)
    await advanceChatTimers(798)
    expect(opacity()).toEqual(['0', '0'])
    await advanceChatTimers(55)
    expect(opacity()).toEqual(['1', '0'])
    await view.render({ ...props, onTypingProgress: updatedProgress })
    expect(opacity()).toEqual(['0', '0'])
    await advanceChatTimers(55)
    expect(opacity()).toEqual(['1', '0'])
    expect(updatedProgress).toHaveBeenCalledOnce()
    await view.render({ ...props, messageId: 'replacement', text: 'x\ny' })
    expect(view.host.textContent).toBe('')
    await advanceChatTimers(798)
    expect(opacity()).toEqual(['0', '0'])
    await advanceChatTimers(55)
    expect(complete).not.toHaveBeenCalled()
    await advanceChatTimers(55)
    expect(view.host.querySelector('article')?.textContent).toBe('x\ny')
    expect(complete.mock.calls).toEqual([['replacement']])
    await advanceChatTimers(300)
    expect(complete).toHaveBeenCalledOnce()
    expect(updatedProgress).toHaveBeenCalledOnce()
    await view.render({ ...props, messageId: 'unmount', text: 'pending' })
    expect(vi.getTimerCount()).toBe(1)
  } finally {
    await view.unmount()
  }
  await advanceChatTimers(1600)
  expect(complete.mock.calls).toEqual([['replacement']])
  expect(vi.getTimerCount()).toBe(0)
})

it('does not finish a replacement message early when its text matches a completed message', async () => {
  vi.useFakeTimers()
  const complete = vi.fn()
  const props = { text: 'abc', messageId: 'first', speed: 'fast', onTypingComplete: complete }
  const view = mountControl<typeof props>(chat, 'AssistantTypewriterText', {})
  try {
    await view.render(props)
    await advanceChatTimers(798)
    expect(complete.mock.calls).toEqual([['first']])
    await view.render({ ...props, messageId: 'second' })
    expect(view.host.textContent).toBe('')
    expect(complete.mock.calls).toEqual([['first']])
    await advanceChatTimers(798)
    expect(complete.mock.calls).toEqual([['first'], ['second']])
  } finally {
    await view.unmount()
  }
})

it('gates bubble evidence on the active message and preserves the instant and streamed paths', async () => {
  vi.useFakeTimers()
  const complete = vi.fn()
  const props = {
    m: { id: 'first', role: 'assistant', text: 'a', evidence: [{}], streamedLive: false },
    currentUserId: 'fixture', chatContacts: [], variant: 'genai',
    assistantTypingSpeed: 'fast', assistantSpeedProfile: 'normal',
    onAssistantTypingComplete: complete,
  }
  const view = mountControl<typeof props>(chat, 'WhatsAppChatBubble', {
    AssistantChatMarkdown: chatMarkdown, WhatsAppMetaRow: () => null,
    formatWhatsAppTime: () => '', AssistantEvidenceFootnotes: () => createElement('aside', null, 'Evidence'),
  }, ['AssistantTypewriterText'])
  try {
    await view.render(props)
    expect(view.host.querySelector('aside')).toBeNull()
    await advanceChatTimers(800)
    expect(view.host.querySelector('aside')?.textContent).toBe('Evidence')
    expect(complete.mock.calls).toEqual([['first']])
    await view.render({ ...props, m: { ...props.m, id: 'second', text: 'b' } })
    expect(view.host.querySelector('aside')).toBeNull()
    await view.render({ ...props, assistantTypingSpeed: 'instant', m: { ...props.m, id: 'third', text: 'c' } })
    expect(view.host.querySelector('aside')?.textContent).toBe('Evidence')
    expect(complete.mock.calls).toEqual([['first'], ['third']])
    await view.render({ ...props, m: { ...props.m, id: 'streamed', streamedLive: true } })
    expect(view.host.querySelector('aside')?.textContent).toBe('Evidence')
    await advanceChatTimers(1600)
    expect(complete.mock.calls).toEqual([['first'], ['third']])
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    await view.unmount()
  }
})

it('initializes KB editor HTML only on open or a new editor seed, never on ordinary content updates', async () => {
  const editor = document.createElement('div')
  const props = {
    kbAddOpen: false, kbEditorOpenSeed: 1, kbFormContent: '<p>first</p>', kbContentEditorRef: { current: editor },
    applyKbTableLayoutStylesFromAttrs: vi.fn((content: string) => content),
    setKbEditorTableScanTick: vi.fn(),
  }
  const view = mountEffect<typeof props>(
    knowledge, 'editor.innerHTML = applyKbTableLayoutStylesFromAttrs', `const { ${Object.keys(props).join(', ')} } = props;`, 'readKbEditorOpeningContent',
  )
  try {
    await view.render(props)
    expect(props.applyKbTableLayoutStylesFromAttrs).not.toHaveBeenCalled()
    await view.render({ ...props, kbAddOpen: true })
    expect(editor.innerHTML).toBe('<p>first</p>')
    editor.innerHTML = '<p>unsaved</p>'
    await view.render({ ...props, kbAddOpen: true, kbFormContent: '<p>form echo</p>' })
    expect(editor.innerHTML).toBe('<p>unsaved</p>')
    await view.render({ ...props, kbAddOpen: true, kbEditorOpenSeed: 2, kbFormContent: '<p>new seed</p>' })
    expect(editor.innerHTML).toBe('<p>new seed</p>')
    expect(props.applyKbTableLayoutStylesFromAttrs.mock.calls).toEqual([['<p>first</p>'], ['<p>new seed</p>']])
    expect(props.setKbEditorTableScanTick).toHaveBeenCalledTimes(2)
  } finally {
    await view.unmount()
  }
})

it('resets the detail tab on entry ID changes, not on same-ID metadata changes', async () => {
  const setKbDetailTab = vi.fn()
  type Entry = { id: string; title: string }
  const view = mountEffect<{ kbViewEntry: Entry | null; setKbDetailTab: typeof setKbDetailTab }>(
    knowledge, /\}, \[kbViewEntry(?:\?\.id|Id)\]\)/,
    'const { kbViewEntry, setKbDetailTab } = props; const kbViewEntryId = kbViewEntry?.id;',
  )
  const a = { id: 'a', title: 'First' }
  try {
    await view.render({ kbViewEntry: null, setKbDetailTab })
    expect(setKbDetailTab).not.toHaveBeenCalled()
    await view.render({ kbViewEntry: a, setKbDetailTab })
    await view.render({ kbViewEntry: { ...a, title: 'Renamed' }, setKbDetailTab })
    expect(setKbDetailTab.mock.calls).toEqual([['detail']])
    await view.render({ kbViewEntry: { ...a, id: 'b' }, setKbDetailTab })
    await view.render({ kbViewEntry: null, setKbDetailTab })
    expect(setKbDetailTab.mock.calls).toEqual([['detail'], ['detail']])
  } finally {
    await view.unmount()
  }
})

it('keeps Move Idea folder refresh scoped to idea ID, workspace and explicit retry', async () => {
  type Folder = { workspace_id: string; id: string }
  type Target = { id: string; workspace: string; title: string }
  const resolves: ((rows: Folder[]) => void)[] = []
  const fetchAllIdeaFolders = vi.fn<(query: { workspace_id: string; owner_id: string }) => Promise<Folder[]>>(
    () => new Promise((resolve) => { resolves.push(resolve) }),
  )
  const props = {
    moveIdeaTarget: null as Target | null, moveFoldersReloadKey: 0, fetchAllIdeaFolders,
    setMoveIdeaFolders: vi.fn(), setMoveFoldersLoading: vi.fn(), setMoveFoldersError: vi.fn(),
    LEGACY_DUMMY_OWNER_ID: 'mock-owner',
  }
  const view = mountEffect<typeof props>(
    backlog, 'setMoveIdeaFolders(rows.filter(', `
      const { ${Object.keys(props).join(', ')} } = props;
      const moveIdeaTargetId = moveIdeaTarget?.id;
      const moveIdeaWorkspaceId = moveIdeaTarget?.workspace;
    `,
  )
  const first = { id: 'idea-1', workspace: 'ws-1', title: 'Original' }
  const current = { workspace_id: 'ws-2', id: 'folder-2' }
  try {
    await view.render(props)
    expect(fetchAllIdeaFolders).not.toHaveBeenCalled()
    await view.render({ ...props, moveIdeaTarget: first })
    await view.render({ ...props, moveIdeaTarget: { ...first, title: 'Renamed' } })
    expect(fetchAllIdeaFolders.mock.calls).toEqual([[{ workspace_id: 'ws-1', owner_id: 'mock-owner' }]])
    const moved = { ...first, workspace: 'ws-2' }
    await view.render({ ...props, moveIdeaTarget: moved })
    await view.render({ ...props, moveIdeaTarget: moved, moveFoldersReloadKey: 1 })
    await view.render({ ...props, moveIdeaTarget: { ...moved, id: 'idea-2' }, moveFoldersReloadKey: 1 })
    expect(fetchAllIdeaFolders.mock.calls).toEqual([
      [{ workspace_id: 'ws-1', owner_id: 'mock-owner' }],
      ...Array.from({ length: 3 }, () => [{ workspace_id: 'ws-2', owner_id: 'mock-owner' }]),
    ])
    await act(async () => resolves[3]([current, { workspace_id: 'ws-1', id: 'not-in-scope' }]))
    await act(async () => { resolves.slice(0, 3).forEach((resolve) => resolve([])) })
    expect(props.setMoveIdeaFolders.mock.calls).toEqual([[[]], [[]], [[]], [[]], [[current]]])
    expect(props.setMoveFoldersLoading.mock.calls).toEqual([[true], [true], [true], [true], [false]])
    await view.render({ ...props, moveIdeaTarget: { ...moved, workspace: '' } })
    expect(fetchAllIdeaFolders).toHaveBeenCalledTimes(4)
    expect(props.setMoveFoldersError).toHaveBeenLastCalledWith('This idea has no workspace. Refresh the idea before choosing a destination.')
  } finally {
    await view.unmount()
  }
})

it('preserves case and first occurrence while enforcing the Create Idea tag limits', () => {
  const { statements } = readNodes(backlog)
  const names = ['MAX_CREATE_IDEA_TAGS', 'MAX_CREATE_IDEA_TAG_LENGTH', 'normalizeIdeaTag', 'dedupeIdeaTags', 'parseIdeaTagsFromText', 'mergeCreateIdeaTags']
  const code = names.map((name) => {
    const statement = statements.get(name)
    expect(statement).toBeDefined()
    return statement
  }).join('\n')
  const merge = new Function(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nreturn mergeCreateIdeaTags;')()
  expect(merge([' Existing  Tag ', 'QA'], 'existing tag,qa, Release,   Road   Map , Last, Extra, ' + 'x'.repeat(25))).toEqual({
    tags: ['Existing Tag', 'QA', 'Release', 'Road Map', 'Last'], rejectedByLength: 1, droppedByMax: 1,
  })
})

it('keeps KB Escape precedence and the close callback from the listener installation', async () => {
  const props = {
    kbAddOpen: true, kbSaving: false, kbCategoryOptions: [], kbManageCatOpen: false,
    kbEditorTableMenu: null as object | null, kbAddFullscreen: false,
    closeKbAddDrawer: vi.fn(), setKbAddFullscreen: vi.fn(),
  }
  const view = mountEffect<typeof props>(
    knowledge, 'dismiss the inner overlay first', `const { ${Object.keys(props).join(', ')} } = props;`, 'captureKbDrawerClose',
  )
  const escape = async () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    await act(async () => { window.dispatchEvent(event) })
    return event.defaultPrevented
  }
  const nextClose = vi.fn()
  try {
    await view.render(props)
    await view.render({ ...props, closeKbAddDrawer: nextClose })
    expect(await escape()).toBe(false)
    expect(props.closeKbAddDrawer).toHaveBeenCalledTimes(1)
    expect(nextClose).not.toHaveBeenCalled()
    await view.render({ ...props, kbEditorTableMenu: {}, kbAddFullscreen: true, closeKbAddDrawer: nextClose })
    expect(await escape()).toBe(false)
    expect(props.setKbAddFullscreen).not.toHaveBeenCalled()
    await view.render({ ...props, kbAddFullscreen: true, closeKbAddDrawer: nextClose })
    expect(await escape()).toBe(true)
    expect(props.setKbAddFullscreen.mock.calls).toEqual([[false]])
    expect(nextClose).not.toHaveBeenCalled()
    await view.render({ ...props, kbAddOpen: false, closeKbAddDrawer: nextClose })
    await escape()
    expect(nextClose).not.toHaveBeenCalled()
    expect(props.closeKbAddDrawer).toHaveBeenCalledTimes(1)
  } finally {
    await view.unmount()
  }
})

it('keeps the pending linked-document request and opens in order with its original preview closer', async () => {
  let resolve!: () => void
  const pending = new Promise<void>((done) => { resolve = done })
  const order: string[] = []
  const props = {
    searchParams: new URLSearchParams('documentId=doc-a'), repositoryItems: [] as { id: string }[],
    getDocument: vi.fn<(id: string) => Promise<void>>(() => pending),
    setActivePanel: (panel: string) => { order.push(panel) },
    closeRepositoryDocumentPreview: () => { order.push('close original') },
    setSelectedDetailId: (id: string) => { order.push(id) },
    setDocDetailTab: (tab: string) => { order.push(tab) },
    setDetailDrawerOpen: (open: boolean) => { order.push(String(open)) },
    addToast: vi.fn(), setSearchParams: vi.fn(),
  }
  const view = mountEffect<typeof props>(
    knowledge, 'The linked document could not be loaded.', `const { ${Object.keys(props).join(', ')} } = props;`, 'captureRepositoryPreviewClose',
  )
  const replacement = vi.fn()
  try {
    await view.render(props)
    await view.render({ ...props, closeRepositoryDocumentPreview: replacement })
    expect(props.getDocument.mock.calls).toEqual([['doc-a']])
    expect(order).toEqual([])
    await act(async () => resolve())
    expect(order).toEqual(['repository', 'close original', 'doc-a', 'detail', 'true'])
    expect(replacement).not.toHaveBeenCalled()
    expect(props.addToast).not.toHaveBeenCalled()
  } finally {
    await view.unmount()
  }
})

it('keeps diagram pending scope, debounce and cancellation of an in-flight snapshot', async () => {
  vi.useFakeTimers()
  let finishSnapshot!: (image: string) => void
  const snapshot = new Promise<string>((resolve) => { finishSnapshot = resolve })
  const pending = vi.fn<(event: Event) => void>()
  window.addEventListener('tectona-diagram-content-pending', pending)
  const props = {
    editable: true, editedBeforeSavedGraph: false, savedGraphConflict: false, storageKey: 'idea-a:diagram-a', ideaId: 'idea-a', diagramKey: 'diagram-a',
    nodes: [] as string[], edges: [], sourceDraft: 'initial', snapToGrid: false,
    viewportRef: { current: { x: 1, y: 2, zoom: 1 } }, reactFlowWrapperRef: { current: null },
    saveGraph: vi.fn(), skipPersistRef: { current: true }, persistTimerRef: { current: null as number | null },
    onPersistGraphRef: { current: vi.fn() },
    canvasDocumentSnapshot: vi.fn().mockReturnValueOnce(snapshot).mockResolvedValueOnce('final image'),
  }
  const view = mountEffect<typeof props>(
    diagram, 'tectona-diagram-content-pending', `const { ${Object.keys(props).join(', ')} } = props;`, 'captureDiagramPendingScope',
  )
  const advance = (ms: number) => act(async () => { vi.advanceTimersByTime(ms) })
  try {
    await view.render(props)
    expect(pending).not.toHaveBeenCalled()
    expect(props.saveGraph).toHaveBeenCalledTimes(1)
    await view.render({ ...props, sourceDraft: 'first edit' })
    await advance(699)
    expect(props.canvasDocumentSnapshot).not.toHaveBeenCalled()
    await advance(1)
    expect(props.canvasDocumentSnapshot).toHaveBeenCalledTimes(1)
    await view.render({ ...props, sourceDraft: 'second edit' })
    await act(async () => finishSnapshot('obsolete image'))
    expect(props.onPersistGraphRef.current).not.toHaveBeenCalled()
    await advance(700)
    expect(props.onPersistGraphRef.current.mock.calls).toEqual([[
      { nodes: [], edges: [], source: 'second edit', viewport: props.viewportRef.current, snapToGrid: false, canvasPngBase64: 'final image' },
    ]])
    expect(pending.mock.calls.map(([event]) => (event as CustomEvent).detail)).toEqual([
      { ideaId: 'idea-a', diagramKey: 'diagram-a' }, { ideaId: 'idea-a', diagramKey: 'diagram-a' },
    ])
    await view.render({ ...props, sourceDraft: 'unmounted' })
    await view.unmount()
    await advance(700)
    expect(props.canvasDocumentSnapshot).toHaveBeenCalledTimes(2)
  } finally {
    await view.unmount()
    window.removeEventListener('tectona-diagram-content-pending', pending)
  }
})
