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
  const filename='src/modules/project-management/pages/IdeaDetailPage.tsx'
  const source=await fs.readFile(filename,'utf8'),ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let toolbar=''
  function visit(node){if(ts.isJsxElement(node)&&node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(ast)==='className'&&p.initializer?.text?.startsWith('idea-docs-toolbar')))toolbar=node.getText(ast);ts.forEachChild(node,visit)}visit(ast)
  assert.ok(toolbar,'Use the actual Idea Docs toolbar')
  const fixture=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{FileText,FileStack,Minimize2,Maximize2,Plus,Sparkles}from'lucide-react';import{cn}from'./src/lib/utils';import{RepositoryViewModeSwitch}from'./src/modules/document-knowledge-management/components/RepositoryViewModeSwitch';import{DocumentRepositoryTableView,DocumentRepositoryPaginationControls}from'./src/modules/document-knowledge-management/components/DocumentRepositoryTableView';import{ideaDocsFolderErrorMessage}from'./src/modules/project-management/lib/ideaDocsFolderError';import{useMobileLayout}from'./src/hooks/useMobileLayout';
  const items=Array.from({length:6},(_,i)=>({id:String(i),name:i===0?'URD - Pengiriman Welcome Greeting via Whatsapp':'Policy document '+(i+1),displayName:i===0?'URD - Pengiriman Welcome Greeting via Whatsapp':null,fileName:'URD V9.docx',type:'Microsoft Word Document',status:'Draft',version:'v9',updated:'Updated 16 days ago',owner:'Putu Putri',tags:[],capability:'Document',accessScope:'Workspace'}));
  function App(){const isMobileLayout=useMobileLayout(),[ideaDocsView,setIdeaDocsView]=useState('documents'),[isIdeaDocsPanelFullscreen,setIsIdeaDocsPanelFullscreen]=useState(false),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(5),[error,setError]=useState(false);const ideaDocsLayout='folders',ideaTemplateLayout='folders',setIdeaDocsLayout=()=>{},setIdeaTemplateLayout=()=>{},enterpriseControlFocusClass='';
  return <main className="idea-detail-page mx-auto max-w-[1100px] p-4" style={{'--idea-detail-top':'0px'}}><section id="panel-document"><div style={{height:600,minHeight:450}} className={isIdeaDocsPanelFullscreen?'fixed inset-x-0 top-12 bottom-0 z-50':''}><div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-white"><div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4"><div className="shrink-0 space-y-0"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><FileText className="h-5 w-5"/><h2 className="text-lg font-semibold">Documents</h2></div>${toolbar}</div><div className="idea-docs-description"><p>Upload supporting documents or diagrams</p></div>{error&&<div role="alert" className="my-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><p>{ideaDocsFolderErrorMessage(new Error('workspace access control unavailable'))}</p><button onClick={()=>{window.retried=true;setError(false)}} className="mt-2 min-h-11 rounded-md border bg-white px-3">Retry folder access</button></div>}<div className="idea-docs-actions flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><button disabled={error} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><Sparkles className="h-4 w-4"/>Generate from template</button><button disabled={error} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Plus className="h-4 w-4"/>New folder</button></div><div className="ml-auto flex flex-wrap justify-end gap-3"><DocumentRepositoryPaginationControls mobile={isMobileLayout} page={page} pageSize={pageSize} totalCount={items.length} onPageChange={setPage} onPageSizeChange={setPageSize}/></div></div></div><div className="min-h-0 flex-1 overflow-y-auto">{ideaDocsView==='documents'?<DocumentRepositoryTableView mobileCards={isMobileLayout} items={items.slice((page-1)*pageSize,page*pageSize)} hiddenColumnKeys={['linked','access']} onDocumentClick={item=>window.opened=item.id} onVersionClick={item=>window.historyId=item.id} onItemMenu={(event,item)=>window.menuId=item.id} rowAction={item=><button onClick={()=>window.approval=item.id} className="mt-2 min-h-11 w-full rounded-md border px-3 text-sm">Request for Approval</button>}/>:<p>Templates library</p>}</div></div></div></div></section><button className="mt-4" onClick={()=>setError(true)}>Simulate folder unavailable</button></main>};createRoot(document.getElementById('root')).render(<App/>);`
  const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',alias:{'@':path.resolve('src')},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'isolate-presentation',setup(build){build.onResolve({filter:/documentRepositoryPresentation$/},()=>({path:'presentation',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const statusBadgeClass=()=>''",loader:'js'}))}}]})
  const config=(await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css=await postcss([tailwind({...config,content:[...config.content,{raw:fixture,extension:'tsx'}]})]).process(await fs.readFile('src/index.css','utf8'),{from:path.resolve('src/index.css')})
  const server=http.createServer(async(req,res)=>{if(req.url.startsWith('/images/')){try{res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(process.cwd(),'public',req.url)));return}catch{res.writeHead(404);res.end();return}}res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:req.url==='/style.css'?css.css:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>')})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const output=await fs.mkdtemp(path.join(os.tmpdir(),'tectona-mobile-docs-'))
    for(const width of [320,390,430,1440]){
      await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'Documents',exact:true}).waitFor()
      await page.screenshot({path:path.join(output,'docs-'+width+'.png')})
      if(width>767){assert.ok(await page.locator('table').count());continue}
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      assert.equal(await page.locator('table').count(),0)
      const surface=await page.locator('#panel-document > div > div').evaluate(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderTopColor,shadow:getComputedStyle(el).boxShadow,blur:getComputedStyle(el).backdropFilter}))
      assert.equal(surface.background,'rgba(255, 255, 255, 0.58)','Docs panel retains a translucent glass surface')
      assert.equal(surface.border,'rgba(255, 255, 255, 0.85)','Docs panel has a visible glass edge')
      assert.ok(surface.blur.includes('blur(24px)'),'Docs panel frosts the background')
      assert.notEqual(surface.shadow,'none','Docs panel is separated from the page background')
      const heading=await page.getByRole('heading',{name:'Documents',exact:true}).boundingBox(),tools=await page.locator('.idea-docs-toolbar').boundingBox();assert.ok(heading.y+heading.height<=tools.y,'Title and toolbar must not overlap')
      const list=page.getByRole('list',{name:'Idea documents'});assert.equal(await list.getByRole('listitem').count(),5)
      await list.getByRole('button',{name:/URD - Pengiriman/}).first().click();assert.equal(await page.evaluate(()=>window.opened),'0')
      await list.getByRole('button',{name:'v9',exact:true}).first().click();assert.equal(await page.evaluate(()=>window.historyId),'0')
      await list.getByRole('button',{name:/Actions for/}).first().click();assert.equal(await page.evaluate(()=>window.menuId),'0')
      await list.getByRole('button',{name:'Request for Approval'}).first().click();assert.equal(await page.evaluate(()=>window.approval),'0')
      await page.getByRole('button',{name:'Next document page'}).click();assert.equal(await list.getByRole('listitem').count(),1)
      await page.getByRole('button',{name:'Templates',exact:true}).click();await page.getByText('Templates library').waitFor()
      await page.getByRole('button',{name:'Idea Docs',exact:true}).click();await list.waitFor()
      await page.getByRole('button',{name:'Simulate folder unavailable'}).click();await page.getByRole('alert').waitFor()
      assert.equal(await page.getByRole('button',{name:'New folder',exact:true}).isDisabled(),true)
      assert.ok(await list.isVisible(),'Authorized document list stays available')
      await page.screenshot({path:path.join(output,'folder-error-'+width+'.png')})
      await page.getByRole('button',{name:'Retry folder access'}).click();assert.equal(await page.evaluate(()=>window.retried),true)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    }
    assert.deepEqual(errors,[]);console.log('PASS actual Docs toolbar, document cards, pagination, version/menu/approval, tabs, folder failure/retry, desktop table; screenshots: '+output)
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1})
