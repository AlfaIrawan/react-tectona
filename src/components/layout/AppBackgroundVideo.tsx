import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const BACKGROUND_VIDEO_SRC = '/images/background-1.mp4'
const BACKGROUND_VIDEO_POSTER = '/images/background-1.png'
/** Crossfade length — hides the hard cut when the clip restarts. */
const LOOP_CROSSFADE_MS = 1600
/** Start crossfade this many seconds before the clip ends. */
const LOOP_CROSSFADE_LEAD_SEC = 1.6

type VideoSlot = 'primary' | 'secondary'

function otherSlot(slot: VideoSlot): VideoSlot {
  return slot === 'primary' ? 'secondary' : 'primary'
}

/** Full-viewport ambient background with seamless crossfade looping. */
export function AppBackgroundVideo() {
  const primaryRef = useRef<HTMLVideoElement>(null)
  const secondaryRef = useRef<HTMLVideoElement>(null)
  const activeSlotRef = useRef<VideoSlot>('primary')
  const crossfadingRef = useRef(false)

  useEffect(() => {
    const primary = primaryRef.current
    const secondary = secondaryRef.current
    if (!primary || !secondary) return

    const slots = { primary, secondary }
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const videoFor = (slot: VideoSlot) => slots[slot]

    const setOpacity = (slot: VideoSlot, opacity: number) => {
      videoFor(slot).style.opacity = String(opacity)
    }

    const resetSlot = (slot: VideoSlot) => {
      const el = videoFor(slot)
      el.pause()
      el.currentTime = 0
      setOpacity(slot, 0)
    }

    const startInitialPlayback = async () => {
      crossfadingRef.current = false
      activeSlotRef.current = 'primary'
      resetSlot('secondary')
      const lead = videoFor('primary')
      lead.currentTime = 0
      setOpacity('primary', 1)
      if (motionQuery.matches) {
        lead.pause()
        return
      }
      try {
        await lead.play()
      } catch {
        // Autoplay blocked — poster remains visible.
      }
    }

    const beginCrossfade = async () => {
      if (crossfadingRef.current || motionQuery.matches) return

      const outgoingSlot = activeSlotRef.current
      const incomingSlot = otherSlot(outgoingSlot)
      const outgoing = videoFor(outgoingSlot)
      const incoming = videoFor(incomingSlot)
      const duration = outgoing.duration

      if (!Number.isFinite(duration) || duration <= LOOP_CROSSFADE_LEAD_SEC) return

      crossfadingRef.current = true
      incoming.currentTime = 0

      try {
        await incoming.play()
      } catch {
        crossfadingRef.current = false
        return
      }

      setOpacity(outgoingSlot, 0)
      setOpacity(incomingSlot, 1)

      window.setTimeout(() => {
        outgoing.pause()
        outgoing.currentTime = 0
        activeSlotRef.current = incomingSlot
        crossfadingRef.current = false
      }, LOOP_CROSSFADE_MS)
    }

    const onTimeUpdate = (event: Event) => {
      if (crossfadingRef.current || motionQuery.matches) return

      const el = event.currentTarget as HTMLVideoElement
      if (el !== videoFor(activeSlotRef.current)) return

      const duration = el.duration
      if (!Number.isFinite(duration)) return
      if (el.currentTime >= duration - LOOP_CROSSFADE_LEAD_SEC) {
        void beginCrossfade()
      }
    }

    const onMotionPreferenceChange = () => {
      void startInitialPlayback()
    }

    void startInitialPlayback()

    primary.addEventListener('timeupdate', onTimeUpdate)
    secondary.addEventListener('timeupdate', onTimeUpdate)
    motionQuery.addEventListener('change', onMotionPreferenceChange)

    return () => {
      primary.removeEventListener('timeupdate', onTimeUpdate)
      secondary.removeEventListener('timeupdate', onTimeUpdate)
      motionQuery.removeEventListener('change', onMotionPreferenceChange)
    }
  }, [])

  if (typeof document === 'undefined') return null

  const videoProps = {
    className: 'app-background-video',
    muted: true,
    playsInline: true,
    crossOrigin: 'anonymous' as const,
    preload: 'auto' as const,
    poster: BACKGROUND_VIDEO_POSTER,
    'aria-hidden': true,
    tabIndex: -1,
  }

  return createPortal(
    <div className="app-background-video-layer" aria-hidden>
      <video ref={primaryRef} {...videoProps} style={{ opacity: 1 }}>
        <source src={BACKGROUND_VIDEO_SRC} type="video/mp4" />
      </video>
      <video ref={secondaryRef} {...videoProps} style={{ opacity: 0 }}>
        <source src={BACKGROUND_VIDEO_SRC} type="video/mp4" />
      </video>
    </div>,
    document.body,
  )
}
