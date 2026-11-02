const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const { pathToFileURL } = require('node:url')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  let fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{MobileIdeaSectionNav}from'./src/modules/project-management/components/MobileIdeaSectionNav';import{IdeaTitleEditor}from'./src/modules/project-management/components/IdeaTitleEditor';import{useMobileLayout}from'./src/hooks/useMobileLayout';
  const sections=[{key:'summary',label:'Summary'},{key:'scoring',label:'Scoring'},{key:'document',label:'Idea Docs'}];
  function App(){const mobile=useMobileLayout(),[active,setActive]=useState('summary'),[title,setTitle]=useState('Platform Analitik Geospasial TIAN (Territorial Intelligence & Analytics Network)'),[full,setFull]=useState(false);const titleEditor=<IdeaTitleEditor ideaId="test" title={title} version={1} nameOf={()=>'Marco Hervey'} onRenamed={idea=>setTitle(idea.title)} onError={message=>window.error=message}/>;
  return <><header className="responsive-topbar fixed inset-x-0 top-0 z-[60] h-12 bg-white px-4"><img className="h-12 w-auto" src="/logo.png" alt="Tectona"/><div className="absolute inset-x-4 top-14 rounded-md border bg-white p-3 text-sm">IT Business Partner WS</div></header><main className="app-shell mx-auto max-w-[1440px] p-4 pt-12"><div className="idea-detail-page min-w-0" style={{'--idea-detail-top':mobile?'108px':'48px'}}>
  {mobile&&<MobileIdeaSectionNav sections={sections} active={active} onChange={setActive}/>}
  <div className="idea-detail-content min-w-0 space-y-5 pb-8 mr-0 md:mr-12 lg:mr-72"><div className="text-xs text-muted-foreground">Workspace / Idea & Backlog / TIAN</div>
  <div className="idea-detail-heading space-y-4"><div className="idea-detail-heading-row flex items-start justify-between gap-4"><div className="flex min-w-0 flex-1 items-start gap-3"><button aria-label="Back to ideas" className="h-10 w-10">Back</button><div aria-hidden="true" className="w-[10px] self-stretch bg-sky-500"/><div className="min-w-0 flex-1 space-y-2"><span className="inline-flex rounded border bg-sky-50 px-2 py-1 text-xs">Under Review / Innovation</span>{titleEditor}<p className="idea-detail-metadata text-sm text-muted-foreground"><span>Workspace: IT Business Partner WS</span><span aria-hidden="true"> · </span><span>Submitted by Marco Hervey Tehupeiroy</span><span aria-hidden="true"> · </span><time>30 Oct 2026</time></p></div></div><div className="idea-detail-refresh-meta flex shrink-0 flex-col items-end gap-2"><div className="self-end text-xs"><p>Latest AI Strategic Insight: 30 Oct 2026</p></div></div></div></div>
  <div className="idea-detail-panels min-w-0 space-y-4"><div className={full?'idea-detail-fullscreen fixed inset-x-0 top-12 bottom-0 z-50 flex min-h-0 w-screen flex-col overflow-hidden bg-background':''}><section id={'panel-'+active} style={{height:420,maxHeight:420,minHeight:360}} className="rounded-2xl border bg-white"><div className="flex h-full min-h-0 w-full flex-col"><div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4"><div className="shrink-0 space-y-0"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><h2 className="text-lg font-semibold">{sections.find(s=>s.key===active).label==='Summary'?'AI-Powered Idea Summary':sections.find(s=>s.key===active).label}</h2></div><div className="flex shrink-0 items-center gap-2"><span className="text-xs">Confidence 91%</span><button className="h-11 w-11" aria-label={full?'Exit fullscreen':'Fullscreen'} onClick={()=>setFull(!full)}>Expand</button></div></div></div><div className="min-h-0 flex-1 overflow-y-auto">{Array.from({length:9},(_,i)=><section key={i} className="py-3"><h3 className="font-semibold">{i+1}. Business context</h3><p className="mt-2 text-sm leading-6">Improve field collection policy access through Generative AI. Document upload and knowledge management follow the approved integration scope.</p></section>)}</div></div></div></section></div></div></div></div></main></>};createRoot(document.getElementById('root')).render(<App/>);`
  fixture = fixture.replace('className="min-w-0 flex-1 space-y-2"', 'className="idea-detail-title-block min-w-0 flex-1 space-y-2"')
    .replace('<span className="inline-flex rounded border bg-sky-50 px-2 py-1 text-xs">', '<div className="flex flex-wrap"><span className="inline-flex rounded border bg-sky-50 px-2 py-1 text-xs">')
    .replace('Under Review / Innovation</span>{titleEditor}', 'Under Review / Innovation</span></div>{titleEditor}')
  const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',alias:{'@':path.resolve('src')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'title-api',setup(build){build.onResolve({filter:/api\/ideaBacklogApi$/},()=>({path:'mock',namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},()=>({loader:'js',contents:`export const listIdeaTitleVersions=async()=>[{version_no:1,title:'Original title',source_code:'initial',created_at:'2026-10-30'}];export const patchIdea=async(id,data)=>data;`}))}}]})
  const config=(await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css=await postcss([tailwind({...config,content:[...config.content,{raw:fixture,extension:'tsx'}]})]).process(await fs.readFile('src/index.css','utf8'),{from:path.resolve('src/index.css')})
  const logo=await fs.readFile('public/images/logo.png')
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':req.url==='/logo.png'?'image/png':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:req.url==='/style.css'?css.css:req.url==='/logo.png'?logo:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>')})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const output=await fs.mkdtemp(path.join(os.tmpdir(),'tectona-mobile-detail-'))
    for(const width of [320,390,430,1440]){
      await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:'+server.address().port)
      await page.getByRole('button',{name:'Edit idea title'}).waitFor()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:path.join(output,'detail-'+width+'.png')})
      if(width>767){assert.equal(await page.getByRole('combobox',{name:'Idea section'}).count(),0);continue}
      const heading=await page.locator('.idea-detail-heading').boundingBox(),nav=await page.getByRole('navigation',{name:'Idea sections'}).boundingBox()
      const breadcrumb=await page.locator('.idea-detail-content > div').first().boundingBox()
      assert.ok(Math.abs(heading.y-breadcrumb.y-breadcrumb.height-4)<1,'Breadcrumb-to-heading gap is 4px without desktop space-y margin')
      assert.equal(await page.getByRole('button',{name:'Back to ideas'}).isVisible(),false,'Mobile back arrow is hidden')
      assert.equal(await page.locator('.idea-detail-title-block > div').first().evaluate(el=>getComputedStyle(el).paddingLeft),'0px','No empty back-arrow gutter')
      assert.ok(nav.y>=heading.y+heading.height,'Navigation follows title and metadata')
      assert.ok((await page.locator('[id^="panel-"]').boundingBox()).height>420,'Normal panel follows content height')
      await page.getByRole('combobox',{name:'Idea section'}).selectOption('document')
      await page.locator('#panel-document').waitFor()
      await page.getByRole('button',{name:'Title history'}).click()
      const history=await page.locator('.idea-title-history').boundingBox();assert.ok(history.x>=15&&history.x+history.width<=width-15)
      await page.screenshot({path:path.join(output,'history-'+width+'.png')})
      await page.getByRole('button',{name:'Close title history'}).click()
      await page.getByRole('button',{name:'Edit idea title'}).click()
      const input=page.getByRole('textbox',{name:'Idea title'});await input.fill('Updated Collection Policy Assistant');await input.press('Enter')
      await page.getByRole('button',{name:'Edit idea title'}).filter({hasText:'Updated Collection Policy Assistant'}).waitFor()
      await page.getByRole('button',{name:'Fullscreen',exact:true}).click()
      const fullscreen=await page.locator('.idea-detail-fullscreen').boundingBox();assert.ok(fullscreen.y>=108&&fullscreen.x>=0&&fullscreen.x+fullscreen.width<=width)
      await page.screenshot({path:path.join(output,'fullscreen-'+width+'.png')})
      await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    }
    assert.deepEqual(errors,[]);console.log('PASS mobile detail 320/390/430: section navigation, natural panel height, title edit/history, fullscreen below header; desktop preserved; screenshots: '+output)
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1})
