import { useEffect } from 'react'

import { getSession } from '@/auth/authService'
import { onSessionActive } from '@/auth/sessionEvents'
import { publishMyCollaborationPresence } from '@/lib/chat/chatContactDirectory'
import { useMyPresenceStore } from '@/stores/my-presence-store'

/** No intentional activity for this long → publish `away` (Idle). */
export const PRESENCE_AFK_IDLE_MS = 60 * 1000

const HEARTBEAT_MS = 30_000
/** Poll idle state — reliable even when a stray event would reset a one-shot timer. */
const IDLE_POLL_MS = 2_000
const ACTIVITY_THROTTLE_MS = 500

/** Deliberate user actions only — exclude `mousemove` (micro-jitter keeps users "active" while AFK). */
const ACTIVITY_EVENTS = ['pointerdown', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'] as const

type ActivePresence = 'online' | 'away'

export function usePresenceAfkTracker(): void {
  useEffect(() => {
    let heartbeatId: number | null = null
    let idlePollId: number | null = null
    let currentStatus: ActivePresence = 'online'
    let lastActivityAt = Date.now()
    let lastThrottleAt = 0
    let disposed = false

    const setLocalStatus = (status: ActivePresence) => {
      currentStatus = status
      useMyPresenceStore.getState().setStatus(status)
    }

    const publishCurrent = () => {
      if (!getSession()) return
      void publishMyCollaborationPresence(undefined, currentStatus).catch(() => undefined)
    }

    const goOnline = () => {
      if (currentStatus === 'online') return
      setLocalStatus('online')
      publishCurrent()
    }

    const goAway = () => {
      if (currentStatus === 'away') return
      setLocalStatus('away')
      publishCurrent()
    }

    /** Idle = no deliberate activity for AFK threshold (same rule in-tab or other window). */
    const isIdleNow = (): boolean => Date.now() - lastActivityAt >= PRESENCE_AFK_IDLE_MS

    const syncIdleState = () => {
      if (disposed || !getSession()) return
      if (isIdleNow()) {
        goAway()
      }
    }

    const onActivity = () => {
      const now = Date.now()
      if (now - lastThrottleAt < ACTIVITY_THROTTLE_MS) return
      lastThrottleAt = now
      lastActivityAt = now
      goOnline()
    }

    const onVisibility = () => {
      syncIdleState()
    }

    const start = () => {
      if (!getSession()) return
      lastActivityAt = Date.now()
      setLocalStatus('online')
      publishCurrent()

      if (heartbeatId !== null) window.clearInterval(heartbeatId)
      if (idlePollId !== null) window.clearInterval(idlePollId)
      heartbeatId = window.setInterval(publishCurrent, HEARTBEAT_MS)
      idlePollId = window.setInterval(syncIdleState, IDLE_POLL_MS)
    }

    const stop = () => {
      if (heartbeatId !== null) {
        window.clearInterval(heartbeatId)
        heartbeatId = null
      }
      if (idlePollId !== null) {
        window.clearInterval(idlePollId)
        idlePollId = null
      }
    }

    if (getSession()) {
      start()
    }

    const stopSessionActive = onSessionActive(start)

    for (const eventName of ACTIVITY_EVENTS) {
      document.addEventListener(eventName, onActivity, { passive: true, capture: true })
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      stopSessionActive()
      stop()
      for (const eventName of ACTIVITY_EVENTS) {
        document.removeEventListener(eventName, onActivity, { capture: true })
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
