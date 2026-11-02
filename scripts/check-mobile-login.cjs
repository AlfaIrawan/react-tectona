const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'tectona-mobile-login-'))
  try {
    for (const size of [{width:390,height:844}, {width:390,height:844,visibleHeight:600}, {width:390,height:660}, {width:320,height:568}, {width:844,height:390}, {width:1440,height:900}]) {
      const mobile = size.width < 1024
      const context = await browser.newContext({viewport:size, isMobile:mobile, hasTouch:mobile})
      if(size.visibleHeight) await context.addInitScript(height=>Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>height}),size.visibleHeight)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto('http://127.0.0.1:5173/login', {waitUntil:'networkidle'})
      await page.locator('#email').waitFor({timeout:60000}).catch(async error => {
        await page.screenshot({path:path.join(output,`failure-${size.width}.png`),fullPage:true})
        console.log('Failed page:',await page.url(),await page.locator('body').innerText(),errors,output)
        throw error
      })
      assert.equal(await page.locator('vite-error-overlay').count(), 0)
      const metrics = await page.evaluate(() => {
        const input = document.querySelector('#email')
        const card = document.querySelector('#login-card-header').parentElement
        return {zoom:getComputedStyle(document.documentElement).zoom, font:parseFloat(getComputedStyle(input).fontSize), input:input.getBoundingClientRect().height, card:card.getBoundingClientRect().width, overflow:document.documentElement.scrollWidth>innerWidth}
      })
      if(mobile) {
        assert.equal(Number(metrics.zoom),1)
        assert.ok(metrics.card>=Math.min(size.width-32,380)-4)
        assert.ok(metrics.font>=16)
        assert.ok(metrics.input>=44)
        assert.equal(metrics.overflow,false)
        if(size.height>=568) assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1),false,'Portrait login should fit without scrolling')
        if(size.visibleHeight) assert.ok(await page.locator('.login-footer').evaluate(el=>el.getBoundingClientRect().bottom)<=size.visibleHeight,'Footer must fit the visible viewport, not the larger layout viewport')
        await page.locator('#email').fill('mobile@example.com')
        await page.locator('#password').fill('example-password')
        await page.getByRole('button',{name:'Show password',exact:true}).click()
        assert.equal(await page.locator('#password').getAttribute('type'),'text')
        await page.getByRole('button',{name:'Hide password',exact:true}).click()
        assert.equal(await page.locator('#password').getAttribute('type'),'password')
        assert.equal(await page.locator('#login-submit').isEnabled(),true)
        const footer = await page.evaluate(() => {
          const rect = selector => {
            const r = document.querySelector(selector).getBoundingClientRect()
            return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}
          }
          return {card:rect('#login-card-header').top,
            cardBottom:document.querySelector('#login-card-header').parentElement.getBoundingClientRect().bottom,
            copyright:rect('.tectona-auth-copyright'),build:rect('.tectona-auth-build'),
            help:rect('.tectona-auth-tour-fab button')}
        })
        assert.ok(footer.copyright.top>=footer.cardBottom,'Footer must sit below the card')
        assert.ok(footer.build.top>=footer.copyright.bottom,'Version and copyright must not overlap')
        assert.ok(footer.help.left>=Math.max(footer.build.right,footer.copyright.right),'Help has a separate column')
        await page.getByRole('button',{name:'Sign in / sign up help',exact:true}).click()
        await page.getByText('Sign in Guide',{exact:true}).waitFor()
        await page.locator('#login-card-header').click()
        await page.getByText('Sign in Guide',{exact:true}).waitFor({state:'hidden'})
        await page.evaluate(()=>scrollTo(0,0))
      } else assert.equal(Number(metrics.zoom),0.75)
      await page.screenshot({path:path.join(output,`${size.width}.png`),fullPage:true})
      assert.deepEqual(errors,[])
      console.log(size.width,metrics)
      await context.close()
    }
    console.log('PASS responsive login, phone landscape, touch sizes, password visibility, desktop scaling:',output)
  } finally { await browser.close() }
}
main().catch(e=>{console.error(e);process.exitCode=1})
