const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')
const React = require('react')
const { JSDOM } = require('jsdom')

async function load(entry, mocks = {}) {
  const result = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'test-dependencies', setup(build) {
      build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined)
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }))
    } }],
  })
  const loaded = new Module(path.resolve('idea-docs-editor-test.cjs'), module)
  loaded.filename = path.resolve('idea-docs-editor-test.cjs')
  loaded.paths = module.paths
  loaded._compile(result.outputFiles[0].text, loaded.filename)
  return loaded.exports
}

async function main() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>', { url: 'https://tectona.test' })
  global.window = dom.window
  global.document = dom.window.document
  global.navigator = dom.window.navigator
  const rootFolder = { id: 'root', name: 'Project Collection', workspace_id: 'ws', description: 'tectona_project_id:project', parent_id: null }
  let folders = { root: rootFolder, child: { ...rootFolder, id: 'child', description: null, parent_id: 'root' } }
  let calls = []
  global.__folderApi = {
    getDocumentFolder: async id => { calls.push(id); return folders[id] ?? null },
    fetchAllDocumentFolders: async workspace => { calls.push(['list', workspace]); return [] },
    createDocumentFolder: async payload => { calls.push(['create', payload]); return { ...payload, id: 'new-root' } },
    updateDocumentFolder: async () => { throw new Error('Unexpected folder rename') },
    deleteDocumentFolder: async () => {},
  }
  const folderMock = 'module.exports = global.__folderApi'
  const helper = await load('src/modules/projects/lib/resolveExistingIdeaDocsFolder.ts', { '@/lib/api/documentFolderApi': folderMock })
  const doc = { id: 'doc', folder_id: 'child', project_id: 'project', tags: ['idea'], metadata: { idea_id: 'idea' } }
  assert.equal((await helper.resolveExistingIdeaDocsFolder({ ideaId: 'idea', workspaceId: 'ws', documents: [doc] })).id, 'root')
  calls = []
  assert.equal(await helper.resolveExistingIdeaDocsFolder({ ideaId: 'other', workspaceId: 'ws', documents: [doc] }), null)
  assert.equal(calls.length, 0)
  assert.equal(await helper.resolveExistingIdeaDocsFolder({ ideaId: 'idea', workspaceId: 'other-ws', documents: [doc] }), null)
  folders.child.parent_id = 'child'
  await assert.rejects(helper.resolveExistingIdeaDocsFolder({ ideaId: 'idea', workspaceId: 'ws', documents: [doc] }), /hierarchy/)
  folders.child.parent_id = 'root'
  global.__folderApi.getDocumentFolder = async () => { throw new Error('forbidden') }
  await assert.rejects(helper.resolveExistingIdeaDocsFolder({ ideaId: 'idea', workspaceId: 'ws', documents: [doc] }), /forbidden/)
  global.__folderApi.getDocumentFolder = async id => folders[id] ?? null
  const ensure = await load('src/modules/projects/lib/ensureProjectDocumentFolder.ts', {
    '@/lib/api/documentFolderApi': folderMock,
    '../store/projectDocumentFolderStore': 'export const useProjectDocumentFolderStore = {getState: () => ({ getFolderId: () => null, setFolderMapping: () => {}, removeFolderMapping: () => {} })}',
  })
  calls = []
  assert.equal(await ensure.ensureProjectDocumentFolder({ id: 'project', name: 'Collection', workspace_id: 'ws' }), 'new-root')
  assert.deepEqual(calls[0], ['list', 'ws'])
  assert.equal(calls[1][1].workspace_id, 'ws')

  const urls = await load('src/lib/onlyofficeDocumentServerUrl.ts')
  const apiResponse = () => new Response('var DocsAPI = {};')
  let editorResponse = () => new Response('<html><title>Document Editor</title><div id="viewport"></div></html>')
  global.fetch = async url => String(url).endsWith('api.js') ? apiResponse() : editorResponse()
  assert.equal(await urls.sameOriginDocumentServerProblem('https://tectona.test/onlyoffice-ds'), null)
  editorResponse = () => new Response('Document Editor', { headers: { 'X-Frame-Options': 'DENY' } })
  assert.match(await urls.sameOriginDocumentServerProblem('https://tectona.test/onlyoffice-ds'), /X-Frame-Options/)
  editorResponse = () => new Response('Document Editor', { headers: { 'Content-Security-Policy': "frame-ancestors 'none'" } })
  assert.match(await urls.sameOriginDocumentServerProblem('https://tectona.test/onlyoffice-ds'), /Content-Security-Policy/)
  editorResponse = () => new Response('<div id="root"></div>')
  assert.match(await urls.sameOriginDocumentServerProblem('https://tectona.test/onlyoffice-ds'), /application page/)
  global.fetch = async () => new Response('<html>App shell</html>')
  assert.match(await urls.sameOriginDocumentServerProblem('https://tectona.test/onlyoffice-ds'), /instead of/)

  global.IS_REACT_ACT_ENVIRONMENT = true
  let editorConfig
  let destroyed = 0
  window.DocsAPI = { DocEditor: function(id, config) { editorConfig = config; return { destroyEditor: () => destroyed++ } } }
  const timers = new Map()
  let timerId = 0
  window.setTimeout = callback => { timers.set(++timerId, callback); return timerId }
  window.clearTimeout = id => timers.delete(id)
  const component = await load('src/modules/document-knowledge-management/components/DocumentOnlyOfficeEditor.tsx', {
    '@/components/ui/button': 'import React from "react"; export const Button = ({variant, size, children, ...props}) => React.createElement("button", props, children)',
    '@/lib/utils': 'export const cn = (...values) => values.filter(Boolean).join(" ")',
    '@/modules/core-shell/components/ChatSidebarPanel': 'export const ChatSidebarPanel = () => null',
    '@/lib/chat/useTectonaPageContextReporter': 'export const useTectonaPageContextReporter = () => {}',
    '@/lib/onlyofficeDocumentServerUrl': 'export const resolveWorkingDocumentServerUrl = async () => "https://tectona.test/onlyoffice-ds"',
    '@/lib/api/documentKnowledgeApi': 'export const fetchOnlyOfficeEditorConfig = async () => ({ documentServerUrl: "https://tectona.test/onlyoffice-ds", config: {} }); export const fetchTemplateOnlyOfficeEditorConfig = fetchOnlyOfficeEditorConfig; export const fetchLatestAttachmentId = async () => null; export const fetchLatestTemplateAttachmentId = fetchLatestAttachmentId;',
  })
  const { createRoot } = require('react-dom/client')
  const app = createRoot(document.getElementById('app'))
  const props = { open: true, documentId: 'doc', documentTitle: 'Collection', onClose: () => {} }
  await React.act(async () => { app.render(React.createElement(component.DocumentOnlyOfficeEditor, props)) })
  assert.match(document.body.textContent, /Opening editor/)
  await React.act(async () => { editorConfig.events.onAppReady() })
  assert.doesNotMatch(document.body.textContent, /Opening editor/)
  await React.act(async () => { app.render(React.createElement(component.DocumentOnlyOfficeEditor, { ...props, documentId: 'second-doc' })) })
  await React.act(async () => { [...timers.values()][0]() })
  assert.match(document.body.textContent, /iframe may be blocked/)
  const retry = [...document.querySelectorAll('button')].find(button => button.textContent === 'Retry')
  assert.ok(retry)
  await React.act(async () => { retry.click() })
  assert.match(document.body.textContent, /Opening editor/)
  await React.act(async () => { app.unmount() })
  assert.equal(timers.size, 0)
  assert.ok(destroyed >= 2)
  console.log('PASS: existing authorized folder resolution, scope, cycles, denied access, workspace-tagged creation, proxy checks, editor ready/timeout/retry/cleanup')
  dom.window.close()
}
main().catch(error => { console.error(error); process.exitCode = 1 })
