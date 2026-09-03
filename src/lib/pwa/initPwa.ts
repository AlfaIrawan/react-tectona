import { registerSW } from 'virtual:pwa-register'
import { pushGlobalToast } from '@/components/ui/toast'

const OFFLINE_READY_TOAST_KEY = 'tectona:pwa-offline-ready-toast'
/** Runtime image cache (Workbox CacheFirst for /images/*). Cleared on sign-out. */
export const TECTONA_STATIC_IMAGES_CACHE = 'tectona-static-images'
/** Precached + runtime background video (/images/background-*.mp4). Cleared on sign-out. */
export const TECTONA_BACKGROUND_MEDIA_CACHE = 'tectona-background-media'

/** Unregister any leftover production SW so Vite dev is never controlled by stale caches. */
async function unregisterDevServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const hadController = Boolean(navigator.serviceWorker.controller)
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((reg) => reg.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
  // One reload so the next document load is not SW-controlled (avoids stale /assets/*).
  const flag = 'tectona:sw-dev-reset-v1'
  if (hadController && sessionStorage.getItem(flag) !== '1') {
    sessionStorage.setItem(flag, '1')
    window.location.reload()
  }
}

/** Drop runtime /images cache so remote or session-scoped assets are not kept after logout. */
export async function clearSensitiveRuntimeCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    await Promise.all([
      caches.delete(TECTONA_STATIC_IMAGES_CACHE),
      caches.delete(TECTONA_BACKGROUND_MEDIA_CACHE),
    ])
  } catch {
    // Best-effort; must not block sign-out.
  }
}

function isPublicDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'tectona-dev.adira.co.id'
  )
}

/** Register the service worker (production builds only). */
export async function initPwa(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  // tectona-dev is a Vite production build behind nginx. Registering Workbox
  // there fights the index.html unregister script and makes <link rel=preload>
  // unused (Chrome: cross-world service worker resource mismatch).
  if (!import.meta.env.PROD || isPublicDevHost(window.location.hostname)) {
    await unregisterDevServiceWorkers()
    return
  }

  const updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      if (sessionStorage.getItem(OFFLINE_READY_TOAST_KEY) === '1') return
      sessionStorage.setItem(OFFLINE_READY_TOAST_KEY, '1')
      pushGlobalToast({
        variant: 'info',
        title: 'App available offline',
        description:
          'Tectona shell is cached — you can reopen the app even when the frontend server is down.',
      })
    },
    onRegistered(registration) {
      if (!registration) return
      void registration.update()
      window.setInterval(() => {
        void registration.update()
      }, 60 * 60 * 1000)
    },
    onNeedRefresh() {
      void updateSW(true)
    },
  })
}

export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isServiceWorkerControlled(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller)
}
