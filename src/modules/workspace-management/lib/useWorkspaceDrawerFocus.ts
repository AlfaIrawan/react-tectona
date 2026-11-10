import { useLayoutEffect, type RefObject } from 'react'

const TAB_STOP = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]'

export function useWorkspaceDrawerFocus(
  drawerRef: RefObject<HTMLDivElement | null>,
  open: boolean,
  modal = false,
) {
  useLayoutEffect(() => {
    const drawer = drawerRef.current
    if (!open || !drawer) return

    const opener = document.activeElement
    drawer.focus({ preventScroll: true })

    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const stops = Array.from(drawer.querySelectorAll<HTMLElement>(TAB_STOP)).filter((element) =>
        element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert], [aria-hidden="true"]'),
      )
      const first = stops[0]
      const last = stops.at(-1)
      const focused = document.activeElement
      const wrapBackward = event.shiftKey && (focused === first || focused === drawer)
      if (!first || wrapBackward || (!event.shiftKey && focused === last)) {
        event.preventDefault()
        const next = wrapBackward ? last : first
        next?.focus()
      }
    }

    if (modal) drawer.addEventListener('keydown', trapTab)
    return () => {
      if (modal) drawer.removeEventListener('keydown', trapTab)
      const focused = document.activeElement
      if (opener instanceof HTMLElement && opener.isConnected && (drawer.contains(focused) || focused === document.body)) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [drawerRef, modal, open])
}
