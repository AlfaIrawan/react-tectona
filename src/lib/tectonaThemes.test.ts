import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { getTectonaTheme, normalizeAccent, TECTONA_THEMES } from './tectonaThemes'

describe('Tectona Gray-to-Blue themes', () => {
  it('preserves Default and its original media paths', () => {
    expect(getTectonaTheme('gradient')).toMatchObject({ id: 'gradient', label: 'Default', video: '/images/background-1.mp4', poster: '/images/background-1.png' })
    expect(TECTONA_THEMES).toHaveLength(5)
  })
  it('preserves Default and archived Silver media for rollback', () => {
    const approved = {
      '/images/background-1.mp4': '566d41bde8f83ee6a43286526ba753759b56b85ddd81cc10502071e230bd82ea',
      '/images/background-1.png': 'e0b844cddc58f75f8254cd8b776cf22e2260136fe8db2574a14c907c38faab5a',
      '/images/themes/tectona-silver.webm': 'fcf6d5ed67f446f8ca21ea7464ddb3ad3c76fba00f23eb50aeab5906e826d51e',
      '/images/themes/tectona-silver.png': '6a86ec8ea5f1cd1a890f8a22d85f4eb918adc1429503a8804363b678f9d562eb',
    }
    for (const [path, digest] of Object.entries(approved)) {
      expect(createHash('sha256').update(readFileSync(resolve('public'+path))).digest('hex')).toBe(digest)
    }
  })
  it.each([
    ['deep-cosmic', 'tectona-midnight'], ['indigo-command', 'tectona-steel'],
    ['frosted-steel', 'tectona-silver'], ['blue-granite', 'tectona-slate'],
  ])('migrates %s to %s without resetting to Default', (old, current) => {
    expect(normalizeAccent(old)).toBe(current)
    expect(getTectonaTheme(old).id).toBe(current)
  })
  it.each([undefined, null, '', 'removed', '__proto__', 42])('safely falls back for %s', value => {
    expect(normalizeAccent(value)).toBe('gradient')
  })
  it('ships a distinct local WebM and poster for every replacement theme', () => {
    const themes = TECTONA_THEMES.slice(1)
    expect(new Set(themes.map(t => t.video)).size).toBe(4)
    const payloads = []
    for (const theme of themes) {
      expect(existsSync(resolve('public' + theme.video))).toBe(true)
      expect(existsSync(resolve('public' + theme.poster))).toBe(true)
      const video = readFileSync(resolve('public' + theme.video))
      expect(video.subarray(0,4).toString('hex')).toBe('1a45dfa3')
      expect(video.length).toBeLessThan((theme.id === 'tectona-steel' || theme.id === 'tectona-silver' ? 5 : 2)*1024*1024)
      payloads.push(video.toString('base64'))
      expect(getTectonaTheme(theme.id)).toBe(theme)
    }
    expect(new Set(payloads).size).toBe(4)
  })
  it('scopes all new CSS rules to the replacement theme family', () => {
    const css = readFileSync(resolve('src/tectona-themes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const rule of css.split('}').filter(rule => rule.includes('{'))) {
      const selector = rule.split('{')[0]
      expect(selector).toContain('data-accent')
      expect(selector).toContain('tectona-')
      expect(selector).not.toMatch(/\[data-accent\s*=\s*["']gradient["']\]/)
    }
  })
})
