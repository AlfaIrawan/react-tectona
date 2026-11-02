const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const { pathToFileURL } = require('node:url')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const fixture = `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {MobileIdeaControls} from './src/modules/project-management/components/MobileIdeaControls';
    import {MobileIdeaList} from './src/modules/project-management/components/MobileIdeaList';
    import {MobileIdeaFolders} from './src/modules/project-management/components/MobileIdeaFolders';
    import {SlidingCardGrid} from './src/modules/project-management/components/SlidingCardGrid';
    import {useMobileLayout} from './src/hooks/useMobileLayout';
    const types=['Innovation','Improvement','Request','Transformation'];const statuses=['New Submission','Under Review','Approved','Rejected','Converted to Project'];
    const ideas=Array.from({length:12},(_,i)=>({id:String(i),title:i===0?'Platform Analitik Geospasial TIAN (Territorial Intelligence & Analytics Network)':'Autofill Nomor Rekening '+(i+1),description:'Pengembangan platform analitik untuk meningkatkan kualitas proses dan pelayanan.',type:types[i%4],status:statuses[i%5],createdAt:'2026-10-30',cardAccentColor:i===11?null:['#6366f1','#84cc16','#14b8a6','#ec4899'][i%4]}));
    function App(){const mobile=useMobileLayout();const [query,setQuery]=useState(''),[type,setType]=useState(new Set(types)),[status,setStatus]=useState(new Set(statuses)),[content,setContent]=useState('all');const items=ideas.filter(i=>i.title.toLowerCase().includes(query.toLowerCase())&&type.has(i.type)&&status.has(i.status));
    const create=()=>window.created=true;return <main className="mx-auto max-w-[1440px] space-y-4 p-4">
      <img src="/logo.png" alt="Tectona" className="mb-6 h-10 w-auto"/>
      {mobile?<MobileIdeaControls query={query} onQueryChange={setQuery} content={content} onContentChange={setContent} ideaCount={ideas.length} folderCount={0} groups={[{label:'Type',options:types,selected:type,onChange:setType},{label:'Status',options:statuses,selected:status,onChange:setStatus}]} onCreate={create} onCreateFolder={()=>window.folder=true} onUpload={()=>window.upload=true}/>:<h1 className="text-2xl font-semibold">Idea & Backlog</h1>}
      {mobile&&content==='folders'&&<MobileIdeaFolders folders={[{id:'folder-1',name:'Collection',ideaCount:2}]} onOpen={id=>window.openedFolder=id} onRename={async(id,name)=>window.renamed=name} onDelete={folder=>window.deletedFolder=folder.id}/>}
      {content!=='folders'&&(mobile?<MobileIdeaList items={items} filtered={!!query||type.size!==4||status.size!==5} onReset={()=>{setQuery('');setType(new Set(types));setStatus(new Set(statuses))}} owner={()=>'Marco Hervey Tehupeiroy'} onOpen={idea=>window.opened=idea.id} onCreate={create}/>:<SlidingCardGrid items={items} getKey={i=>i.id} renderItem={i=><article className="h-60 rounded-lg border bg-white p-4"><h2>{i.title}</h2><p>{i.description}</p></article>}/>)}
    </main>};createRoot(document.getElementById('root')).render(<App/>);
  `
  const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',alias:{'@':path.resolve('src')},define:{'process.env.NODE_ENV':'"production"'}})
  const config=(await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css=await postcss([tailwind({...config,content:[...config.content,{raw:fixture,extension:'tsx'}]})]).process(await fs.readFile('src/index.css','utf8'),{from:path.resolve('src/index.css')})
  const logo=await fs.readFile('public/images/logo.png')
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':req.url==='/logo.png'?'image/png':'text/html')
    res.end(req.url==='/app.js'?bundle.outputFiles[0].text:req.url==='/style.css'?css.css:req.url==='/logo.png'?logo:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try {
    browser=await chromium.launch({headless:true,channel:'chrome'})
    const page=await browser.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    const output=await fs.mkdtemp(path.join(os.tmpdir(),'tectona-mobile-ideas-'))
    for(const width of [320,390,430,1440]) {
      await page.setViewportSize({width,height:844})
      await page.goto('http://127.0.0.1:'+server.address().port)
      await page.getByRole('heading',{name:'Idea & Backlog',exact:true}).waitFor()
      await page.screenshot({path:path.join(output,'ideas-'+width+'.png'),fullPage:false})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow at '+width)
      if(width>767){assert.equal(await page.getByRole('button',{name:'Filter',exact:true}).count(),0);continue}
      const search=page.getByRole('searchbox')
      const cards=page.getByRole('list',{name:'Ideas',exact:true}).getByRole('button')
      assert.equal(await cards.first().evaluate(el=>getComputedStyle(el).borderRightColor),'rgb(99, 102, 241)','Use the saved desktop accent color')
      assert.equal(await cards.last().evaluate(el=>getComputedStyle(el).borderRightColor),'rgb(148, 163, 184)','Use the same neutral fallback as desktop')
      assert.notEqual(await cards.first().evaluate(el=>getComputedStyle(el,'::after').backgroundImage),'none','Desktop color tint must render')
      await search.fill('not found')
      await page.getByRole('heading',{name:'No matching ideas'}).waitFor()
      await page.getByRole('button',{name:'Reset search and filters'}).click()
      assert.equal(await page.getByRole('list',{name:'Ideas',exact:true}).getByRole('listitem').count(),12)
      await page.getByRole('button',{name:'Filter',exact:true}).click()
      const dialog=page.getByRole('dialog',{name:'Filter ideas'})
      await dialog.getByLabel('Innovation',{exact:true}).uncheck()
      await page.keyboard.press('Escape')
      await page.getByRole('button',{name:'Filter',exact:true}).click()
      assert.equal(await dialog.getByLabel('Innovation',{exact:true}).isChecked(),true,'Cancelled changes are discarded')
      await dialog.getByLabel('Innovation',{exact:true}).uncheck()
      await dialog.getByRole('button',{name:'Apply filters'}).click()
      await page.getByRole('button',{name:'Filter (1)',exact:true}).waitFor()
      assert.equal(await page.getByRole('list',{name:'Ideas',exact:true}).getByRole('listitem').count(),9)
      await page.getByRole('button',{name:'Filter (1)',exact:true}).click()
      await page.screenshot({path:path.join(output,'filters-'+width+'.png')})
      assert.equal(await dialog.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),true)
      await dialog.getByRole('button',{name:'Reset',exact:true}).click()
      await dialog.getByRole('button',{name:'Apply filters'}).click()
      await page.getByRole('list',{name:'Ideas',exact:true}).getByRole('button').first().click()
      assert.equal(await page.evaluate(()=>window.opened),'0')
      await page.getByRole('button',{name:'Create Idea',exact:true}).click()
      assert.equal(await page.evaluate(()=>window.created),true)
      await page.getByRole('button',{name:'More idea actions',exact:true}).click()
      await page.getByText('Upload Idea',{exact:true}).click()
      assert.equal(await page.evaluate(()=>window.upload),true)
      await page.getByRole('button',{name:'Folders 0',exact:true}).click()
      await page.getByRole('button',{name:'Collection 2 ideas',exact:true}).click()
      assert.equal(await page.evaluate(()=>window.openedFolder),'folder-1')
      await page.getByRole('button',{name:'Actions for Collection',exact:true}).click()
      page.once('dialog',dialog=>dialog.accept('Renamed'))
      await page.getByText('Rename folder',{exact:true}).click()
      assert.equal(await page.evaluate(()=>window.renamed),'Renamed')
      await page.getByRole('button',{name:'Actions for Collection',exact:true}).click()
      await page.getByText('Delete folder',{exact:true}).click()
      assert.equal(await page.evaluate(()=>window.deletedFolder),'folder-1')
    }
    assert.deepEqual(errors,[])
    console.log('PASS mobile layout, search, filter apply/reset/cancel, open/create/upload, desktop grid; screenshots: '+output)
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1})
