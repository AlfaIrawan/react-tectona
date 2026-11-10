import { useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePreferencesStore } from '@/stores/preferences-store'
import { getTectonaTheme } from '@/lib/tectonaThemes'

const CROSSFADE_MS = 1600
type Theme = ReturnType<typeof getTectonaTheme>

/** Remount per theme to release obsolete decoders and asynchronous work. */
function ThemeVideoLoop({ theme, reduced }: { theme: Theme; reduced: boolean }) {
  const primaryRef = useRef<HTMLVideoElement>(null)
  const secondaryRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const seamless = 'seamless' in theme && theme.seamless

  useEffect(() => {
    const primary = primaryRef.current
    const secondary = secondaryRef.current
    if (reduced || failed || !primary || (!seamless && !secondary)) return
    const slots = seamless ? [primary] : [primary, secondary!]
    let active = 0
    let fading = false
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const play = async (video: HTMLVideoElement) => {
      try { await video.play(); if (disposed) video.pause(); return !disposed } catch { return false }
    }
    const beginCrossfade = async () => {
      if (seamless || fading || disposed || document.hidden) return
      const outgoing = slots[active]
      const incoming = slots[1 - active]
      if (!Number.isFinite(outgoing.duration) || outgoing.duration <= 1.6) return
      fading = true
      incoming.currentTime = 0
      if (!await play(incoming)) { fading = false; return }
      if (disposed) return
      outgoing.style.opacity = '0'
      incoming.style.opacity = '1'
      timer = setTimeout(() => {
        if (disposed) return
        outgoing.pause()
        outgoing.currentTime = 0
        active = 1 - active
        fading = false
      }, CROSSFADE_MS)
    }
    const onTimeUpdate = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement
      if (video === slots[active] && video.currentTime >= video.duration - 1.6) void beginCrossfade()
    }
    const onVisibilityChange = () => {
      if (document.hidden) slots.forEach(video => video.pause())
      else { void play(slots[active]); if (fading) void play(slots[1 - active]) }
    }
    primary.style.opacity = '1'
    if (secondary) secondary.style.opacity = '0'
    if (!document.hidden) void play(primary)
    slots.forEach(video => video.addEventListener('timeupdate', onTimeUpdate))
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      disposed = true
      clearTimeout(timer)
      slots.forEach(video => { video.pause(); video.removeEventListener('timeupdate', onTimeUpdate) })
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [theme.video, reduced, failed, seamless])

  const videoProps = {
    className: 'app-background-video', muted: true, playsInline: true, loop: true,
    preload: 'auto' as const, poster: theme.poster, 'aria-hidden': true as const,
    tabIndex: -1, src: theme.video, onError: () => setFailed(true),
  }
  return (
    <div className="app-background-video-layer" data-background-theme={theme.id} aria-hidden style={{ backgroundImage: `url("${theme.poster}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {!reduced && !failed && <>
        <video ref={primaryRef} {...videoProps} style={{ opacity: 1 }} />
        {!seamless && <video ref={secondaryRef} {...videoProps} style={{ opacity: 0 }} />}
      </>}
    </div>
  )
}

/** Default retains its original MP4 and poster. Only the active theme is loaded. */
export function AppBackgroundVideo() {
  const isLogin = useLocation().pathname.replace(/\/$/, '') === '/login'
  const accent = usePreferencesStore(state => state.preferences.accentColor)
  const reduceAnimations = usePreferencesStore(state => state.preferences.reduceAnimations)
  const highContrast = usePreferencesStore(state => state.preferences.highContrast)
  const [systemReduced, setSystemReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const theme = getTectonaTheme(isLogin ? 'gradient' : accent)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduced(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => { document.documentElement.dataset.accent = theme.id }, [theme.id])
  if (typeof document === 'undefined') return null
  return createPortal(<ThemeVideoLoop key={theme.id} theme={theme} reduced={Boolean(systemReduced || reduceAnimations || highContrast)} />, document.body)
}
