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
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {SlidingCardGrid} from './src/modules/project-management/components/SlidingCardGrid';
    const items=Array.from({length:24},(_,i)=>({id:String(i),title:'Idea '+(i+1)}));
    createRoot(document.getElementById('root')).render(<main className="p-6">
      <h1 className="mb-4 text-lg font-semibold">Idea Submission Stream</h1>
      <SlidingCardGrid items={location.search.includes('fits')?items.slice(0,1):items} getKey={item=>item.id} renderItem={item=><article className="h-[240px] rounded-lg border bg-white p-4">
        <h2>{item.title}</h2><button onClick={()=>window.cardClicked=true}>Open idea</button>
        <textarea aria-label={'Note '+item.id} className="mt-2 block h-10 w-full border"/>
        <div data-nested className="mt-2 h-12 overflow-y-auto"><p className="h-48">Scrollable card content</p></div>
      </article>}/>
      <div style={{height:800}}>Page content below the stream</div>
    </main>);
  `
  const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',alias:{'@':path.resolve('src')},define:{'process.env.NODE_ENV':'"production"'}})
  const config=(await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css=await postcss([tailwind({...config,content:[...config.content,{raw:fixture,extension:'tsx'}]})]).process(await fs.readFile('src/index.css','utf8'),{from:path.resolve('src/index.css')})
  const server=http.createServer((req,res)=>{
    const js=req.url==='/fixture.js',style=req.url==='/style.css'
    res.setHeader('Content-Type',js?'text/javascript':style?'text/css':'text/html')
    res.end(js?bundle.outputFiles[0].text:style?css.css:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try {
    browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'chrome':undefined})
    const page=await browser.newPage(),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())})
    const base=`http://127.0.0.1:${server.address().port}`
    const output=await fs.mkdtemp(path.join(os.tmpdir(),'tectona-wheel-'))
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:800})
      await page.goto(base)
      const next=page.getByRole('button',{name:'Next page',exact:true})
      const previous=page.getByRole('button',{name:'Previous page',exact:true})
      await next.waitFor()
      const pageNumber=()=>page.locator('p').filter({hasText:/Page \d+ of/}).innerText()
      const first=await pageNumber()
      const card=page.locator('[aria-hidden="false"] article').first()
      const hoverCard=()=>page.locator('[aria-hidden="false"] article h2').first().hover()
      await hoverCard()
      await page.mouse.wheel(0,120)
      await page.waitForFunction(text=>![...document.querySelectorAll('p')].some(p=>p.textContent===text),first)
      const second=await pageNumber()
      assert.match(second,/Page 2 of/)
      assert.equal(await page.evaluate(()=>scrollY),0,'Paging must not scroll the surrounding page')
      await page.mouse.wheel(0,120)
      assert.equal(await pageNumber(),second,'One burst must not skip multiple pages')
      await page.waitForTimeout(500)
      await hoverCard()
      await page.mouse.wheel(0,-120)
      await page.waitForFunction(text=>[...document.querySelectorAll('p')].some(p=>p.textContent===text),first)
      await page.waitForTimeout(500)
      // Real horizontal trackpad/mouse tilt movement is still supported.
      await hoverCard()
      await page.mouse.wheel(100,0)
      await page.waitForFunction(text=>[...document.querySelectorAll('p')].some(p=>p.textContent===text),second)
      await page.waitForTimeout(500)
      await card.locator('textarea').hover()
      await page.mouse.wheel(0,120)
      assert.equal(await pageNumber(),second,'Inputs must not navigate pages')
      await page.evaluate(()=>scrollTo(0,0))
      await card.locator('[data-nested]').hover()
      await page.mouse.wheel(0,80)
      await page.waitForFunction(()=>document.querySelector('[aria-hidden="false"] [data-nested]').scrollTop>0)
      assert.equal(await pageNumber(),second,'Nested scroll containers retain native scrolling')
      await hoverCard()
      const zoomCancelled=await card.locator('h2').evaluate(el=>!el.dispatchEvent(new WheelEvent('wheel',{deltaY:120,ctrlKey:true,bubbles:true,cancelable:true})))
      assert.equal(zoomCancelled,false)
      await previous.click()
      await page.waitForTimeout(500)
      await hoverCard()
      const boundaryCancelled=await card.locator('h2').evaluate(el=>!el.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,bubbles:true,cancelable:true})))
      assert.equal(boundaryCancelled,false,'First-page outward wheel is released')
      await card.getByRole('button',{name:'Open idea'}).click()
      assert.equal(await page.evaluate(()=>window.cardClicked),true)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:path.join(output,`grid-${width}.png`),fullPage:false})
      await page.goto(base+'?fits')
      await page.getByRole('heading',{name:'Idea 1',exact:true}).waitFor()
      assert.equal(await page.getByRole('button',{name:'Next page',exact:true}).count(),0)
      await page.getByRole('heading',{name:'Idea 1',exact:true}).hover()
      await page.mouse.wheel(0,120)
      await page.waitForFunction(()=>scrollY>0)
    }
    assert.deepEqual(errors,[])
    console.log('PASS mouse wheel, horizontal wheel, cooldown, inputs, nested scroll, zoom, boundary, clicks, non-paged grid and responsive layout:',output)
  } finally {
    if(browser)await browser.close()
    await new Promise(resolve=>server.close(resolve))
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
