import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import postcss from 'postcss'

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')

test('login uses the shared responsive glass shell and keeps its own wordmark', () => {
  const page = source('src/pages/Login.tsx')
  assert.match(page, /<AuthLoginLayout footer=/)
  assert.match(page, /images\/[a-z]+-wordmark\.svg/)
  assert.doesNotMatch(page, /<AuthPageLayout>|ref=\{mobileLayoutRef\}/)
  const css = source('src/modules/auth/login-presentation.css')
  assert.doesNotThrow(() => postcss.parse(css))
  for (const rule of ['grid-template-rows: 1fr auto 1fr', 'max-width: 28rem', 'height: 96px', 'min-height: 48px', "data-compact='true'"]) assert.ok(css.includes(rule), rule)
})

test('login owns viewport scale and restores dashboard state', () => {
  const shell = source('src/modules/auth/AuthLoginLayout.tsx')
  assert.match(shell, /root\.dataset\.loginLayout = 'active'/)
  assert.match(shell, /nextViewportKey !== viewportKey/)
  assert.match(shell, /delete root\.dataset\.loginLayout/)
  assert.match(shell, /root\.dataset\.accent = previousAccent/)
  assert.match(shell, /element\.contains\(document\.activeElement\)/)
})

test('login uses the approved shared wave video and poster', () => {
  for (const [file, expected] of [
    ['public/images/background-1.mp4', '566d41bde8f83ee6a43286526ba753759b56b85ddd81cc10502071e230bd82ea'],
    ['public/images/background-1.png', 'e0b844cddc58f75f8254cd8b776cf22e2260136fe8db2574a14c907c38faab5a'],
  ]) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file, import.meta.url))).digest('hex'), expected)
})
