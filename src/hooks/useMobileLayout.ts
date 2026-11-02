import { useSyncExternalStore } from 'react'

const query = '(max-width: 767px), (max-width: 1023px) and (pointer: coarse)'
function subscribe(callback: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
export function useMobileLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
