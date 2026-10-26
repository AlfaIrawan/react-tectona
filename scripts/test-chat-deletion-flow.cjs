const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

// Exercise the actual sidebar callbacks without mounting its unrelated realtime clients.
const source = ts.createSourceFile('ChatSidebarPanel.tsx', fs.readFileSync('src/modules/core-shell/components/ChatSidebarPanel.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const callbacks = new Map()
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ['deleteConversation', 'bulkDelete', 'deleteSelectedThreadMessages'].includes(node.name.text)) callbacks.set(node.name.text, node.initializer.arguments[0].getText(source))
  ts.forEachChild(node, visit)
}
visit(source)
function load(name, context) {
  assert.ok(callbacks.has(name), name + ' must remain covered')
  const js = ts.transpileModule('(' + callbacks.get(name) + ')', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  return vm.runInNewContext(js, context)
}
function harness(rows) {
  const feedback = [], hidden = [], tombstones = [], pointers = []
  const context = {
    conversations: rows, conversationsRef: { current: rows }, messages: Object.fromEntries(rows.map(row => [row.id, [{ id: 'message-' + row.id }]])),
    activeConversationId: rows[0]?.id, activeConversationIdRef: { current: rows[0]?.id }, deletingConversationsRef: { current: new Set() }, genaiHydratedRef: { current: new Set(rows.map(row => row.id)) },
    deleteSavedChatSession: async () => {}, notifyChatDeletion: event => feedback.push(JSON.parse(JSON.stringify(event))),
    useIdeaDraftBrainstormPointerStore: { getState: () => ({ clearPointer: id => pointers.push(id) }) },
    rememberDeletedGenAiSessionIds: ids => tombstones.push(...ids), addHiddenFromConversation: row => hidden.push(row.id),
    setHiddenChatRevision: () => {}, setBrainstormSessionError: error => { context.error = error },
    setConversations: update => { context.conversations = update(context.conversations); context.conversationsRef.current = context.conversations },
    setMessagesById: update => { context.messages = update(context.messages); context.messagesByIdRef.current = context.messages },
    goHome: () => { context.home = (context.home || 0) + 1; context.activeConversationIdRef.current = null },
    clearSelection: () => { context.selectionCleared = true }, exitMessageSelection: () => { context.selectionExited = true },
    channelConversationId: id => 'channel-' + id,
  }
  context.messagesByIdRef = { current: context.messages }
  context.deleteConversation = load('deleteConversation', context)
  return { context, feedback, hidden, tombstones, pointers }
}

async function main() {
  const single = harness([{ id: 'ai', mode: 'genai', title: 'AI chat' }])
  let release
  let calls = 0
  single.context.deleteSavedChatSession = async () => { calls++; await new Promise(resolve => { release = resolve }) }
  const pending = single.context.deleteConversation('ai')
  assert.equal(single.context.conversations.length, 1, 'wait for server before removing the row')
  assert.equal(single.feedback.length, 0)
  assert.equal(await single.context.deleteConversation('ai'), null, 'duplicate clicks do not issue another delete')
  assert.equal(calls, 1)
  single.context.activeConversationIdRef.current = 'different-chat'
  release()
  assert.equal(await pending, true)
  assert.equal(single.context.home, undefined, 'late completion does not close a newly opened chat')
  assert.deepEqual(single.tombstones, ['ai'])
  assert.equal(single.feedback.length, 1)

  const failure = harness([{ id: 'draft', mode: 'genai', isBrainstormPointer: true, brainstormJobId: 'job', title: 'Draft' }])
  failure.context.deleteSavedChatSession = async () => { throw new Error('offline') }
  assert.equal(await failure.context.deleteConversation('draft'), false)
  assert.equal(failure.context.conversations.length, 1)
  assert.ok(failure.context.messages.draft)
  assert.equal(failure.pointers.length, 0)
  assert.equal(failure.tombstones.length, 0)
  assert.deepEqual(failure.feedback, [{ deleted: 0, failed: 1 }])

  const bulk = harness([{ id: 'draft', mode: 'genai', isBrainstormPointer: true, brainstormJobId: 'job', title: 'Draft' }, { id: 'team', mode: 'team', title: 'Team' }, { id: 'ai', mode: 'genai', title: 'AI' }])
  bulk.context.deleteSavedChatSession = async row => { if (row.id === 'ai') throw new Error('offline') }
  await load('bulkDelete', bulk.context)(['draft', 'draft', 'team', 'ai', 'stale'])
  assert.deepEqual(bulk.feedback, [{ deleted: 2, failed: 1, localDeleted: 1 }], 'one aggregate result for partial bulk deletion')
  assert.deepEqual(bulk.pointers, ['job'])
  assert.deepEqual(bulk.hidden, ['team'])
  assert.equal(bulk.context.conversations[0].id, 'ai')
  assert.equal(bulk.context.conversations.length, 1)
  assert.ok(bulk.context.messages.ai, 'failed conversation keeps its messages')

  const messages = harness([{ id: 'team', mode: 'team', title: 'Team', channelId: 'one' }])
  messages.context.messages = { team: [{ id: 'a' }, { id: 'b' }, { id: 'keep' }], 'channel-one': [{ id: 'a' }, { id: 'b' }] }
  messages.context.messagesByIdRef.current = messages.context.messages
  messages.context.selectedMessageIds = new Set(['a', 'b', 'stale'])
  load('deleteSelectedThreadMessages', messages.context)()
  assert.deepEqual(messages.feedback, [{ deleted: 2, messagesOnly: true }], 'count actual messages once across aliases')
  assert.equal(messages.context.messages.team[0].id, 'keep')
  assert.equal(messages.context.messages['channel-one'].length, 0)
  console.log('PASS actual chat deletion callbacks: server-before-local, duplicate-click guard, failure retention, navigation safety, aggregate bulk feedback and accurate local-message counts')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
