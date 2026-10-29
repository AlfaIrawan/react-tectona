const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const http = require('node:http')
const ts = require('typescript')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const { pathToFileURL } = require('node:url')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const source = await fs.readFile('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function find(test) {
    let result
    function visit(node) { if (!result && test(node)) result = node; if (!result) ts.forEachChild(node, visit) }
    visit(tree); assert.ok(result); return result
  }
  const declaration = name => find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name).initializer.getText(tree)
  const portal = find(node => ts.isCallExpression(node) && node.expression.getText(tree) === 'createPortal'
    && node.arguments[0]?.getText(tree).includes('id="move-idea-folder"') && !node.arguments[0].getText(tree).includes('createPortal('))
  const effect = find(node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes('fetchAllIdeaFolders'))
  const fixture = `
    import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {createPortal} from 'react-dom';
    import {Button} from './src/components/ui/button';import {Label} from './src/components/ui/label';import {MoveRight,RefreshCw} from 'lucide-react';
    window.calls=[];window.fetches=0;window.mode='ok';window.folderName='Current folder';
    const LEGACY_DUMMY_OWNER_ID='owner';
    const idea={id:'idea',title:'Example workspace idea',workspace:'workspace',folderId:null,version:3};
    async function fetchAllIdeaFolders(params){window.fetches++;await new Promise(r=>setTimeout(r,180));if(window.mode==='failure')throw Error('Folder service unavailable');return [{id:'legacy',name:'2023',workspace_id:null},{id:'foreign',name:'Other workspace',workspace_id:'other'},{id:'valid',name:window.folderName,workspace_id:'workspace'}]}
    async function patchIdea(...args){window.calls.push(args);return {...idea,folderId:args[1].folder_id}}
    function App(){
      const [moveIdeaTarget,setMoveIdeaTarget]=useState(null),[moveIdeaFolderId,setMoveIdeaFolderId]=useState('');
      const [moveIdeaFolders,setMoveIdeaFolders]=useState([]),[moveFoldersLoading,setMoveFoldersLoading]=useState(false),[moveFoldersError,setMoveFoldersError]=useState(''),[moveFoldersReloadKey,setMoveFoldersReloadKey]=useState(0);
      const [isMovingIdea,setIsMovingIdea]=useState(false),[moveIdeaError,setMoveIdeaError]=useState('');
      const closeContextMenu=()=>{},toIdea=x=>x,setIdeas=()=>{},addToast=()=>{};
      const openMoveIdeaDialog=${declaration('openMoveIdeaDialog')};const closeMoveIdeaDialog=${declaration('closeMoveIdeaDialog')};const submitMoveIdea=${declaration('submitMoveIdea')};
      ${effect.getText(tree)};
      return <><Button onClick={()=>openMoveIdeaDialog(idea)}>Open move dialog</Button>{moveIdeaTarget?createPortal(${portal.arguments[0].getText(tree)},document.body):null}</>
    }createRoot(document.getElementById('root')).render(<App/>);`
  const bundle = await esbuild.build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': path.resolve('src') }, define: { 'process.env.NODE_ENV': '"production"' } })
  const config = (await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css = await postcss([tailwind(config)]).process(await fs.readFile('src/index.css', 'utf8'), { from: path.resolve('src/index.css') })
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>:root{--background:0 0% 100%;--foreground:222 25% 15%;--border:215 30% 88%;--input:215 30% 88%;--radius:0.5rem;--primary:220 90% 55%;--primary-foreground:0 0% 100%}body{font-family:Arial,sans-serif}*{letter-spacing:0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
  const server = http.createServer((req, res) => {
    const js = req.url === '/fixture.js', style = req.url === '/style.css'
    res.setHeader('Content-Type', js ? 'text/javascript' : style ? 'text/css' : 'text/html')
    res.end(js ? bundle.outputFiles[0].text : style ? css.css : html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'chrome' : undefined })
    const page = await browser.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'tectona-folder-destinations-'))
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.getByRole('button', { name: 'Open move dialog' }).click()
      await page.waitForTimeout(50)
      assert.deepEqual(errors, [])
      const select = page.getByLabel('Destination folder'), submit = page.getByRole('button', { name: 'Move to Folder', exact: true })
      assert.equal(await submit.isDisabled(), true)
      await page.waitForFunction(() => !document.getElementById('move-idea-folder')?.disabled)
      assert.deepEqual(await select.locator('option').allTextContents(), ['Workspace root', 'Current folder'])
      await page.screenshot({ path: path.join(output, `folders-${width}.png`) })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.evaluate(() => { window.mode='failure';window.folderName='Updated folder' })
      await page.getByRole('button', { name: 'Open move dialog' }).click()
      await page.getByRole('alert').waitFor()
      assert.equal(await submit.isDisabled(), true)
      assert.equal(await select.locator('option').count(), 1)
      await page.evaluate(() => { window.mode='ok' })
      await page.getByRole('button', { name: 'Retry', exact: true }).click()
      await page.waitForFunction(() => !document.getElementById('move-idea-folder')?.disabled)
      assert.deepEqual(await select.locator('option').allTextContents(), ['Workspace root', 'Updated folder'])
      await select.selectOption('valid')
      await submit.click()
      await page.waitForFunction(() => window.calls.length === 1)
      assert.deepEqual(await page.evaluate(() => window.calls), [['idea', {folder_id:'valid',version:3}]])
    }
    assert.deepEqual(errors, [])
    console.log('PASS actual Move dialog: fresh workspace-scoped options, no legacy 2023, no foreign workspace, blocked loading/failure, retry, exact folder payload and desktop/mobile. Screenshots: '+output)
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
