const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { pathToFileURL } = require('node:url')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{WorkspaceSwitcher}from'./src/modules/core-shell/components/WorkspaceSwitcher';import{AppLauncher}from'./src/modules/core-shell/components/AppLauncher';import{Bell,User}from'lucide-react';
    createRoot(document.getElementById('root')).render(<MemoryRouter><div className="app-shell relative min-h-screen pt-12"><header className="responsive-topbar absolute inset-x-0 top-0 h-12 border-b bg-white"><div className="flex h-full items-center justify-between gap-2 px-2"><div><img src="/logo.png" alt="Tectona" className="h-10 w-24 object-contain"/></div><div className="flex items-center gap-2"><div className="topbar-workspace-switcher"><WorkspaceSwitcher compact menuAlign="end"/></div><button className="topbar-action-btn flex h-10 w-10 items-center justify-center" aria-label="Notifications"><Bell className="h-4 w-4"/></button><AppLauncher/><button className="topbar-action-btn flex h-10 w-10 items-center justify-center" aria-label="Account"><User className="h-4 w-4"/></button></div></div></header><main className="p-4"><h1>Idea &amp; Backlog</h1></main></div></MemoryRouter>);`
  const mock = `export const useTenantContext=()=>({workspaceId:'one',displayName:'Workspace',setActiveTenant:value=>window.selected=value});export const useWorkspaceNavigate=()=>()=>{};export const isAllWorkspacesSelection=()=>false;export const legacyAppPathFromLocation=()=>'/idea-backlog';export const useUserWorkspaceOptions=()=>({loading:false,fallbackOrgName:'Adira',options:[{workspaceId:'one',workspaceName:'IT Business Partner WS',organizationName:'Adira',organizationId:'org',slug:'one',tenantMode:'organization'},{workspaceId:'two',workspaceName:'Data Analytics',organizationName:'Adira',organizationId:'org',slug:'two',tenantMode:'organization'}]});`
  const contextMock=mock+`export const useTenantContextOptional=()=>({uiProfile:{hiddenModuleIds:[]},tenantMode:'organization'});export const useModuleAccess=()=>({isPlatformAdmin:true,canAccess:id=>id!=='document_knowledge'});`
  const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',alias:{'@':path.resolve('src')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture-context',setup(build){build.onResolve({filter:/TenantContext$|useWorkspaceNavigate$|tenantWorkspaceScope$|workspaceRouting$|useUserWorkspaceOptions$|useModuleAccess$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:contextMock,loader:'js'}))}}]})
  const config=(await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css=await postcss([tailwind({...config,content:[...config.content,{raw:fixture,extension:'tsx'}]})]).process(await fs.readFile('src/index.css','utf8'),{from:path.resolve('src/index.css')})
  const logo=await fs.readFile('public/images/logo.png')
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':req.url==='/logo.png'?'image/png':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:req.url==='/style.css'?css.css:req.url==='/logo.png'?logo:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>')})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try{
    browser=await chromium.launch({headless:true,channel:'chrome'})
    const page=await browser.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    const output=await fs.mkdtemp(path.join(os.tmpdir(),'tectona-workspace-spacing-'))
    for(const width of [320,390,430,1440]){
      await page.setViewportSize({width,height:800})
      await page.goto('http://127.0.0.1:'+server.address().port)
      const trigger=page.getByRole('button',{name:'Switch workspace'})
      await trigger.waitFor()
      const box=await trigger.boundingBox()
      if(width<768){assert.ok(box.width>=width-33);assert.ok(box.y>=56);assert.ok(box.height>=44);const text=await trigger.locator('span').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(text.scroll<=text.width,'Workspace name must fit');const heading=await page.locator('main').boundingBox();assert.ok(heading.y>=box.y+box.height+8,'Content must clear header')}
      else {assert.ok(box.y<48);assert.ok(box.width<=192)}
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:path.join(output,'header-'+width+'.png')})
      await trigger.click()
      const menu=page.getByRole('textbox',{name:'Search workspaces'})
      await menu.waitFor()
      const panel=await menu.boundingBox();assert.ok(panel.x>=0&&panel.x+panel.width<=width)
      await menu.fill('Analytics')
      await page.getByText('Data Analytics',{exact:true}).click()
      assert.equal(await page.evaluate(()=>window.selected.workspaceId),'two')
      if(width<768){
        const logo=await page.getByAltText('Tectona').boundingBox();assert.ok(logo.width>=96)
        await page.getByRole('button',{name:'Open app launcher',exact:true}).click()
        const modules=page.getByRole('dialog',{name:'Modules',exact:true})
        await modules.waitFor()
        const rect=await modules.boundingBox();assert.ok(rect.x>=12&&rect.x+rect.width<=width-11&&rect.y>=48&&rect.y+rect.height<=801)
        assert.equal(await modules.getByText('Document & Knowledge Management',{exact:true}).count(),0,'Denied module must stay hidden')
        assert.equal(await modules.evaluate(el=>el.scrollWidth>el.clientWidth),false)
        await page.screenshot({path:path.join(output,'modules-'+width+'.png')})
        const search=modules.getByRole('searchbox',{name:'Search modules'})
        await search.fill('no-match')
        await modules.getByText('No modules found',{exact:true}).waitFor()
        await search.fill('Idea & Backlog')
        await modules.getByRole('button').filter({hasText:'Idea & Backlog'}).click()
        await modules.waitFor({state:'hidden'})
        await page.getByRole('button',{name:'Open app launcher',exact:true}).click()
        await page.keyboard.press('Escape')
        await modules.waitFor({state:'hidden'})
      }
    }
    assert.deepEqual(errors,[])
    console.log('PASS 320/390/430 mobile spacing, name fit, menu search/select, no overflow, desktop single row; screenshots: '+output)
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1})
