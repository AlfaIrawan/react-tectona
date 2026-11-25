import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { AppBackgroundVideo } from './AppBackgroundVideo'
import { usePreferencesStore } from '@/stores/preferences-store'
import ThemeSettingsPanel from '@/components/settings/ThemeSettingsPanel'

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
})

let root: Root
let container: HTMLDivElement
let motionListener: (() => void) | undefined
let reduced = false
const initial = { ...usePreferencesStore.getState().preferences }
beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  reduced = false
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return reduced }, addEventListener: (_: string, callback: () => void) => { motionListener = callback }, removeEventListener: vi.fn() })))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  usePreferencesStore.setState({ preferences: { ...initial, accentColor: 'gradient', reduceAnimations: false, highContrast: false } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  usePreferencesStore.setState({ preferences: initial })
  delete document.documentElement.dataset.accent
})
const render = async () => { await act(async () => root.render(createElement(AppBackgroundVideo))) }

describe('Theme video lifecycle', () => {
  it('keeps the original video on Default and loads only the selected theme', async () => {
    await render()
    expect(document.querySelector('video')?.getAttribute('src')).toBe('/images/background-1.mp4')
    const old = [...document.querySelectorAll('video')]
    await act(async () => usePreferencesStore.getState().updatePreferences({ accentColor: 'tectona-steel' }))
    expect([...document.querySelectorAll('video')].map(v => v.getAttribute('src'))).toEqual(['/images/themes/tectona-steel-glass-orb-loop-v1.webm'])
    expect(document.querySelector('video')?.loop).toBe(true)
    expect(old.every(v => !v.isConnected)).toBe(true)
    expect(document.documentElement.dataset.accent).toBe('tectona-steel')
  })
  it('uses a static poster when the app Reduce Animations setting is enabled', async () => {
    usePreferencesStore.getState().updatePreferences({ accentColor: 'tectona-midnight', reduceAnimations: true })
    await render()
    expect(document.querySelectorAll('video')).toHaveLength(0)
    expect((document.querySelector('.app-background-video-layer') as HTMLElement).style.backgroundImage).toContain('tectona-midnight.png')
  })
  it('responds to OS reduced-motion changes without loading extra themes', async () => {
    await render()
    reduced = true
    await act(async () => motionListener?.())
    expect(document.querySelectorAll('video')).toHaveLength(0)
  })
  it('retains the poster when video decoding fails', async () => {
    await render()
    await act(async () => document.querySelector('video')?.dispatchEvent(new Event('error')))
    expect(document.querySelectorAll('video')).toHaveLength(0)
    expect((document.querySelector('.app-background-video-layer') as HTMLElement).style.backgroundImage).toContain('background-1.png')
  })
  it('pauses on hidden tabs and resumes on visibility', async () => {
    await render()
    const pause = vi.mocked(HTMLMediaElement.prototype.pause)
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(pause.mock.calls.length).toBeGreaterThanOrEqual(2)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(play.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
  it('honors the high-contrast static-background preference', async () => {
    usePreferencesStore.getState().updatePreferences({ highContrast: true })
    await render()
    expect(document.querySelectorAll('video')).toHaveLength(0)
  })
  it('retains the poster when autoplay is blocked', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('Autoplay denied'))
    await render()
    expect((document.querySelector('.app-background-video-layer') as HTMLElement).style.backgroundImage).toContain('background-1.png')
  })
  it('switches through the actual settings panel and resets to unchanged Default', async () => {
    await act(async () => root.render(createElement('div', null, createElement(AppBackgroundVideo), createElement(ThemeSettingsPanel))))
    const buttons = [...container.querySelectorAll('button')]
    const midnight = buttons.find(button => button.textContent?.includes('Tectona Midnight'))!
    expect(midnight).toBeDefined()
    await act(async () => midnight.click())
    expect(document.documentElement.dataset.accent).toBe('tectona-midnight')
    expect(midnight.getAttribute('aria-pressed')).toBe('true')
    const reset = [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Reset to Defaults')!
    await act(async () => reset.click())
    expect(usePreferencesStore.getState().preferences.accentColor).toBe('gradient')
    expect(document.querySelector('video')?.getAttribute('src')).toBe('/images/background-1.mp4')
  })
  it('explains in settings why background motion is paused', async () => {
    usePreferencesStore.getState().updatePreferences({ reduceAnimations: true })
    await act(async () => root.render(createElement(ThemeSettingsPanel)))
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Reduce Animations is enabled in Behavior')
  })
})
