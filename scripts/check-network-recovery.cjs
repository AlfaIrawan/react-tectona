const assert = require('node:assert/strict')
const http = require('node:http')
const esbuild = require('esbuild')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const bundle = await esbuild.build({entryPoints:['src/lib/api/networkRecovery.ts'],bundle:true,write:false,format:'iife',globalName:'recovery',platform:'browser'})
  const server = http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/helper.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/helper.js'?bundle.outputFiles[0].text:'<!doctype html><script src="/helper.js"></script>')})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try {
    browser=await chromium.launch({channel:'chrome',headless:true})
    const page=await browser.newPage()
    await page.goto('http://127.0.0.1:'+server.address().port)
    let reads=0,writes=0
    await page.route('**/read',route=>{reads++;return reads===1?route.abort('failed'):route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})})
    await page.route('**/write',route=>{writes++;return route.abort('failed')})
    const recovered=await page.evaluate(async()=>{const response=await recovery.fetchWithNetworkRecovery('/read');return response.json()})
    assert.equal(recovered.ok,true)
    assert.equal(reads,2)
    const writeError=await page.evaluate(async()=>{try{await recovery.fetchWithNetworkRecovery('/write',{method:'POST',body:'{}'})}catch(error){return error.name}})
    assert.equal(writeError,'TypeError')
    assert.equal(writes,1)
    console.log('PASS Chromium network failure: GET recovers once, POST is never replayed')
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1})
