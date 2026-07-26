import { registerSW } from 'virtual:pwa-register'
import { pushGlobalToast } from '@/components/ui/toast'

const OFFLINE_READY_TOAST_KEY = 'tectona:pwa-offline-ready-toast'

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

/** Register the service worker (production builds only). */
export function initPwa(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  if (!import.meta.env.PROD) {
    void unregisterDevServiceWorkers()
    return
  }

  registerSW({
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
      window.setInterval(() => {
        void registration.update()
      }, 60 * 60 * 1000)
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
