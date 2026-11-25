const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const ts = require('typescript')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const { pathToFileURL } = require('node:url')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const todoMode = process.argv.includes('--todo')
  const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{AppLayout}from'./src/modules/core-shell/components/AppLayout';createRoot(document.getElementById('root')).render(<MemoryRouter><AppLayout><h1>Idea & Backlog</h1><button>Underlying page</button></AppLayout></MemoryRouter>);`
  let mock = `import React,{useState}from'react';import{create}from'zustand';
    const noop=()=>{};export const useChatPanelStore=create(set=>({open:false,widthPct:30,setOpen:open=>set({open}),setWidthPct:widthPct=>set({widthPct})}));
    export const useEmailPanelStore=create(set=>({open:false,widthPct:30,setOpen:open=>set({open}),setWidthPct:widthPct=>set({widthPct})}));
    export const useSettingsPanelStore=create(set=>({panel:null,closePanel:()=>set({panel:null})}));export const useThemeStore=create(()=>({theme:'light'}));export const usePreferencesStore=create(()=>({preferences:{accentColor:'gradient'}}));export const useUiOverlayStore=create(()=>({blockingOverlayCount:0}));export const useRightDrawerStore=create(set=>({open:false,width:480,close:()=>set({open:false}),setOpen:open=>set({open}),setWidth:width=>set({width})}));
    export const useRequestJoinWorkspaceStore=create(()=>({open:false,closePanel:noop}));export const useUiLayoutStore=create(()=>({identityRef:null,resetForIdentity:noop,hydrateFromServer:async()=>{}}));export const useCollaborationPresenceStore=create(()=>({applyRealtimeUpdate:noop}));
    export const clampChatWidthPct=x=>x;export const clampEmailWidthPct=x=>x;export const DEFAULT_RIGHT_DRAWER_WIDTH=480;export const getSession=()=>null;export const publishOfflinePresenceOnPageHide=noop;export const syncUiScaleLock=noop;export const useTectonaChatRoleSync=noop;export const useCollaborationPresenceRealtime=noop;export const usePresenceAfkTracker=noop;export const useLayoutDebugMetrics=()=>({});export const useToast=()=>({addToast:noop});
    export const AppErrorBoundary=({children})=><>{children}</>;export const ThemeSettingsPanel=()=>null;export const TodoListPanel=()=>null;export const LayoutDebugIndicator=()=>null;export const WorkSyncConflictHost=()=>null;export const VoiceRecordRequestPrompt=()=>null;export const RequestJoinWorkspaceDrawer=()=>null;export const EmailSidebarPanel=()=>null;
    export function Topbar(){return <header className="responsive-topbar absolute top-0 inset-x-0 z-[60] flex h-12 items-center justify-between bg-white px-4"><img alt="Tectona" src="/logo.png" className="h-12 w-auto"/><button onClick={()=>useChatPanelStore.getState().setOpen(true)}>Open chat</button></header>}
    export function ChatSidebarPanel(){const[thread,setThread]=useState(false),[draft,setDraft]=useState(''),[sent,setSent]=useState(false);return <div className="chat-sidebar-panel flex h-full min-h-0 flex-col pl-3"><div className="flex shrink-0 items-center justify-between gap-3 p-3">{thread&&<button aria-label="Back to conversation list" onClick={()=>setThread(false)}>Back</button>}<h2 className="text-lg font-semibold">{thread?'Collection Team':'Chat'}</h2><button aria-label="Close chat panel" onClick={()=>useChatPanelStore.getState().setOpen(false)}>Close</button></div>{thread?<><div className="min-h-0 flex-1 overflow-auto p-4"><p>Discussion about collection policies</p>{sent&&<p className="mt-4 rounded-md bg-sky-50 p-3">{draft}</p>}</div><div className="flex shrink-0 items-end gap-2 border-t bg-white p-3"><textarea aria-label="Message" value={draft} onChange={e=>setDraft(e.target.value)} className="min-w-0 flex-1 rounded-md border p-2"/><button className="h-11" onClick={()=>setSent(true)}>Send</button></div></>:<div className="min-h-0 flex-1 overflow-auto p-3"><input aria-label="Search conversations" placeholder="Search conversations" className="mb-4 h-12 w-full rounded-md border px-3"/>{Array.from({length:16},(_,i)=><button key={i} className="mb-2 flex min-h-16 w-full items-center gap-3 rounded-lg border bg-white p-3 text-left" onClick={()=>setThread(true)}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100">CT</span><span className="min-w-0"><span className="block text-sm font-semibold">Collection Team {i+1}</span><span className="text-xs text-muted-foreground">Policy discussion</span></span></button>)}</div>}</div>}
  `
  if (todoMode) {
    mock = mock.replace('export const TodoListPanel=()=>null;', "export {TodoListPanel} from './src/modules/core-shell/components/TodoListPanel';")
      .replace('export const getSession=()=>null;', "export const getSession=()=>({user:{id:'fixture-user'}});")
      .replace('panel:null,closePanel:', "panel:null,openTodoPanel:()=>set({panel:'todo'}),closePanel:")
      .replace('>Open chat</button>', ">Open chat</button><button onClick={()=>useSettingsPanelStore.getState().openTodoPanel()}>Open todo</button>")
    mock += `export const notifyEvent=()=>{};export const pushGlobalToast=()=>{};`
  }
  // Exercise the actual AppLayout while replacing network/presence services and chat content.
  const allow = new Set(['react','react-router-dom','@/lib/utils','@/hooks/useMobileLayout','@/hooks/useCommunicationViewport','lucide-react','@/components/ui/button'])
  const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',loader:{'.css':'empty'},alias:{'@':path.resolve('src')},define:{'process.env.NODE_ENV':'"production"','import.meta.env.DEV':'false'},plugins:[{name:'isolated-shell',setup(build){
    if(todoMode){
      build.onLoad({filter:/\.module\.css$/},()=>({contents:'export default {}',loader:'js'}))
      build.onResolve({filter:/authService$|settings-panel-store$|notificationApi$|ui\/toast$/},()=>({path:'fixture',namespace:'fixture'}))
      build.onResolve({filter:/api\/todoApi$/},()=>({path:'todo',namespace:'todo'}))
      build.onLoad({filter:/.*/,namespace:'todo'},()=>({contents:`let todos=Array.from({length:8},(_,i)=>({id:String(i),title:i===0?'Review collection policy and confirm the updated approval workflow':'Follow up task '+i,is_completed:false,display_order:i,priorities:[],categories:[],due_date:null,created_date:'2026-11-01'}));export const TECTONA_TODO_APP_ID='fixture';export const TODO_PRIORITY_IDS={low:'low',medium:'medium',high:'high'};export const TODO_CATEGORY_IDS={};export const buildTodoEntityLinks=()=>[];export const fetchTodos=async()=>({todos});export const createTodo=async data=>{const todo={...data,id:String(todos.length),is_completed:false,priorities:[],categories:[]};todos=[todo,...todos];return todo};export const updateTodo=async(id,data)=>{todos=todos.map(t=>t.id===id?{...t,...data}:t);return todos.find(t=>t.id===id)};export const deleteTodo=async id=>{todos=todos.filter(t=>t.id!==id)};`,loader:'js'}))
    }
    build.onLoad({filter:/AppLayout\.tsx$/},async args=>{let source=await fs.readFile(args.path,'utf8');const ast=ts.createSourceFile(args.path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const edits=[];for(const node of ast.statements){if(!ts.isImportDeclaration(node)||allow.has(node.moduleSpecifier.text))continue;const names=[];if(node.importClause?.name)names.push(node.importClause.name.text);if(node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings))for(const n of node.importClause.namedBindings.elements)names.push(n.name.text);if(names.length)edits.push({start:node.getStart(ast),end:node.end,text:'import {'+names.join(',')+"} from 'fixture-state';"})}for(const edit of edits.reverse())source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);return{contents:source,loader:'tsx',resolveDir:path.dirname(args.path)}})
    build.onResolve({filter:/^fixture-state$/},()=>({path:'fixture',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'tsx',resolveDir:process.cwd()}))
  }}]})
  const config=(await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css=await postcss([tailwind({...config,content:[...config.content,{raw:fixture+mock,extension:'tsx'}]})]).process(await fs.readFile('src/index.css','utf8'),{from:path.resolve('src/index.css')})
  const logo=await fs.readFile('public/images/logo.png')
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':req.url==='/logo.png'?'image/png':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:req.url==='/style.css'?css.css:req.url==='/logo.png'?logo:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>')})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Fixture page error:',e.message)});const output=await fs.mkdtemp(path.join(os.tmpdir(),'tectona-mobile-chat-'))
    for(const width of [320,390,430,1440]){
      await page.setViewportSize({width,height:800});await page.goto('http://127.0.0.1:'+server.address().port)
      if(todoMode){
        await page.getByRole('button',{name:'Open todo',exact:true}).click()
        const todo=page.getByRole('dialog',{name:'Todo List',exact:true});await todo.waitFor();if(width>767)await page.waitForTimeout(350)
        const rect=await todo.boundingBox();const topbar=await page.locator('.responsive-topbar').boundingBox()
        if(width<768){assert.ok(rect.x<=1&&rect.width>=width-1&&rect.y>=topbar.y+topbar.height-1&&rect.y+rect.height<=801);assert.equal(await todo.evaluate(el=>el.scrollWidth>el.clientWidth),false)}else{assert.ok(Math.abs(rect.width-480)<1)}
        await todo.locator('[data-todo-title]').first().waitFor()
        await page.screenshot({path:path.join(output,'todo-'+width+'.png')})
        await todo.getByRole('textbox',{name:'Todo title',exact:true}).fill('Mobile new todo')
        await todo.getByRole('button',{name:'Add todo',exact:true}).click()
        await todo.getByRole('searchbox',{name:'Search todos'}).fill('Mobile new todo')
        await todo.getByText('Mobile new todo',{exact:true}).waitFor()
        await todo.getByRole('button',{name:'Mark complete',exact:true}).click()
        await todo.getByRole('button',{name:/^Done/}).first().click()
        await todo.getByText('Mobile new todo',{exact:true}).waitFor()
        if(width<768){await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:420});visualViewport.dispatchEvent(new Event('resize'))});await page.waitForFunction(()=>Math.abs(document.querySelector('.mobile-todo-drawer').getBoundingClientRect().bottom-420)<1);await page.screenshot({path:path.join(output,'todo-keyboard-'+width+'.png')})}
        await todo.getByRole('button',{name:'Close panel',exact:true}).click();await todo.waitFor({state:'hidden'});continue
      }
      await page.getByRole('button',{name:'Open chat',exact:true}).click()
      const panel=page.locator('.liquid-glass-chat-panel');await panel.waitFor()
      const rect=await panel.boundingBox()
      if(width>767){assert.ok(rect.width<=width*0.301);await page.getByRole('button',{name:'Close chat panel'}).click();continue}
      const header=await page.locator('.responsive-topbar').boundingBox()
      assert.ok(rect.x<=1&&rect.width>=width-1&&rect.y>=header.y+header.height-1&&rect.y+rect.height<=801,'Mobile panel below topbar')
      assert.equal(await page.locator('.responsive-topbar').evaluate(el=>el.inert),false)
      assert.equal(await page.getByRole('button',{name:'Open chat',exact:true}).isVisible(),true)
      assert.equal(await page.getByRole('separator',{name:'Resize communication panel'}).count(),0)
      assert.equal(await page.locator('[data-app-main-body]').evaluate(el=>el.inert),true)
      assert.equal(await panel.evaluate(el=>el.scrollWidth>el.clientWidth),false)
      await page.screenshot({path:path.join(output,'chat-'+width+'.png')})
      await panel.getByRole('button').filter({hasText:'Collection Team 1'}).first().click()
      await page.getByRole('textbox',{name:'Message',exact:true}).fill('Mobile message test')
      await page.getByRole('button',{name:'Send',exact:true}).click()
      await panel.locator('p').filter({hasText:'Mobile message test'}).waitFor()
      await page.screenshot({path:path.join(output,'thread-'+width+'.png')})
      await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:420});visualViewport.dispatchEvent(new Event('resize'))})
      await page.waitForFunction(()=>Math.abs(document.querySelector('.mobile-comm-panel').getBoundingClientRect().bottom-420)<1)
      const composer=await page.getByRole('textbox',{name:'Message',exact:true}).boundingBox();assert.ok(composer.y+composer.height<=421)
      await page.screenshot({path:path.join(output,'keyboard-'+width+'.png')})
      await page.getByRole('button',{name:'Back to conversation list'}).click()
      await page.getByRole('textbox',{name:'Search conversations'}).waitFor()
      await page.getByRole('button',{name:'Close chat panel'}).click()
      assert.equal(await page.locator('[data-app-main-body]').evaluate(el=>el.inert),false)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    }
    assert.deepEqual(errors,[]);console.log((todoMode?'PASS actual TodoListPanel: mobile bounds, add/search/complete/filter, keyboard viewport, close, desktop 480px; screenshots: ':'PASS actual AppLayout: mobile full width, no resize grip, keyboard viewport, close/back, inert restore, desktop unchanged; screenshots: ')+output)
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1})
