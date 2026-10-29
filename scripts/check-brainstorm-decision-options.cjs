const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const http = require('node:http')
const { pathToFileURL } = require('node:url')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const fixture = `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {BrainstormConfirmationOptions} from './src/modules/project-management/components/BrainstormConfirmationOptions';
    window.sent=[];
    createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-2xl px-4 py-8 text-sm leading-6">
      <p className="mb-4">Rekaman sumber tetap MP4. Pilih format untuk pemrosesan atau ajukan alternatif.</p>
      <BrainstormConfirmationOptions indonesian choices={['Gunakan WAV untuk pemrosesan','Gunakan MP3 untuk pemrosesan','Ajukan pendekatan lain','Tentukan format nanti']}
        actions={['choose','choose','adjust','defer']}
        explanations={['Gunakan WAV untuk pemrosesan; sumber MP4 tetap disimpan.','Gunakan MP3 untuk pemrosesan; sumber MP4 tetap disimpan.','Tulis alternatif atau perubahan yang sesuai kebutuhan.','Keputusan tetap terbuka.']}
        onSubmit={async text=>{window.sent.push(text)}} />
    </main>);`
  const bundle = await esbuild.build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': path.resolve('src') }, define: { 'process.env.NODE_ENV': '"production"' } })
  const config = (await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css = await postcss([tailwind({ ...config, content: [...config.content, { raw: fixture, extension: 'tsx' }] })]).process(await fs.readFile('src/index.css', 'utf8'), { from: path.resolve('src/index.css') })
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>:root{--background:0 0% 100%;--foreground:222 25% 15%;--border:215 30% 88%;--radius:0.5rem;--primary:220 90% 55%;--primary-foreground:0 0% 100%}body{font-family:Arial,sans-serif}*{letter-spacing:0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
  const server = http.createServer((request, response) => {
    const js = request.url === '/fixture.js', style = request.url === '/style.css'
    response.setHeader('Content-Type', js ? 'text/javascript' : style ? 'text/css' : 'text/html')
    response.end(js ? bundle.outputFiles[0].text : style ? css.css : html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'chrome' : undefined })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'tectona-decision-options-'))
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.getByRole('radio').first().waitFor()
      assert.equal(await page.getByRole('radio').count(), 3)
      assert.equal(await page.getByRole('button', { name: 'Kirim', exact: true }).isDisabled(), true)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.getByRole('radio', { name: /Ajukan pendekatan lain/ }).check()
      await page.getByLabel('Alternatif yang ingin digunakan').fill('Gunakan FLAC dan pertahankan MP4 sebagai sumber.')
      await page.screenshot({ path: path.join(output, `custom-${width}.png`) })
      await page.getByRole('button', { name: 'Kirim', exact: true }).click()
      assert.equal(await page.evaluate(() => window.sent.at(-1)), 'Ajukan pendekatan lain: Gunakan FLAC dan pertahankan MP4 sebagai sumber.')
      await page.getByLabel('Alternatif yang ingin digunakan').fill('')
      await page.getByRole('button', { name: 'Tentukan format nanti', exact: true }).click()
      assert.equal(await page.evaluate(() => window.sent.at(-1)), 'Tentukan format nanti')
      await page.getByRole('radio', { name: /Gunakan MP3/ }).check()
      assert.equal(await page.locator('textarea').count(), 0)
      await page.getByRole('button', { name: 'Kirim', exact: true }).click()
      assert.equal(await page.evaluate(() => window.sent.at(-1)), 'Gunakan MP3 untuk pemrosesan')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    assert.deepEqual(errors, [])
    console.log('PASS decision alternatives, third custom option, separate deferral, exact submitted values, desktop/mobile and no overflow. Screenshots: ' + output)
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
