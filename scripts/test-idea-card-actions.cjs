const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(test) {
  let match
  function visit(node) { if (!match && test(node)) match = node; if (!match) ts.forEachChild(node, visit) }
  visit(tree)
  assert.ok(match, 'Expected source node was found')
  return match
}
function callback(name, context) {
  const declaration = find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
  const js = ts.transpileModule('const action = ' + declaration.initializer.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return vm.runInNewContext(js + '\naction', context)
}

async function main() {
  const idea = { id: 'idea', title: 'Existing idea', workspace: 'workspace', folderId: null, version: 7 }
  const calls = [], errors = [], toasts = []
  let target = idea, updatedRows = [idea]
  const context = {
    Error,
    moveIdeaTarget: idea, moveIdeaFolderId: 'folder', isMovingIdea: false,
    moveFoldersLoading: false, moveFoldersError: '',
    moveIdeaFolders: [{ id: 'folder', workspace_id: 'workspace', name: 'Destination' }],
    setMoveIdeaError: message => errors.push(message), setIsMovingIdea: () => {},
    patchIdea: async (...args) => { calls.push(JSON.parse(JSON.stringify(args))); return { ...idea, folderId: args[1].folder_id } },
    setIdeas: update => { updatedRows = update(updatedRows) }, toIdea: value => value,
    addToast: toast => toasts.push(toast), setMoveIdeaTarget: value => { target = value }, setMoveIdeaFolderId: () => {},
  }
  await callback('submitMoveIdea', context)()
  assert.deepEqual(calls, [['idea', { folder_id: 'folder', version: 7 }]])
  assert.equal(target, null)
  assert.equal(updatedRows[0].workspace, 'workspace')
  assert.equal(toasts[0].variant, 'success')

  calls.length = 0
  await callback('submitMoveIdea', { ...context, moveIdeaFolderId: 'foreign', moveIdeaFolders: [{ id: 'foreign', workspace_id: 'other' }] })()
  assert.equal(calls.length, 0)
  assert.match(errors.at(-1), /same workspace/)

  await callback('submitMoveIdea', { ...context, moveIdeaFolderId: 'legacy', moveIdeaFolders: [{ id: 'legacy', name: '2023', workspace_id: null }] })()
  assert.equal(calls.length, 0, 'An unscoped legacy folder is not a destination for a workspace idea')
  await callback('submitMoveIdea', { ...context, moveFoldersLoading: true })()
  await callback('submitMoveIdea', { ...context, moveFoldersError: 'Offline' })()
  assert.equal(calls.length, 0, 'A failed or pending folder lookup cannot use cached destinations')

  target = idea; toasts.length = 0; updatedRows = [idea]
  await callback('submitMoveIdea', { ...context, patchIdea: async () => { throw new Error('Version conflict') } })()
  assert.equal(target, idea)
  assert.equal(updatedRows[0], idea)
  assert.equal(toasts.length, 0)
  assert.match(errors.at(-1), /Version conflict/)

  await callback('submitMoveIdea', { ...context, moveIdeaTarget: { ...idea, folderId: 'folder' }, moveIdeaFolderId: '' })()
  assert.deepEqual(calls.at(-1), ['idea', { folder_id: null, version: 7 }])

  const evaluation = find(node => ts.isJsxElement(node) && ts.isIdentifier(node.openingElement.tagName)
    && node.openingElement.tagName.text === 'ContextMenuItem' && node.children.some(child => ts.isJsxText(child) && child.text.trim() === 'View Evaluation'))
  const click = evaluation.openingElement.attributes.properties.find(prop => prop.name?.getText(tree) === 'onClick').initializer.expression
  const events = []
  const js = ts.transpileModule('const action = ' + click.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(js + '\naction()', {
    ideaCardContextMenu: { idea }, selectSingleIdea: id => events.push(['select', id]),
    setShowScoringPanels: value => events.push(['evaluation', value]), closeContextMenu: () => {},
    requestAnimationFrame: cb => cb(), document: { getElementById: id => ({ scrollIntoView: () => events.push(['scroll', id]) }) },
  })
  assert.deepEqual(events, [['select', 'idea'], ['evaluation', true], ['scroll', 'idea-evaluation-panel']])
  assert.equal(/status_code\s*:/.test(source), false, 'Card actions must not directly PATCH lifecycle status')
  assert.equal(source.includes('moveIdeaTarget.workspaceId'), false, 'The idea model uses workspace, not workspaceId')

  const effect = find(node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect'
    && node.arguments[0]?.getText(tree).includes('fetchAllIdeaFolders'))
  const effectJs = ts.transpileModule('const effect = ' + effect.arguments[0].getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  let destinations = [], loading = false, loadError = '', receivedParams
  let complete
  const pending = new Promise(resolve => { complete = resolve })
  const effectContext = {
    Error, moveIdeaTarget: idea, LEGACY_DUMMY_OWNER_ID: 'owner',
    setMoveIdeaFolders: rows => { destinations = rows }, setMoveFoldersLoading: value => { loading = value },
    setMoveFoldersError: value => { loadError = value }, fetchAllIdeaFolders: params => { receivedParams = JSON.parse(JSON.stringify(params)); return pending },
  }
  const cleanup = vm.runInNewContext(effectJs + '\neffect()', effectContext)
  assert.equal(loading, true)
  assert.deepEqual(receivedParams, { workspace_id: 'workspace', owner_id: 'owner' })
  complete([{ id: 'legacy', name: '2023' }, { id: 'foreign', workspace_id: 'other' }, { id: 'valid', workspace_id: 'workspace' }])
  await new Promise(setImmediate)
  assert.deepEqual(destinations.map(folder => folder.id), ['valid'])
  assert.equal(loading, false)
  cleanup()
  destinations = [{ id: 'old' }]
  vm.runInNewContext(effectJs + '\neffect()', { ...effectContext, fetchAllIdeaFolders: async () => { throw new Error('Offline') } })
  await new Promise(setImmediate)
  assert.deepEqual(Array.from(destinations), [])
  assert.equal(loadError, 'Offline')
  console.log('PASS actual idea-card callbacks: folder-only payload, root move, cross-workspace refusal, failure retention, evaluation navigation and no direct status writes')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
